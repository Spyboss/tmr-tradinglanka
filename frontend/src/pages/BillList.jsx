import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import apiClient from '../config/apiClient'
import { formatColomboDate } from '../utils/formatDate'
import { Table, Tag, Button, Space, Popconfirm, message, Spin, Input, Badge, Select, Skeleton, Card, DatePicker, InputNumber, Modal } from 'antd'
import { PlusOutlined, SearchOutlined, DownloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined, FileExcelOutlined, PrinterOutlined } from '@ant-design/icons'

const BillList = () => {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({ status: '', billType: '', dateRange: [], minAmount: null, maxAmount: null })
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bill_bookmarks') || '[]') } catch { return [] }
  })
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bill_view_history') || '[]') } catch { return [] }
  })

  const debounceSearch = useCallback((value) => {
    const timer = setTimeout(() => setDebouncedSearch(value), 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const cleanup = debounceSearch(searchText)
    return cleanup
  }, [searchText, debounceSearch])

  useEffect(() => {
    if (pagination.current !== 1) {
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  }, [filters, debouncedSearch]);

  useEffect(() => {
    fetchBills()
  }, [pagination.current, pagination.pageSize, filters, debouncedSearch])

  const fetchBills = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status || undefined,
        billType: filters.billType || undefined,
        startDate: filters.dateRange?.[0]?.toISOString?.(),
        endDate: filters.dateRange?.[1]?.toISOString?.(),
        minAmount: filters.minAmount ?? undefined,
        maxAmount: filters.maxAmount ?? undefined,
        search: debouncedSearch || undefined
      }
      const response = await apiClient.get('/bills', { params })

      // Handle the new response format which includes pagination
      let billsData = [];

      // Check for the actual response format we're getting
      if (response && response.bills && Array.isArray(response.bills)) {
        console.log('Using bills directly from response')
        billsData = response.bills;
      } else if (response.data && response.data.bills) {
        // New format with pagination in data property
        console.log('Using bills from response.data')
        billsData = response.data.bills;
      } else if (response.data && Array.isArray(response.data)) {
        // Old format (direct array)
        console.log('Using response.data as array')
        billsData = response.data;
      } else if (Array.isArray(response)) {
        // Direct array response
        console.log('Using response directly as array')
        billsData = response;
      } else {
        console.error('Invalid response format from API:', response)
        toast.error('Failed to fetch bills: Invalid response format')
        setBills([])
        return
      }

      // Transform the data for compatibility
      const transformedBills = billsData.map(bill => ({
        ...bill,
        id: bill._id || bill.id,
        key: bill._id || bill.id || Math.random().toString()
      }))

      setBills(transformedBills)
      const meta = response.data || response
      const total = meta.total ?? meta.pagination?.total ?? 0
      const currentPage = meta.currentPage ?? meta.pagination?.page ?? pagination.current
      setPagination(prev => ({ ...prev, total: total }))
    } catch (error) {
      console.error('Error fetching bills:', error)
      toast.error(`Failed to fetch bills: ${error.message || 'Server error'}`)
      setBills([])
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page, pageSize) => {
    setPagination({ current: page, pageSize, total: pagination.total })
  }

  const handleSearch = (value) => {
    setSearchText(value)
  }

  const toggleBookmark = (billId) => {
    setBookmarks(prev => {
      const next = prev.includes(billId) ? prev.filter(id => id !== billId) : [...prev, billId]
      localStorage.setItem('bill_bookmarks', JSON.stringify(next))
      return next
    })
  }

  const pushHistory = (billId) => {
    setHistory(prev => {
      const next = [billId, ...prev.filter(id => id !== billId)].slice(0, 10)
      localStorage.setItem('bill_view_history', JSON.stringify(next))
      return next
    })
  }

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const closePreview = () => {
    setPreviewVisible(false);
    URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  };

  const handlePreviewPDF = async (billId) => {
    try {
      const blob = await apiClient.get(`/bills/${billId}/pdf?preview=true`, {
        responseType: 'blob'
      });

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewVisible(true);
    } catch (error) {
      console.error('Error previewing PDF:', error);
      toast.error('Failed to preview PDF: ' + (error.response?.data?.error || error.message || 'Server error'));
    }
  }

  const handleDownloadPDF = async (billId) => {
    try {
      const blob = await apiClient.get(`/bills/${billId}/pdf`, {
        responseType: 'blob'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bill-${billId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF: ' + (error.response?.data?.error || error.message || 'Server error'));
    }
  }

  const handleDelete = async (billId) => {
    try {
      setLoading(true)
      await apiClient.delete(`/bills/${billId}`)
      toast.success('Bill deleted successfully')
      fetchBills()
    } catch (error) {
      console.error('Error deleting bill:', error)
      toast.error(`Failed to delete bill: ${error.message || 'Server error'}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return formatColomboDate(dateString);
  }

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: 'processing',
      completed: 'success',
      cancelled: 'error',
      converted: 'warning'
    };
    return statusMap[status?.toLowerCase()] || 'default';
  }

  const handleStatusChange = async (billId, newStatus) => {
    try {
      await apiClient.patch(`/bills/${billId}/status`, { status: newStatus })
      toast.success(`Bill marked as ${newStatus}`);
      fetchBills();
    } catch (error) {
      console.error('Error updating bill status:', error);
      toast.error('Failed to update bill status');
    }
  }

  const handleExportToExcel = async () => {
    try {
      const blob = await apiClient.get('/bills/export', {
        responseType: 'blob'
      })

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `Bills-Export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Bills exported to Excel successfully');
    } catch (error) {
      console.error('Error exporting bills:', error);
      toast.error('Failed to export bills');
    }
  };

  const getBillTypeBadge = (record) => {
    if (record?.isAdvancePayment) {
      return <Tag color="orange">Advance Payment</Tag>;
    }

    const type = record?.billType;
    if (!type) return <Tag color="default">Unknown</Tag>;

    const typeMap = {
      cash: { color: 'green', text: 'Cash' },
      leasing: { color: 'blue', text: 'Leasing' },
      advance: { color: 'orange', text: 'Advance Payment' },
      advancement: { color: 'orange', text: 'Advance Payment' }
    };

    const typeInfo = typeMap[type.toLowerCase()] || { color: 'default', text: type };
    return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
  };

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return 'Rs. 0';
    const numericAmount = parseFloat(amount);
    return isNaN(numericAmount) ? 'Rs. 0' : `Rs. ${numericAmount.toLocaleString()}`;
  };

  

  const getBillTypeTag = (record) => {
    if (record.isAdvancePayment) {
      return <Tag color="orange">{`Advance ${record.billType}`}</Tag>;
    }
    return <Tag color={record.billType?.toLowerCase() === 'cash' ? 'green' : 'blue'}>
      {record.billType?.toUpperCase() || 'CASH'}
    </Tag>;
  };

  const columns = [
    {
      title: 'Bill #',
      dataIndex: 'billNumber',
      key: 'billNumber',
      render: (billNumber, record) => (
        <Link to={`/bills/${record._id}`} className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
          {billNumber || record._id.substring(0, 8)}
        </Link>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: 'Phone',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      render: (phone) => phone || '-',
    },
    {
      title: 'Model',
      dataIndex: 'bikeModel',
      key: 'bikeModel',
    },
    {
      title: 'Type',
      dataIndex: 'billType',
      key: 'billType',
      render: (_, record) => getBillTypeBadge(record),
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => formatAmount(amount),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Select
          value={status || 'pending'}
          onChange={(newStatus) => handleStatusChange(record._id, newStatus)}
          size="small"
          style={{ width: 120 }}
          options={[
            { label: 'Pending', value: 'pending' },
            { label: 'Completed', value: 'completed' },
            { label: 'Cancelled', value: 'cancelled' },
            { label: 'Converted', value: 'converted' }
          ]}
        />
      ),
    },
    {
      title: 'Inventory',
      key: 'inventory',
      render: (_, record) => (
        record.inventoryItemId ? (
          <Tag color="green">From Inventory</Tag>
        ) : (
          <Tag color="orange">Manual Entry</Tag>
        )
      ),
    },
    {
      title: 'Date',
      dataIndex: 'billDate',
      key: 'billDate',
      render: (date, record) => {
        // Use billDate if available, otherwise fall back to createdAt
        const dateToFormat = date || record.createdAt;
        return formatDate(dateToFormat);
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click
              handlePreviewPDF(record._id);
            }}
            title="Preview"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click
              navigate(`/bills/${record._id}/edit`);
            }}
            title="Edit"
          />
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click
              handleDownloadPDF(record._id);
            }}
            title="Download"
          />
          <Button
            type="text"
            onClick={(e) => { e.stopPropagation(); toggleBookmark(record._id) }}
          >{bookmarks.includes(record._id) ? 'Unbookmark' : 'Bookmark'}</Button>
          <Popconfirm
            title="Are you sure you want to delete this bill?"
            onConfirm={(e) => {
              e.stopPropagation(); // Prevent row click
              handleDelete(record._id);
            }}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Delete"
              onClick={(e) => e.stopPropagation()} // Prevent row click
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 dark:bg-slate-900 min-h-full">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Bills</h1>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <Input.Search
            placeholder="Search by customer, bill no, phone, chassis..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(value) => setDebouncedSearch(value)}
            className="w-full sm:w-80"
            allowClear
            enterButton
          />
          <DatePicker.RangePicker
            className="w-full sm:w-auto"
            onChange={(v) => setFilters(prev => ({ ...prev, dateRange: v }))}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <InputNumber placeholder="Min" className="w-full" onChange={(v) => setFilters(prev => ({ ...prev, minAmount: v }))} />
            <InputNumber placeholder="Max" className="w-full" onChange={(v) => setFilters(prev => ({ ...prev, maxAmount: v }))} />
          </div>
          <Select
            placeholder="Status"
            className="w-full sm:w-[120px]"
            allowClear
            value={filters.status || undefined}
            onChange={(v) => setFilters(prev => ({ ...prev, status: v || '' }))}
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Completed', value: 'completed' },
              { label: 'Cancelled', value: 'cancelled' },
              { label: 'Converted', value: 'converted' }
            ]}
          />
          <Select
            placeholder="Type"
            className="w-full sm:w-[120px]"
            allowClear
            value={filters.billType || undefined}
            onChange={(v) => setFilters(prev => ({ ...prev, billType: v || '' }))}
            options={[
              { label: 'Cash', value: 'cash' },
              { label: 'Leasing', value: 'leasing' },
              { label: 'Advance Payment', value: 'advance' }
            ]}
          />
          <div className="flex gap-2">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="flex-1 sm:flex-none"
              onClick={() => navigate('/bills/new')}
            >
              Create Bill
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportToExcel}
            >
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        {loading ? (
          <div className="flex justify-center p-12">
            <Spin size="large" />
          </div>
        ) : (
          <Table
            rowKey="_id"
            dataSource={bills}
            columns={columns}
            scroll={{ x: 'max-content' }}
            pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, onChange: handlePageChange }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow dark:border dark:border-gray-700"
            onRow={(record) => ({
              onClick: () => { pushHistory(record._id); navigate(`/bills/${record._id}`) },
              style: { cursor: 'pointer' }
            })}
          />
        )}
      </div>

      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="dark:bg-slate-800">
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          ))
        ) : (
          bills.map((bill) => (
            <div key={bill._id} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{bill.billNumber || bill._id.substring(0,8)}</div>
                  <div className="text-base font-medium text-gray-900 dark:text-gray-100">{bill.customerName}</div>
                </div>
                {getBillTypeTag(bill)}
              </div>
              <div className="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>{formatAmount(bill.totalAmount)}</span>
                <span>{formatDate(bill.billDate || bill.createdAt)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => handlePreviewPDF(bill._id)}>Preview</Button>
                <Button onClick={() => navigate(`/bills/${bill._id}/edit`)}>Edit</Button>
                <Button onClick={() => handleDownloadPDF(bill._id)}>PDF</Button>
                <Button onClick={() => toggleBookmark(bill._id)}>{bookmarks.includes(bill._id) ? 'Unbookmark' : 'Bookmark'}</Button>
                <Popconfirm
                  title="Are you sure you want to delete this bill?"
                  onConfirm={() => handleDelete(bill._id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button danger>Delete</Button>
                </Popconfirm>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm">Recent:</div>
        <Space wrap>
          {history.map(id => (
            <Tag key={id} onClick={() => navigate(`/bills/${id}`)} style={{ cursor: 'pointer' }}>{id.slice(0,8)}</Tag>
          ))}
        </Space>
      </div>

      <div className="mt-2">
        <div className="mb-2 text-sm">Bookmarks:</div>
        <Space wrap>
          {bookmarks.map(id => (
            <Tag key={id} color="gold" onClick={() => navigate(`/bills/${id}`)} style={{ cursor: 'pointer' }}>{id.slice(0,8)}</Tag>
          ))}
        </Space>
      </div>

      <Modal
        title="Bill Preview"
        open={previewVisible}
        onCancel={closePreview}
        width="min(96vw, 800px)"
        footer={[
          <Button key="close" onClick={closePreview}>Close</Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => {
              const printFrame = document.getElementById('bill-preview-frame');
              if (printFrame) printFrame.contentWindow.print();
            }}
          >
            Print
          </Button>,
        ]}
      >
        <div className="h-[70vh] sm:h-[700px]">
          <iframe
            id="bill-preview-frame"
            src={previewUrl}
            title="Bill Preview"
            className="w-full h-full border-0"
          />
        </div>
      </Modal>
    </div>
  )
}

export default BillList
