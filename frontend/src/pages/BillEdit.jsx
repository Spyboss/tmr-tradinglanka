import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, Button, DatePicker, InputNumber, Switch, message, Spin, Card } from 'antd';
import moment from 'moment';
import apiClient from '../config/apiClient';
import toast from 'react-hot-toast';

const { Option } = Select;

const BillEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [bill, setBill] = useState(null);
  const [bikeModels, setBikeModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [billType, setBillType] = useState('');
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      await fetchBill();
      await fetchBikeModels();
    };
    loadData();
  }, [id]);

  // Set selected model when both bill and bike models are loaded
  useEffect(() => {
    if (bill && bikeModels.length > 0) {
      const modelName = bill.bikeModel;
      if (modelName) {
        const model = bikeModels.find(m => m.name === modelName);
        console.log('Found matching model for bill:', model);
        setSelectedModel(model);
      }
    }
  }, [bill, bikeModels]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      console.log(`Fetching bill with ID: ${id}`);
      const data = await apiClient.get(`/bills/${id}`);

      if (!data) {
        toast.error('Bill not found');
        navigate('/bills');
        return;
      }

      console.log('Bill data received:', data);
      setBill(data);

      // Set bill type and advance flag from API (camelCase)
      const apiBillType = (data.billType || 'cash').toLowerCase();
      setBillType(data.isAdvancePayment ? 'advance' : apiBillType);
      setIsAdvancePayment(Boolean(data.isAdvancePayment));

      // Format dates for the form and map field names correctly
      const formValues = {
        bikeModel: data.bikeModel,
        billType: data.isAdvancePayment ? 'advance' : apiBillType,
        customerName: data.customerName,
        customerNIC: data.customerNIC,
        customerAddress: data.customerAddress,
        motorNumber: data.motorNumber,
        chassisNumber: data.chassisNumber,
        bikePrice: data.bikePrice,
        downPayment: data.downPayment,
        totalAmount: data.totalAmount,
        balanceAmount: data.balanceAmount,

        billDate: data.billDate ? moment(data.billDate) : null,
        estimatedDeliveryDate: data.estimatedDeliveryDate ? moment(data.estimatedDeliveryDate) : null,
      };

      console.log('Setting form values:', formValues);
      form.setFieldsValue(formValues);
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error(`Failed to fetch bill details: ${error.message || 'Unknown error'}`);
      navigate('/bills');
    } finally {
      setLoading(false);
    }
  };

  const fetchBikeModels = async () => {
    try {
      const data = await apiClient.get('/bike-models');
      console.log('Bike models received:', data);
      setBikeModels(data || []);
    } catch (error) {
      console.error('Error fetching bike models:', error);
      toast.error('Failed to fetch bike models');
      setBikeModels([]);
    }
  };

  const handleModelChange = (value) => {
    // Look for model by name (updated field name)
    const model = bikeModels.find(m => m.name === value);
    setSelectedModel(model);

    if (model && model.price) {
      form.setFieldsValue({
        bikePrice: model.price,
        bikeModel: model.name
      });
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      console.log('Submitting bill update with values:', values);

      // Get the selected model's price if bike_price is missing
      const bikePrice = values.bikePrice || (selectedModel ? selectedModel.price : 0);

      // Is this an e-bicycle?
      const modelString = String(values.bikeModel || '').trim();
      const isEbicycle =
        selectedModel?.is_ebicycle ||
        modelString.toUpperCase().includes('COLA5') ||
        modelString.toLowerCase().includes('cola5') ||
        modelString.toUpperCase().includes('X01') ||
        modelString.toLowerCase().includes('x01');

      // Normalize bill type
      const normalizedBillType = billType;

      // Prepare data for update
      const submitBillType = normalizedBillType === 'advance' ? 'cash' : normalizedBillType;

      const updateData = {
        bikeModel: values.bikeModel,
        billType: submitBillType,
        customerName: values.customerName,
        customerNIC: values.customerNIC,
        customerAddress: values.customerAddress,
        motorNumber: values.motorNumber,
        chassisNumber: values.chassisNumber,
        bikePrice: bikePrice,
        billDate: values.billDate ? values.billDate.toISOString() : new Date().toISOString(),
        estimatedDeliveryDate: values.estimatedDeliveryDate ? values.estimatedDeliveryDate.toISOString() : null,
        isEbicycle: isEbicycle,
        isAdvancePayment: normalizedBillType === 'advance'
      };

      // Calculate total amount based on bill type and model
      if (submitBillType === 'cash') {
        updateData.totalAmount = isEbicycle
          ? parseFloat(bikePrice)
          : parseFloat(bikePrice) + 13000;
      } else if (submitBillType === 'leasing') {
        const downPayment = parseFloat(values.downPayment || 0);
        updateData.totalAmount = downPayment;
        updateData.downPayment = downPayment;
      }

      if (normalizedBillType === 'advance') {
        updateData.totalAmount = parseFloat(bikePrice);
        const downPayment = parseFloat(values.downPayment || 0);
        updateData.downPayment = downPayment;
        updateData.advanceAmount = downPayment;
        updateData.balanceAmount = updateData.totalAmount - downPayment;
      }

      console.log('Sending update data:', updateData);
      const response = await apiClient.put(`/bills/${id}`, updateData);

      if (response) {
        toast.success('Bill updated successfully');
        navigate(`/bills/${id}`);
      } else {
        throw new Error('Failed to update bill: No response received');
      }
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error(`Failed to update bill: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen dark:bg-slate-900">
        <Spin size="large" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-6">
        <p>Bill not found</p>
        <Button
          type="primary"
          onClick={() => navigate('/bills')}
          className="mt-4"
        >
          Return to Bills
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card title="Edit Bill" className="mb-6">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="bikeModel"
            label="Bike Model"
            rules={[{ required: true, message: 'Please select a bike model' }]}
          >
            <Select
              onChange={handleModelChange}
              placeholder="Select bike model"
              options={bikeModels.map(model => ({
                label: `${model.name} - Rs. ${(model.price || 0).toLocaleString()}`,
                value: model.name
              }))}
            />
          </Form.Item>

          <Form.Item
            name="billType"
            label="Bill Type"
          >
            <Select
              value={billType}
              onChange={(value) => {
                setBillType(value);
                form.setFieldsValue({ billType: value });
              }}
              disabled={selectedModel?.is_ebicycle && billType === 'leasing'}
              options={[
                { label: 'Cash', value: 'cash' },
                { label: 'Leasing', value: 'leasing', disabled: selectedModel?.is_ebicycle },
                { label: 'Advance Payment', value: 'advance' }
              ]}
            />
          </Form.Item>

          {billType === 'leasing' && (
            <Form.Item
              name="downPayment"
              label="Down Payment"
              rules={[{ required: true, message: 'Please enter the down payment amount' }]}
            >
              <InputNumber
                className="w-full"
                min={1000}
                step={1000}
                formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => {
                  const parsed = value.replace(/[^\d]/g, '');
                  return parsed ? parseInt(parsed) : 1000;
                }}
              />
            </Form.Item>
          )}

          {billType === 'advance' && (
            <>
              <Form.Item
                name="downPayment"
                label="Down Payment"
                rules={[{ required: true, message: 'Please enter the down payment amount' }]}
              >
                <InputNumber
                  className="w-full"
                  min={1000}
                  step={1000}
                  formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => {
                    const parsed = value.replace(/[^\d]/g, '');
                    return parsed ? parseInt(parsed) : 1000;
                  }}
                />
              </Form.Item>

              <Form.Item
                name="estimatedDeliveryDate"
                label="Estimated Delivery Date"
                rules={[{ required: true, message: 'Please enter the estimated delivery date' }]}
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="customerName"
            label="Customer Name"
            rules={[{ required: true, message: 'Please enter customer name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="customerNIC"
            label="Customer NIC"
            rules={[{ required: true, message: 'Please enter customer NIC' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="customerAddress"
            label="Customer Address"
            rules={[{ required: true, message: 'Please enter customer address' }]}
          >
            <Input.TextArea />
          </Form.Item>

          <Form.Item
            name="motorNumber"
            label="Motor Number"
            rules={[{ required: true, message: 'Please enter motor number' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="chassisNumber"
            label="Chassis Number"
            rules={[{ required: true, message: 'Please enter chassis number' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="billDate"
            label="Bill Date"
          >
            <DatePicker className="w-full" />
          </Form.Item>

          <Form.Item className="flex justify-end">
            <Button
              type="default"
              onClick={() => navigate(`/bills/${id}`)}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Update Bill
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default BillEdit;