import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, DatePicker, InputNumber, Switch, message, Modal, Table, Spin, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/apiClient';
import { getAvailableBikesByModel } from '../services/inventoryService';
import toast from 'react-hot-toast';

const { Option } = Select;

const BillGeneratorWithInventory = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [bikeModels, setBikeModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [billType, setBillType] = useState('cash');
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [bikePrice, setBikePrice] = useState(0);

  // Inventory related states
  const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
  const [availableBikes, setAvailableBikes] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);

  useEffect(() => {
    fetchBikeModels();
  }, []);

  const fetchBikeModels = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/bike-models');
      setBikeModels(response || []); // Use the response directly
    } catch (error) {
      console.error('Error fetching bike models:', error);
      message.error('Failed to fetch bike models');
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async (modelId) => {
    if (!modelId) return;

    // Find the selected model from the models list
    const model = bikeModels.find(model => model._id === modelId);

    if (model) {
      setSelectedModel(model);

      // Update the form with the model price
      form.setFieldsValue({
        bike_price: model.price,
      });

      // If it's an e-bicycle or a tricycle, enforce cash bill type
      if (model.is_ebicycle || model.is_tricycle) {
        setBillType('cash');
        setBikePrice(model.price);
      } else {
        setBikePrice(model.price);
      }

      // Clear any previously selected inventory item and related fields
      setSelectedInventoryItem(null);
      form.setFieldsValue({
        motor_number: '', // Clear motor number as it will come from selected inventory or be manual
        chassis_number: '', // Clear chassis number
        inventoryItemId: null
      });
    }
  };

  const showInventoryModal = async () => {
    if (!selectedModel) {
      message.warning('Please select a bike model first');
      return;
    }

    try {
      setLoadingInventory(true);
      const response = await getAvailableBikesByModel(selectedModel._id);
      console.log('Available bikes response:', response);
      setAvailableBikes(response || []); // apiClient.get already returns the data
      setInventoryModalVisible(true);
    } catch (error) {
      console.error('Error fetching available bikes:', error);
      message.error('Failed to fetch available bikes');
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleSelectInventoryItem = (item) => {
    setSelectedInventoryItem(item);

    // Update form with the selected bike's details
    form.setFieldsValue({
      motor_number: item.motorNumber,
      chassis_number: item.chassisNumber,
      inventoryItemId: item._id
    });

    setInventoryModalVisible(false);
  };

  const handlePreview = async () => {
    try {
      await form.validateFields();

      setPreviewLoading(true);

      const values = form.getFieldsValue();

      // Calculate total amount
      const totalAmount = calculateTotalAmount(values);

      // Prepare bill data for preview
      const billData = {
        customerName: values.customer_name,
        customerNIC: values.customer_nic,
        customerAddress: values.customer_address,
        bikeModel: selectedModel.name,
        bikePrice: selectedModel.price,
        motorNumber: values.motor_number,
        chassisNumber: values.chassis_number,
        billType: billType,
        isEbicycle: selectedModel.is_ebicycle || false,
        isTricycle: selectedModel.is_tricycle || false,
        totalAmount: totalAmount,
        billDate: values.bill_date ? values.bill_date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0]
      };

      // Add leasing details if applicable
      if (billType === 'leasing') {
        billData.downPayment = values.down_payment;
        billData.rmvCharge = 13500;
      } else {
        // For cash bills
        if (!selectedModel.is_ebicycle && !selectedModel.is_tricycle) {
          billData.rmvCharge = 13000;
        } else {
          billData.rmvCharge = 0;
        }
      }

      // Add advance payment details if applicable
      if (isAdvancePayment) {
        billData.isAdvancePayment = true;
        billData.advanceAmount = values.advance_amount;
        billData.balanceAmount = totalAmount - values.advance_amount;

        if (values.estimated_delivery_date) {
          billData.estimatedDeliveryDate = values.estimated_delivery_date.format('YYYY-MM-DD');
        }
      }

      // Add inventory item ID if selected
      if (selectedInventoryItem) {
        billData.inventoryItemId = selectedInventoryItem._id;
      }

      // Generate preview PDF
      const response = await apiClient.post('/bills/preview', billData, {
        responseType: 'blob'
      });

      // Create a URL for the blob
      const url = URL.createObjectURL(new Blob([response], { type: 'application/pdf' }));
      setPreviewUrl(url);
      setPreviewVisible(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      message.error('Please fill in all required fields');
    } finally {
      setPreviewLoading(false);
    }
  };

  const calculateTotalAmount = (values) => {
    const model = bikeModels.find(m => m._id === values.model_id);
    if (!model) return 0;

    const bikePrice = parseFloat(model.price);

    // For e-bicycles and tricycles, the price is already the final price
    if (model.is_ebicycle || model.is_tricycle) {
      return bikePrice;
    }

    // For leasing, total amount is just the down payment
    if (billType === 'leasing') {
      return values.down_payment || 0;
    }

    // For regular bikes with cash payment, add RMV charge
    return bikePrice + 13000;
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      // Create the bill data
      const billData = {
        // Customer details
        customerName: values.customer_name,
        customerNIC: values.customer_nic,
        customerAddress: values.customer_address,

        // Bike details
        bikeModel: selectedModel.name,
        bikePrice: selectedModel.price,
        motorNumber: values.motor_number,
        chassisNumber: values.chassis_number,

        // Vehicle type flags
        isEbicycle: selectedModel.is_ebicycle || false,
        isTricycle: selectedModel.is_tricycle || false,

        // Bill type
        billType: billType,

        // Dates
        billDate: values.bill_date ? values.bill_date.toISOString() : new Date().toISOString(),

        // Advance payment
        isAdvancePayment: isAdvancePayment,
      };

      // Add inventory item ID if selected
      if (selectedInventoryItem) {
        billData.inventoryItemId = selectedInventoryItem._id;
      }

      // Add leasing details if applicable
      if (billType === 'leasing') {
        billData.downPayment = parseFloat(values.down_payment || 0);
      }

      // Add advance payment details if applicable
      if (isAdvancePayment) {
        billData.advanceAmount = parseFloat(values.advance_amount || 0);

        if (values.estimated_delivery_date) {
          billData.estimatedDeliveryDate = values.estimated_delivery_date.toISOString();
        }
      }

      console.log('Submitting bill data:', billData);

      const response = await apiClient.post('/bills', billData);

      toast.success('Bill generated successfully');
      navigate(`/bills/${response._id || response.id}`);
    } catch (error) {
      console.error('Error generating bill:', error);
      toast.error('Failed to generate bill');
    } finally {
      setLoading(false);
    }
  };

  const inventoryColumns = [
    {
      title: 'Motor Number',
      dataIndex: 'motorNumber',
      key: 'motorNumber'
    },
    {
      title: 'Chassis Number',
      dataIndex: 'chassisNumber',
      key: 'chassisNumber'
    },
    {
      title: 'Date Added',
      dataIndex: 'dateAdded',
      key: 'dateAdded',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color="green">{status.toUpperCase()}</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleSelectInventoryItem(record)}
        >
          Select
        </Button>
      )
    }
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 dark:bg-slate-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">Generate New Bill with Inventory</h1>

      {selectedModel?.is_ebicycle && (
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 mb-6 rounded border border-blue-200 dark:border-blue-700">
          <h3 className="text-blue-800 dark:text-blue-300 font-medium">E-Bicycle Selected</h3>
          <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">This is an e-bicycle model. Only cash sales are allowed, and no RMV charges apply.</p>
        </div>
      )}

      {selectedModel?.is_tricycle && (
        <div className="bg-green-50 dark:bg-green-900/30 p-4 mb-6 rounded border border-green-200 dark:border-green-700">
          <h3 className="text-green-800 dark:text-green-300 font-medium">E-Tricycle Selected</h3>
          <p className="text-green-600 dark:text-green-400 text-sm mt-1">This is an e-tricycle model. Only cash sales are allowed, and no RMV charges apply.</p>
        </div>
      )}

      {selectedInventoryItem && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 mb-6 rounded border border-yellow-200 dark:border-yellow-700">
          <h3 className="text-yellow-800 dark:text-yellow-300 font-medium">Bike Selected from Inventory</h3>
          <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-1">
            Motor Number: {selectedInventoryItem.motorNumber},
            Chassis Number: {selectedInventoryItem.chassisNumber}
          </p>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          bill_type: 'cash',
          is_advance_payment: false,
          bill_date: null,
          estimated_delivery_date: null
        }}
      >
        <Form.Item
          name="model_id"
          label="Vehicle Model"
          rules={[{ required: true, message: 'Please select a vehicle model' }]}
        >
          <Select
            onChange={handleModelChange}
            placeholder="Select vehicle model"
            options={bikeModels.map(model => ({
              label: `${model.name} - Rs. ${model.price?.toLocaleString() || 'N/A'} ${model.is_tricycle ? '(E-TRICYCLE)' : model.is_ebicycle ? '(E-MOTORBICYCLE)' : '(E-MOTORCYCLE)'}`,
              value: model._id
            }))}
            notFoundContent={bikeModels.length === 0 ? 'No vehicle models available' : 'No matching models found'}
          />
        </Form.Item>

        <div className="mb-4">
          <Button
            type="dashed"
            onClick={showInventoryModal}
            disabled={!selectedModel}
            className="w-full"
          >
            Select Bike from Inventory
          </Button>
        </div>

        <Form.Item
          name="bill_type"
          label="Bill Type"
        >
          <Select
            value={billType}
            onChange={(value) => setBillType(value)}
            disabled={selectedModel?.is_ebicycle || selectedModel?.is_tricycle}
            options={[
              { label: 'Cash', value: 'cash' },
              { label: 'Leasing', value: 'leasing', disabled: selectedModel?.is_ebicycle || selectedModel?.is_tricycle }
            ]}
          />
        </Form.Item>

        {billType === 'leasing' && (
          <Form.Item
            name="down_payment"
            label="Down Payment"
            rules={[{ required: billType === 'leasing', message: 'Please enter down payment amount' }]}
          >
            <InputNumber
              min={0}
              addonBefore="Rs."
              style={{ width: '100%' }}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\₹\s?|(,*)/g, '')}
            />
          </Form.Item>
        )}

        <Form.Item
          label="Advance Payment"
          name="is_advance_payment"
          valuePropName="checked"
        >
          <Switch onChange={(checked) => setIsAdvancePayment(checked)} />
        </Form.Item>

        {isAdvancePayment && (
          <Form.Item
            name="advance_amount"
            label="Advance Amount"
            rules={[{ required: isAdvancePayment, message: 'Please enter advance amount' }]}
          >
            <InputNumber
              min={0}
              addonBefore="Rs."
              style={{ width: '100%' }}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\₹\s?|(,*)/g, '')}
            />
          </Form.Item>
        )}

        {isAdvancePayment && (
          <Form.Item
            name="estimated_delivery_date"
            label="Estimated Delivery Date"
          >
            <DatePicker className="w-full" />
          </Form.Item>
        )}

        <Form.Item
          name="customer_name"
          label="Customer Name"
          rules={[{ required: true, message: 'Please enter customer name' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="customer_nic"
          label="Customer NIC"
          rules={[{ required: true, message: 'Please enter customer NIC' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="customer_address"
          label="Customer Address"
          rules={[{ required: true, message: 'Please enter customer address' }]}
        >
          <Input.TextArea />
        </Form.Item>

        <Form.Item
          name="motor_number"
          label="Motor Number"
          rules={[{ required: true, message: 'Please enter motor number' }]}
        >
          <Input disabled={!!selectedInventoryItem} />
        </Form.Item>

        <Form.Item
          name="chassis_number"
          label="Chassis Number"
          rules={[{ required: true, message: 'Please enter chassis number' }]}
        >
          <Input disabled={!!selectedInventoryItem} />
        </Form.Item>

        <Form.Item
          name="inventoryItemId"
          hidden
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="bill_date"
          label="Bill Date"
        >
          <DatePicker className="w-full" />
        </Form.Item>

        <div className="flex justify-end space-x-4 mt-6">
          <Button onClick={() => navigate('/bills')}>
            Cancel
          </Button>
          <Button
            type="default"
            onClick={handlePreview}
            loading={previewLoading}
          >
            Preview
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
          >
            Generate Bill
          </Button>
        </div>
      </Form>

      {/* Inventory Selection Modal */}
      <Modal
        title="Select Bike from Inventory"
        open={inventoryModalVisible}
        onCancel={() => setInventoryModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setInventoryModalVisible(false)}>
            Cancel
          </Button>
        ]}
        width={800}
      >
        {loadingInventory ? (
          <div className="flex justify-center items-center py-8">
            <Spin size="large" />
          </div>
        ) : availableBikes.length === 0 ? (
          <div className="text-center py-8 dark:text-gray-300">
            <p>No available bikes found for this model.</p>
            <Button
              type="primary"
              onClick={() => navigate('/inventory/add')}
              className="mt-4"
            >
              Add Bikes to Inventory
            </Button>
          </div>
        ) : (
          <Table
            columns={inventoryColumns}
            dataSource={availableBikes}
            rowKey="_id"
            pagination={{ pageSize: 5 }}
          />
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal
        title="Bill Preview"
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          URL.revokeObjectURL(previewUrl);
        }}
        width={800}
        footer={[
          <Button key="back" onClick={() => {
            setPreviewVisible(false);
            URL.revokeObjectURL(previewUrl);
          }}>
            Close
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            Generate Bill
          </Button>,
        ]}
      >
        <div className="h-[700px]">
          <iframe
            src={previewUrl}
            title="Bill Preview"
            className="w-full h-full border-0"
          />
        </div>
      </Modal>
    </div>
  );
};

export default BillGeneratorWithInventory;
