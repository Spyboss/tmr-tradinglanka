import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, DatePicker, message, Spin, Card } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getInventoryById, updateInventory } from '../../services/inventoryService';
import { getAllBikeModels } from '../../services/bikeModelService';
import dayjs from 'dayjs';

const { Option } = Select;

const EditInventoryItem = () => {
  const { id } = useParams();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bikeModels, setBikeModels] = useState([]);
  const [inventoryItem, setInventoryItem] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch bike models
      const modelsResponse = await getAllBikeModels();
      setBikeModels(modelsResponse);
      
      // Fetch inventory item
      const itemResponse = await getInventoryById(id);
      setInventoryItem(itemResponse);
      
      // Set form values
      form.setFieldsValue({
        bikeModelId: itemResponse.bikeModelId?._id,
        motorNumber: itemResponse.motorNumber,
        chassisNumber: itemResponse.chassisNumber,
        status: itemResponse.status,
        dateAdded: itemResponse.dateAdded ? dayjs(itemResponse.dateAdded) : null,
        notes: itemResponse.notes
      });
    } catch (error) {
      message.error('Failed to fetch data');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      
      const updateData = {
        ...values,
        dateAdded: values.dateAdded ? values.dateAdded.toISOString() : inventoryItem.dateAdded
      };
      
      await updateInventory(id, updateData);
      
      message.success('Inventory item updated successfully');
      navigate('/inventory');
    } catch (error) {
      message.error('Failed to update inventory item');
      console.error('Error updating inventory item:', error);
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

  if (!inventoryItem) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-4">Inventory Item Not Found</h2>
            <Button type="primary" onClick={() => navigate('/inventory')}>
              Return to Inventory
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isSold = inventoryItem.status === 'sold';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit Inventory Item</h1>
      </div>

      <Card className="max-w-2xl mx-auto">
        {isSold && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-700">
              This bike has been sold. Some fields cannot be modified.
              {inventoryItem.billId && (
                <Button 
                  type="link" 
                  onClick={() => navigate(`/bills/${inventoryItem.billId}`)}
                  className="p-0 ml-2"
                >
                  View Bill
                </Button>
              )}
            </p>
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="bikeModelId"
            label="Bike Model"
            rules={[{ required: true, message: 'Please select a bike model' }]}
          >
            <Select
              placeholder="Select bike model"
              disabled={isSold}
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
            <Input placeholder="Enter motor number" disabled={isSold} />
          </Form.Item>

          <Form.Item
            name="chassisNumber"
            label="Chassis Number"
            rules={[{ required: true, message: 'Please enter chassis number' }]}
          >
            <Input placeholder="Enter chassis number" disabled={isSold} />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select status' }]}
          >
            <Select placeholder="Select status" disabled={isSold}>
              <Option value="available">Available</Option>
              <Option value="reserved">Reserved</Option>
              <Option value="damaged">Damaged</Option>
              <Option value="sold" disabled={!isSold}>Sold</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="dateAdded"
            label="Date Added"
          >
            <DatePicker className="w-full" disabled={isSold} />
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
              <Button type="primary" htmlType="submit" loading={submitting} disabled={loading}>
                Update
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default EditInventoryItem;
