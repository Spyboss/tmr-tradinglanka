import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Select,
  DatePicker,
  Button,
  message,
  Typography,
  Space,
  Tag,
  Tooltip,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  HistoryOutlined,
  FilterOutlined,
  ReloadOutlined,
  DeleteOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';
import apiClient from '../../config/apiClient';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const UserActivity = () => {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    type: null,
    dateRange: null
  });

  useEffect(() => {
    fetchActivities();
    fetchStats();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchActivities = async () => {
    try {
      setLoading(true);

      const params = {
        page: pagination.current,
        limit: pagination.pageSize
      };

      if (filters.type) params.type = filters.type;
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0].toISOString();
        params.endDate = filters.dateRange[1].toISOString();
      }

      const response = await apiClient.get('/api/user/activity', { params });

      if (response.activities) {
        setActivities(response.activities);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total
        }));
      }
    } catch (error) {
      console.error('Fetch activities error:', error);
      message.error('Failed to load activity history');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/api/user/activity/stats');
      if (response.stats) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({
      ...prev,
      current: 1
    }));
  };

  const clearFilters = () => {
    setFilters({
      type: null,
      dateRange: null
    });
    setPagination(prev => ({
      ...prev,
      current: 1
    }));
  };

  const getActivityIcon = (type) => {
    const iconMap = {
      login: '🔐',
      logout: '🚪',
      profile_update: '👤',
      password_change: '🔑',
      bill_create: '📄',
      bill_update: '✏️',
      bill_delete: '🗑️',
      quotation_create: '📋',
      quotation_update: '✏️',
      quotation_delete: '🗑️',
      inventory_create: '📦',
      inventory_update: '✏️',
      inventory_delete: '🗑️',
      settings_update: '⚙️'
    };
    return iconMap[type] || '📝';
  };

  const getActivityColor = (type) => {
    const colorMap = {
      login: 'green',
      logout: 'orange',
      profile_update: 'blue',
      password_change: 'purple',
      bill_create: 'cyan',
      bill_update: 'blue',
      bill_delete: 'red',
      quotation_create: 'cyan',
      quotation_update: 'blue',
      quotation_delete: 'red',
      inventory_create: 'cyan',
      inventory_update: 'blue',
      inventory_delete: 'red',
      settings_update: 'geekblue'
    };
    return colorMap[type] || 'default';
  };

  const columns = [
    {
      title: 'Activity',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => (
        <Space>
          <span className="text-lg">{getActivityIcon(type)}</span>
          <div>
            <div className="font-medium">{record.description}</div>
            <Tag color={getActivityColor(type)} size="small">
              {type.replace('_', ' ').toUpperCase()}
            </Tag>
          </div>
        </Space>
      )
    },
    {
      title: 'Details',
      dataIndex: 'metadata',
      key: 'metadata',
      render: (metadata) => {
        if (!metadata) return '-';

        const details = [];
        if (metadata.resourceId) details.push(`ID: ${metadata.resourceId}`);
        if (metadata.ipAddress) details.push(`IP: ${metadata.ipAddress}`);

        return details.length > 0 ? (
          <Tooltip title={JSON.stringify(metadata, null, 2)}>
            <Text type="secondary" className="text-sm">
              {details.join(' • ')}
            </Text>
          </Tooltip>
        ) : '-';
      }
    },
    {
      title: 'Date & Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => (
        <div>
          <div>{format(new Date(timestamp), 'MMM dd, yyyy')}</div>
          <Text type="secondary" className="text-sm">
            {format(new Date(timestamp), 'HH:mm:ss')}
          </Text>
        </div>
      ),
      sorter: true
    }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Statistics Cards */}
      {stats && (
        <Row gutter={16} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Activities"
                value={stats.totalActivities}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Period"
                value={stats.period}
                prefix={<HistoryOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Most Active"
                value={stats.byType[0]?.count || 0}
                suffix={stats.byType[0]?._id?.replace('_', ' ') || 'N/A'}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Daily Average"
                value={Math.round(stats.totalActivities / 30)}
                suffix="activities"
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card className="shadow-sm">
        <div className="mb-6">
          <Title level={3} className="mb-2">
            <HistoryOutlined className="mr-2" />
            Activity History
          </Title>
          <Text type="secondary">
            Track your account activity and system interactions
          </Text>
        </div>

        {/* Filters */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Row gutter={16} align="middle">
            <Col xs={24} sm={8} md={6}>
              <Select
                placeholder="Filter by type"
                value={filters.type}
                onChange={(value) => handleFilterChange('type', value)}
                allowClear
                className="w-full"
              >
                <Option value="login">Login</Option>
                <Option value="logout">Logout</Option>
                <Option value="profile_update">Profile Update</Option>
                <Option value="password_change">Password Change</Option>
                <Option value="bill_create">Bill Created</Option>
                <Option value="bill_update">Bill Updated</Option>
                <Option value="quotation_create">Quotation Created</Option>
                <Option value="quotation_update">Quotation Updated</Option>
                <Option value="inventory_create">Inventory Added</Option>
                <Option value="settings_update">Settings Updated</Option>
              </Select>
            </Col>
            <Col xs={24} sm={10} md={8}>
              <RangePicker
                value={filters.dateRange}
                onChange={(dates) => handleFilterChange('dateRange', dates)}
                className="w-full"
              />
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Space>
                <Button
                  icon={<FilterOutlined />}
                  onClick={clearFilters}
                >
                  Clear
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchActivities}
                  loading={loading}
                >
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={activities}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} activities`
          }}
          onChange={handleTableChange}
          rowKey="_id"
          className="dark:bg-gray-800"
        />
      </Card>
    </div>
  );
};

export default UserActivity;
