import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Spin, Typography, Divider } from 'antd';
import { UserOutlined, IdcardOutlined, HomeOutlined, PhoneOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../config/apiClient';

const { Title, Text } = Typography;

const UserProfile = () => {
  const { user, setUser } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        email: user.email,
        name: user.name || '',
        nic: user.nic || '',
        address: user.address || '',
        phoneNumber: user.phoneNumber || ''
      });
    }
  }, [user, form]);

  const handleSubmit = async (values) => {
    try {
      setSaving(true);

      // Only send fields that have changed
      const updates = {};
      if (values.name !== user.name) updates.name = values.name;
      if (values.nic !== user.nic) updates.nic = values.nic;
      if (values.address !== user.address) updates.address = values.address;
      if (values.phoneNumber !== user.phoneNumber) updates.phoneNumber = values.phoneNumber;

      if (Object.keys(updates).length === 0) {
        message.info('No changes to save');
        return;
      }

      const response = await apiClient.put('/api/auth/profile', updates);

      if (response.user) {
        setUser(response.user);
        message.success('Profile updated successfully');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      message.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    if (user) {
      form.setFieldsValue({
        email: user.email,
        name: user.name || '',
        nic: user.nic || '',
        address: user.address || '',
        phoneNumber: user.phoneNumber || ''
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px] dark:bg-slate-900">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-sm">
        <div className="mb-6">
          <Title level={3} className="mb-2">
            <UserOutlined className="mr-2" />
            Profile Information
          </Title>
          <Text type="secondary">
            Update your personal information and contact details
          </Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="space-y-4"
        >
          <Form.Item
            label="Email Address"
            name="email"
          >
            <Input
              prefix={<UserOutlined />}
              disabled
              className="bg-gray-50 dark:bg-gray-800"
            />
          </Form.Item>

          <Form.Item
            label="Full Name"
            name="name"
            rules={[
              { max: 100, message: 'Name cannot exceed 100 characters' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your full name"
              className="dark:bg-gray-800 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label="National Identity Card (NIC)"
            name="nic"
            rules={[
              {
                pattern: /^[0-9]{9}[vVxX]?$|^[0-9]{12}$/,
                message: 'Please enter a valid NIC number'
              }
            ]}
          >
            <Input
              prefix={<IdcardOutlined />}
              placeholder="Enter your NIC number"
              className="dark:bg-gray-800 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label="Address"
            name="address"
            rules={[
              { max: 500, message: 'Address cannot exceed 500 characters' }
            ]}
          >
            <Input.TextArea
              prefix={<HomeOutlined />}
              placeholder="Enter your address"
              rows={3}
              className="dark:bg-gray-800 dark:border-gray-600"
            />
          </Form.Item>

          <Form.Item
            label="Phone Number"
            name="phoneNumber"
            rules={[
              {
                pattern: /^[+]?[0-9\s\-\(\)]{7,15}$/,
                message: 'Please enter a valid phone number'
              }
            ]}
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder="Enter your phone number"
              className="dark:bg-gray-800 dark:border-gray-600"
            />
          </Form.Item>

          <Divider />

          <div className="flex justify-between items-center">
            <Text type="secondary" className="text-sm">
              Last updated: {user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Never'}
            </Text>

            <div className="space-x-3">
              <Button onClick={handleReset} disabled={saving}>
                Reset
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default UserProfile;
