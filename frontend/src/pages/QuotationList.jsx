import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Select, Tag, Popconfirm, message, Modal, Skeleton, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/apiClient';
import toast from 'react-hot-toast';
import moment from 'moment';

const { Option } = Select;

const QuotationList = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    type: ''
  });

  useEffect(() => {
    fetchQuotations();
  }, [pagination.current, pagination.pageSize, filters]);

  // Refresh data when component comes back into focus
  useEffect(() => {
    const handleFocus = () => {
      fetchQuotations();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await apiClient.get('/quotations', { params });

      setQuotations(response.quotations || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0
      }));
    } catch (error) {
      console.error('Error fetching quotations:', error);
      toast.error('Failed to fetch quotations');
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
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({
      ...prev,
      current: 1
    }));
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/quotations/${id}`);
      toast.success('Quotation deleted successfully');
      fetchQuotations();
    } catch (error) {
      console.error('Error deleting quotation:', error);
      toast.error('Failed to delete quotation');
    }
  };

  const handleDownloadPDF = async (id, quotationNumber) => {
    try {
      const response = await apiClient.get(`/quotations/${id}/pdf`, {
        responseType: 'blob'
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GM_Quotation_${quotationNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const handleConvertToInvoice = async (id) => {
    try {
      const response = await apiClient.post(`/quotations/${id}/convert-to-invoice`);
      toast.success('Quotation converted to invoice successfully');
      // Refresh the list to show updated status
      await fetchQuotations();
      navigate(`/quotations/${response._id || response.id}`);
    } catch (error) {
      console.error('Error converting to invoice:', error);
      toast.error('Failed to convert to invoice');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      sent: 'blue',
      accepted: 'green',
      rejected: 'red',
      converted: 'purple'
    };
    return colors[status] || 'default';
  };

  const getTypeColor = (type) => {
    return type === 'invoice' ? 'orange' : 'blue';
  };

  const columns = [
    {
      title: 'Quotation No',
      dataIndex: 'quotationNumber',
      key: 'quotationNumber',
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => navigate(`/quotations/${record._id}`)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={getTypeColor(type)}>
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: 'Date',
      dataIndex: 'quotationDate',
      key: 'quotationDate',
      render: (date) => moment(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Total Amount (LKR)',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 160,
      render: (amount) => amount.toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Claim No',
      dataIndex: 'claimNumber',
      key: 'claimNumber',
      render: (text) => text || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/quotations/${record._id}`)}
            title="View"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/quotations/${record._id}/edit`)}
            title="Edit"
          />
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadPDF(record._id, record.quotationNumber)}
            title="Download PDF"
          />
          {record.type === 'quotation' && record.status !== 'converted' && (
            <Popconfirm
              title="Convert to Invoice"
              description="Are you sure you want to convert this quotation to an invoice?"
              onConfirm={() => handleConvertToInvoice(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                icon={<FileTextOutlined />}
                title="Convert to Invoice"
              />
            </Popconfirm>
          )}
          <Popconfirm
            title="Are you sure you want to delete this quotation?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Delete"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 dark:bg-slate-900 min-h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Quotations & Invoices</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/quotations/new')}
        >
          New Quotation
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input
          placeholder="Search quotations..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          prefix={<SearchOutlined />}
          allowClear
        />
        <Select
          placeholder="Filter by type"
          value={filters.type}
          onChange={(value) => handleFilterChange('type', value)}
          allowClear
        >
          <Option value="quotation">Quotation</Option>
          <Option value="invoice">Invoice</Option>
        </Select>
        <Select
          placeholder="Filter by status"
          value={filters.status}
          onChange={(value) => handleFilterChange('status', value)}
          allowClear
        >
          <Option value="draft">Draft</Option>
          <Option value="sent">Sent</Option>
          <Option value="accepted">Accepted</Option>
          <Option value="rejected">Rejected</Option>
          <Option value="converted">Converted</Option>
        </Select>
        <Button onClick={fetchQuotations}>
          Refresh
        </Button>
      </div>

      <div className="hidden md:block">
        <Table
          columns={columns}
          dataSource={quotations}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} quotations`,
          }}
          onChange={handleTableChange}
          rowKey="_id"
          scroll={{ x: 1200 }}
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
          quotations.map((q) => (
            <div key={q._id} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">#{q.quotationNumber}</div>
                  <div className="text-base font-medium text-gray-900 dark:text-gray-100">{q.customerName}</div>
                </div>
                <Tag color={getStatusColor(q.status)}>{(q.status || '').toUpperCase()}</Tag>
              </div>
              <div className="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>{q.type?.toUpperCase()}</span>
                <span>{q.totalAmount?.toLocaleString()} LKR</span>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="small" onClick={() => navigate(`/quotations/${q._id}`)}>View</Button>
                <Button size="small" onClick={() => navigate(`/quotations/${q._id}/edit`)}>Edit</Button>
                <Button size="small" onClick={() => handleDownloadPDF(q._id, q.quotationNumber)}>PDF</Button>
                {q.type === 'quotation' && q.status !== 'converted' && (
                  <Button size="small" onClick={() => handleConvertToInvoice(q._id)}>Convert</Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QuotationList;
