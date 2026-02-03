import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  Switch,
  InputNumber,
  Button,
  message,
  Spin,
  Typography,
  Divider,
  Row,
  Col,
  Space
} from 'antd';
import {
  SettingOutlined,
  BellOutlined,
  DashboardOutlined,
  SecurityScanOutlined,
  SaveOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';
import apiClient from '../../config/apiClient';

const { Title, Text } = Typography;
const { Option } = Select;

const UserPreferences = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/user/preferences');

      if (response.preferences) {
        setPreferences(response.preferences);
        form.setFieldsValue(response.preferences);
      }
    } catch (error) {
      console.error('Fetch preferences error:', error);
      message.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSaving(true);

      const response = await apiClient.put('/api/user/preferences', values);

      if (response.preferences) {
        setPreferences(response.preferences);
        message.success('Preferences updated successfully');

        // Update theme if changed
        if (values.theme !== preferences?.theme) {
          if (values.theme === 'dark' && !isDarkMode) {
            toggleTheme();
          } else if (values.theme === 'light' && isDarkMode) {
            toggleTheme();
          }
        }
      }
    } catch (error) {
      console.error('Update preferences error:', error);
      message.error(error.response?.data?.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);

      const response = await apiClient.delete('/api/user/preferences');

      if (response.preferences) {
        setPreferences(response.preferences);
        form.setFieldsValue(response.preferences);
        message.success('Preferences reset to defaults');
      }
    } catch (error) {
      console.error('Reset preferences error:', error);
      message.error('Failed to reset preferences');
    } finally {
      setSaving(false);
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
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-sm">
        <div className="mb-6">
          <Title level={3} className="mb-2">
            <SettingOutlined className="mr-2" />
            User Preferences
          </Title>
          <Text type="secondary">
            Customize your experience and manage your account settings
          </Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={preferences}
        >
          {/* Appearance Settings */}
          <Card type="inner" title={<><SettingOutlined className="mr-2" />Appearance</>} className="mb-6">
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Theme"
                  name="theme"
                  tooltip="Choose your preferred color theme"
                >
                  <Select className="w-full">
                    <Option value="light">Light</Option>
                    <Option value="dark">Dark</Option>
                    <Option value="system">System Default</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Language"
                  name="language"
                  tooltip="Select your preferred language"
                >
                  <Select className="w-full">
                    <Option value="en">English</Option>
                    <Option value="si">Sinhala</Option>
                    <Option value="ta">Tamil</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Notification Settings */}
          <Card type="inner" title={<><BellOutlined className="mr-2" />Notifications</>} className="mb-6">
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Space direction="vertical" className="w-full">
                  <Form.Item
                    name={['notifications', 'email']}
                    valuePropName="checked"
                    className="mb-2"
                  >
                    <div className="flex justify-between items-center">
                      <Text>Email Notifications</Text>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item
                    name={['notifications', 'browser']}
                    valuePropName="checked"
                    className="mb-2"
                  >
                    <div className="flex justify-between items-center">
                      <Text>Browser Notifications</Text>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item
                    name={['notifications', 'billReminders']}
                    valuePropName="checked"
                    className="mb-2"
                  >
                    <div className="flex justify-between items-center">
                      <Text>Bill Reminders</Text>
                      <Switch />
                    </div>
                  </Form.Item>
                </Space>
              </Col>
              <Col xs={24} md={12}>
                <Space direction="vertical" className="w-full">
                  <Form.Item
                    name={['notifications', 'quotationUpdates']}
                    valuePropName="checked"
                    className="mb-2"
                  >
                    <div className="flex justify-between items-center">
                      <Text>Quotation Updates</Text>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item
                    name={['notifications', 'systemUpdates']}
                    valuePropName="checked"
                    className="mb-2"
                  >
                    <div className="flex justify-between items-center">
                      <Text>System Updates</Text>
                      <Switch />
                    </div>
                  </Form.Item>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Dashboard Settings */}
          <Card type="inner" title={<><DashboardOutlined className="mr-2" />Dashboard</>} className="mb-6">
            <Row gutter={24}>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Default View"
                  name={['dashboard', 'defaultView']}
                  tooltip="Choose what page to show when you log in"
                >
                  <Select className="w-full">
                    <Option value="dashboard">Dashboard</Option>
                    <Option value="bills">Bills</Option>
                    <Option value="quotations">Quotations</Option>
                    <Option value="inventory">Inventory</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Items Per Page"
                  name={['dashboard', 'itemsPerPage']}
                  tooltip="Number of items to show in lists"
                >
                  <InputNumber min={5} max={100} className="w-full" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name={['dashboard', 'showWelcomeMessage']}
                  valuePropName="checked"
                  className="mt-8"
                >
                  <div className="flex justify-between items-center">
                    <Text>Show Welcome Message</Text>
                    <Switch />
                  </div>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Privacy Settings */}
          <Card type="inner" title={<><SecurityScanOutlined className="mr-2" />Privacy</>} className="mb-6">
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Profile Visibility"
                  name={['privacy', 'profileVisibility']}
                  tooltip="Control who can see your profile information"
                >
                  <Select className="w-full">
                    <Option value="private">Private</Option>
                    <Option value="team">Team Only</Option>
                    <Option value="public">Public</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name={['privacy', 'activityTracking']}
                  valuePropName="checked"
                  className="mb-2"
                >
                  <div className="flex justify-between items-center">
                    <Text>Activity Tracking</Text>
                    <Switch />
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Data Retention (days)"
                  name={['privacy', 'dataRetention']}
                  tooltip="How long to keep your activity data"
                >
                  <InputNumber min={30} max={2555} className="w-full" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Divider />

          <div className="flex justify-between items-center">
            <Text type="secondary" className="text-sm">
              Changes are saved automatically and take effect immediately
            </Text>

            <Space>
              <Button
                onClick={handleReset}
                disabled={saving}
                icon={<ReloadOutlined />}
              >
                Reset to Defaults
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
              >
                Save Preferences
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default UserPreferences;
