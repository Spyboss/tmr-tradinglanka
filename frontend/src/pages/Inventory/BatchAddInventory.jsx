import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, DatePicker, message, Spin, Card, Table, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { batchAddToInventory } from '../../services/inventoryService';
import { getAllBikeModels } from '../../services/bikeModelService';

const { Option } = Select;

const BatchAddInventory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bikeModels, setBikeModels] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchBikeModels();
  }, []);

  const fetchBikeModels = async () => {
    try {
      setLoading(true);
      const response = await getAllBikeModels();
      setBikeModels(response || []); // Use the response directly
    } catch (error) {
      message.error('Failed to fetch bike models');
      console.error('Error fetching bike models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (modelId) => {
    const model = bikeModels.find(m => m._id === modelId);
    setSelectedModel(model);

    // Prefill logic for motor/chassis prefixes removed as these are no longer part of BikeModel
    // Motor and Chassis numbers are now entered manually for each inventory item.
    form.setFieldsValue({
        motorNumber: '', // Clear previous motor number if any
        chassisNumber: '' // Clear previous chassis number if any
      });
  };

  const addItem = () => {
    form.validateFields().then(values => {
      const newItem = {
        ...values,
        key: Date.now(), // Unique key for React
        dateAdded: values.dateAdded ? values.dateAdded.toISOString() : new Date().toISOString()
      };

      setItems([...items, newItem]);

      // Reset form fields except bikeModelId
      const modelId = form.getFieldValue('bikeModelId');
      form.resetFields();
      if (modelId) {
        form.setFieldsValue({
          bikeModelId: modelId,
          // Prefixes removed, motorNumber and chassisNumber will be entered manually
          motorNumber: '',
          chassisNumber: ''
        });
      }

      message.success('Item added to batch');
    }).catch(error => {
      console.error('Validation failed:', error);
    });
  };

  const removeItem = (key) => {
    setItems(items.filter(item => item.key !== key));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      message.warning('Please add at least one item to the batch');
      return;
    }

    try {
      setSubmitting(true);

      // Remove the key property from each item
      const itemsToSubmit = items.map(({ key, ...rest }) => rest);

      await batchAddToInventory(itemsToSubmit);

      message.success(`${items.length} bikes added to inventory successfully`);
      navigate('/inventory');
    } catch (error) {
      message.error('Failed to add bikes to inventory');
      console.error('Error adding bikes to inventory:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Bike Model',
      dataIndex: 'bikeModelId',
      key: 'bikeModelId',
      render: (modelId) => {
        const model = bikeModels.find(m => m._id === modelId);
        return model ? model.name : 'Unknown';
      }
    },
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Tooltip title="Remove">
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => removeItem(record.key)}
          />
        </Tooltip>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 dark:bg-slate-900">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-slate-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Batch Add Bikes to Inventory</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Add New Item" className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              status: 'available',
              dateAdded: null
            }}
          >
            <Form.Item
              name="bikeModelId"
              label="Bike Model"
              rules={[{ required: true, message: 'Please select a bike model' }]}
            >
              <Select
                placeholder="Select bike model"
                onChange={handleModelChange}
                loading={loading}
              >
                {bikeModels.map(model => (
                  <Option key={model._id} value={model._id}>
                    {model.name} - Rs. {model.price?.toLocaleString() || 'N/A'}
                    {model.is_tricycle ? ' (E-TRICYCLE)' : model.is_ebicycle ? ' (E-MOTORBICYCLE)' : ' (E-MOTORCYCLE)'}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="motorNumber"
              label="Motor Number"
              rules={[{ required: true, message: 'Please enter motor number' }]}
            >
              <Input placeholder="Enter motor number" className="dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600" />
            </Form.Item>

            <Form.Item
              name="chassisNumber"
              label="Chassis Number"
              rules={[{ required: true, message: 'Please enter chassis number' }]}
            >
              <Input placeholder="Enter chassis number" className="dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600" />
            </Form.Item>

            <Form.Item
              name="status"
              label="Status"
              rules={[{ required: true, message: 'Please select status' }]}
            >
              <Select placeholder="Select status">
                <Option value="available">Available</Option>
                <Option value="reserved">Reserved</Option>
                <Option value="damaged">Damaged</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="dateAdded"
              label="Date Added"
            >
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item
              name="notes"
              label="Notes"
            >
              <Input.TextArea rows={2} placeholder="Enter any additional notes" />
            </Form.Item>

            <Form.Item>
              <Button
                type="dashed"
                onClick={addItem}
                block
                icon={<PlusOutlined />}
              >
                Add to Batch
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={`Batch Items (${items.length})`}
          className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700"
          extra={
            <Space>
              <Button onClick={() => navigate('/inventory')}>
                Cancel
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                disabled={items.length === 0}
              >
                Save All
              </Button>
            </Space>
          }
        >
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No items added yet. Add items using the form on the left.
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={items}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content', y: 400 }}
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default BatchAddInventory;
