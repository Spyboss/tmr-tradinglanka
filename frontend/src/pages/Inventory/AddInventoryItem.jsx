import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, DatePicker, message, Spin, Card } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { addToInventory } from '../../services/inventoryService';
import { getAllBikeModels } from '../../services/bikeModelService';

const { Option } = Select;

const AddInventoryItem = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bikeModels, setBikeModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const location = useLocation();

  useEffect(() => {
    fetchBikeModels();
  }, []);

  useEffect(() => {
    // Prefill from navigation state if present
    if (location.state) {
      const { bikeModelId, motorNumber, chassisNumber } = location.state || {};
      const values = {};
      if (bikeModelId) values.bikeModelId = bikeModelId;
      if (motorNumber) values.motorNumber = motorNumber;
      if (chassisNumber) values.chassisNumber = chassisNumber;
      if (Object.keys(values).length > 0) {
        form.setFieldsValue(values);
      }
    }
  }, [location.state]);

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
    // If there was other model-specific data to pre-fill, it would go here.
    // For now, we can clear the fields if a new model is selected, or leave them as is.
    // Clearing them might be better to avoid carrying over old prefixes if the user was typing.
    form.setFieldsValue({
        motorNumber: '',
        chassisNumber: ''
      });
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      const inventoryData = {
        ...values,
        dateAdded: values.dateAdded ? values.dateAdded.toISOString() : new Date().toISOString()
      };

      await addToInventory(inventoryData);

      message.success('Bike added to inventory successfully');
      navigate('/inventory');
    } catch (error) {
      message.error('Failed to add bike to inventory');
      console.error('Error adding bike to inventory:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 dark:bg-slate-900">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-slate-900 min-h-screen"> {/* Ensure full page dark background */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Add Bike to Inventory</h1>
      </div>

      <Card className="max-w-2xl mx-auto bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-lg shadow-md">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
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
              <Option value="sold">Sold</Option>
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
            <Input.TextArea rows={4} placeholder="Enter any additional notes" />
          </Form.Item>

          <Form.Item>
            <div className="flex justify-end space-x-4">
              <Button onClick={() => navigate('/inventory')}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Add to Inventory
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AddInventoryItem;
