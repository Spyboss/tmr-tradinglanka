import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Select, Tag, Popconfirm, message, Skeleton, Card } from 'antd';
import { PlusOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../config/apiClient';
import moment from 'moment';

const { Option } = Select;

const WarrantyClaimList = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: ''
  });

  useEffect(() => {
    fetchClaims();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    const handleFocus = () => fetchClaims();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await apiClient.get('/warranty-claims', { params });
      setClaims(response.claims || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0
      }));
    } catch (error) {
      message.error('Failed to fetch warranty claims');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/warranty-claims/${id}`);
      message.success('Warranty claim deleted successfully');
      fetchClaims();
    } catch (error) {
      message.error('Failed to delete warranty claim');
    }
  };

  const handleDownloadPDF = async (id, warrantyNumber) => {
    try {
      const blob = await apiClient.get(`/warranty-claims/${id}/pdf`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TMR_Warranty_${warrantyNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('PDF downloaded successfully');
    } catch (error) {
      message.error('Failed to download PDF');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      completed: 'green',
      cancelled: 'red'
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'Warranty No',
      dataIndex: 'warrantyNumber',
      key: 'warrantyNumber',
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/warranty-claims/${record._id}`)}>
          {text}
        </Button>
      )
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (text) => text || '-'
    },
    {
      title: 'Chassis No',
      dataIndex: 'chassisNumber',
      key: 'chassisNumber',
      render: (text) => text || '-'
    },
    {
      title: 'Motor No',
      dataIndex: 'motorNumber',
      key: 'motorNumber',
      render: (text) => text || '-'
    },
    {
      title: 'Date',
      dataIndex: 'warrantyDate',
      key: 'warrantyDate',
      render: (date) => date ? moment(date).format('DD/MM/YYYY') : '-'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{(status || '').toUpperCase()}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/warranty-claims/${record._id}`)}
            title="View"
          />
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadPDF(record._id, record.warrantyNumber)}
            title="Download PDF"
          />
          <Popconfirm
            title="Are you sure you want to delete this warranty claim?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} title="Delete" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-4 sm:p-6 dark:bg-slate-900 min-h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Warranty Claims</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/warranty-claims/new')}
        >
          New Warranty Claim
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          placeholder="Search warranty claims..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          prefix={<SearchOutlined />}
          allowClear
        />
        <Select
          placeholder="Filter by status"
          value={filters.status}
          onChange={(value) => handleFilterChange('status', value)}
          allowClear
        >
          <Option value="pending">Pending</Option>
          <Option value="completed">Completed</Option>
          <Option value="cancelled">Cancelled</Option>
        </Select>
        <Button onClick={fetchClaims}>Refresh</Button>
      </div>

      <div className="hidden md:block">
        <Table
          columns={columns}
          dataSource={claims}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} warranty claims`
          }}
          onChange={handleTableChange}
          rowKey="_id"
          scroll={{ x: 900 }}
        />
      </div>

      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="dark:bg-slate-800">
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          ))
        ) : (
          claims.map((c) => (
            <div key={c._id} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">#{c.warrantyNumber}</div>
                  <div className="text-base font-medium text-gray-900 dark:text-gray-100">{c.customerName || 'N/A'}</div>
                </div>
                <Tag color={getStatusColor(c.status)}>{(c.status || '').toUpperCase()}</Tag>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {c.chassisNumber && <span>Chassis: {c.chassisNumber} | </span>}
                {c.motorNumber && <span>Motor: {c.motorNumber}</span>}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="small" onClick={() => navigate(`/warranty-claims/${c._id}`)}>View</Button>
                <Button size="small" onClick={() => handleDownloadPDF(c._id, c.warrantyNumber)}>PDF</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WarrantyClaimList;
