import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import apiClient from '../config/apiClient'
import { Table, Tag, Button, Space, Popconfirm, message, Spin, Input, Badge, Select, Skeleton, Card, DatePicker, InputNumber, AutoComplete } from 'antd'
import { PlusOutlined, SearchOutlined, DownloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined, FileExcelOutlined } from '@ant-design/icons'

const BillList = () => {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({ status: '', billType: '', dateRange: [], minAmount: null, maxAmount: null })
  const [suggestions, setSuggestions] = useState({ options: [] })
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bill_bookmarks') || '[]') } catch { return [] }
  })
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bill_view_history') || '[]') } catch { return [] }
  })

  useEffect(() => {
    // Reset to first page when filters or search text changes
    if (pagination.current !== 1) {
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  }, [filters, searchText]);

  useEffect(() => {
    fetchBills()
  }, [pagination.current, pagination.pageSize, filters, searchText])

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
        search: searchText || undefined
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

  const handleSuggest = async (value) => {
    try {
      setSearchText(value)
      if (!value) { setSuggestions({ options: [] }); return }
      const resp = await apiClient.get('/bills/suggestions', { params: { q: value } })
      const opts = []
      ;(resp.data?.customers || []).forEach(v => opts.push({ value: v }))
      ;(resp.data?.billNumbers || []).forEach(v => opts.push({ value: v }))
      ;(resp.data?.models || []).forEach(v => opts.push({ value: v }))
      setSuggestions({ options: opts })
    } catch {}
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

  const handlePreviewPDF = async (billId) => {
    try {
      const response = await apiClient.get(`/bills/${billId}/pdf?preview=true`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error previewing PDF:', error);
      toast.error('Failed to preview PDF: ' + (error.response?.data?.error || error.message || 'Server error'));
    }
  }

  const handleDownloadPDF = async (billId) => {
    try {
      const response = await apiClient.get(`/bills/${billId}/pdf`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
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
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '';
      
      // Use UTC methods to avoid timezone conversion issues
      const day = d.getUTCDate().toString().padStart(2, '0');
      const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      const year = d.getUTCFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
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
      await apiClient.patch(`/bills/${billId}`, { status: newStatus })
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

  const getBillTypeBadge = (type) => {
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
      title: 'Model',
      dataIndex: 'bikeModel',
      key: 'bikeModel',
    },
    {
      title: 'Type',
      dataIndex: 'billType',
      key: 'billType',
      render: (type) => getBillTypeBadge(type),
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Bills</h1>
        <div className="flex space-x-3">
          <AutoComplete
            value={searchText}
            options={suggestions.options}
            onSearch={handleSuggest}
            onChange={(val) => setSearchText(val)}
            style={{ width: 260 }}
          >
            <Input placeholder="Search bills..." prefix={<SearchOutlined />} />
          </AutoComplete>
          <DatePicker.RangePicker onChange={(v) => setFilters(prev => ({ ...prev, dateRange: v }))} />
          <InputNumber placeholder="Min" onChange={(v) => setFilters(prev => ({ ...prev, minAmount: v }))} />
          <InputNumber placeholder="Max" onChange={(v) => setFilters(prev => ({ ...prev, maxAmount: v }))} />
          <Select
            placeholder="Status"
            style={{ width: 120 }}
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
            style={{ width: 120 }}
            allowClear
            value={filters.billType || undefined}
            onChange={(v) => setFilters(prev => ({ ...prev, billType: v || '' }))}
            options={[
              { label: 'Cash', value: 'cash' },
              { label: 'Leasing', value: 'leasing' }
            ]}
          />
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/bills/new')}
            >
              Create Bill
            </Button>
          </Space>
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleExportToExcel}
          >
            Export
          </Button>
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
              <div className="mt-3 flex justify-end gap-2">
                <Button size="small" onClick={() => handlePreviewPDF(bill._id)}>Preview</Button>
                <Button size="small" onClick={() => navigate(`/bills/${bill._id}/edit`)}>Edit</Button>
                <Button size="small" onClick={() => handleDownloadPDF(bill._id)}>PDF</Button>
                <Button size="small" onClick={() => toggleBookmark(bill._id)}>{bookmarks.includes(bill._id) ? 'Unbookmark' : 'Bookmark'}</Button>
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
    </div>
  )
}

export default BillList
