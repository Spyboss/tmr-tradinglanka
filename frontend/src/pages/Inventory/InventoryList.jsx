import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Tag, Space, Spin, Tooltip, Modal, message, Skeleton, Card } from 'antd';
import { SearchOutlined, PlusOutlined, ExportOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { getInventory, deleteInventory } from '../../services/inventoryService';
import { format } from 'date-fns';

const { Option } = Select;

const statusColors = {
  available: 'green',
  sold: 'blue',
  reserved: 'orange',
  damaged: 'red'
};

const InventoryList = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    sort: 'dateAdded',
    order: 'desc'
  });
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    fetchInventory();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      
      const response = await getInventory(params);
      
      setInventory(response.items);
      setPagination({
        ...pagination,
        total: response.pagination.total
      });
    } catch (error) {
      message.error('Failed to fetch inventory');
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (pagination, filters, sorter) => {
    setPagination({
      ...pagination,
      current: pagination.current
    });
    
    if (sorter && sorter.field) {
      setFilters({
        ...filters,
        sort: sorter.field,
        order: sorter.order === 'ascend' ? 'asc' : 'desc'
      });
    }
  };

  const handleSearch = (value) => {
    setFilters({
      ...filters,
      search: value
    });
    setPagination({
      ...pagination,
      current: 1
    });
  };

  const handleStatusFilter = (value) => {
    setFilters({
      ...filters,
      status: value
    });
    setPagination({
      ...pagination,
      current: 1
    });
  };

  const showDeleteModal = (item) => {
    setItemToDelete(item);
    setDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteInventory(itemToDelete._id);
      message.success('Inventory item deleted successfully');
      fetchInventory();
    } catch (error) {
      message.error('Failed to delete inventory item');
      console.error('Error deleting inventory item:', error);
    } finally {
      setLoading(false);
      setDeleteModalVisible(false);
      setItemToDelete(null);
    }
  };

  const columns = [
    {
      title: 'Bike Model',
      dataIndex: ['bikeModelId', 'name'],
      key: 'bikeModel',
      render: (text, record) => (
        <span>
          {record.bikeModelId?.name || 'N/A'}
          {record.bikeModelId?.is_tricycle && <Tag color="purple" className="ml-2">Tricycle</Tag>}
          {record.bikeModelId?.is_ebicycle && <Tag color="cyan" className="ml-2">E-Bicycle</Tag>}
        </span>
      )
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
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status] || 'default'}>
          {status?.toUpperCase() || 'UNKNOWN'}
        </Tag>
      )
    },
    {
      title: 'Date Added',
      dataIndex: 'dateAdded',
      key: 'dateAdded',
      render: (date) => date ? format(new Date(date), 'dd/MM/yyyy') : 'N/A',
      sorter: true
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => navigate(`/inventory/edit/${record._id}`)}
            />
          </Tooltip>
          {record.status !== 'sold' && (
            <Tooltip title="Delete">
              <Button 
                icon={<DeleteOutlined />} 
                size="small" 
                danger
                onClick={() => showDeleteModal(record)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="p-4 sm:p-6 dark:bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Bike Inventory</h1>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/inventory/add')}
          >
            Add Bike
          </Button>
          <Button 
            icon={<PlusOutlined />}
            onClick={() => navigate('/inventory/batch')}
          >
            Batch Add
          </Button>
          <Button 
            icon={<ExportOutlined />}
            onClick={() => navigate('/inventory/report')}
          >
            Inventory Report
          </Button>
        </Space>
      </div>

      <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 p-4 sm:p-6 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-3 sm:gap-4 mb-4">
          <Input.Search
            placeholder="Search motor or chassis number"
            onSearch={handleSearch}
            className="w-full sm:w-72"
            allowClear
          />
          <Select
            placeholder="Filter by status"
            className="w-full sm:w-52"
            onChange={handleStatusFilter}
            allowClear
          >
            <Option value="available">Available</Option>
            <Option value="sold">Sold</Option>
            <Option value="reserved">Reserved</Option>
            <Option value="damaged">Damaged</Option>
          </Select>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchInventory}
            className="w-full sm:w-auto"
          >
            Refresh
          </Button>
        </div>

        <div className="hidden md:block">
          <Table
            columns={columns}
            dataSource={inventory}
            rowKey="_id"
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} items`
            }}
            loading={loading}
            onChange={handleTableChange}
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
            inventory.map((item) => (
              <div key={item._id} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{item.bikeModelId?.name || 'N/A'}</div>
                    <div className="text-base font-medium text-gray-900 dark:text-gray-100">{item.chassisNumber}</div>
                  </div>
                  <Tag color={statusColors[item.status] || 'default'}>{(item.status || '').toUpperCase()}</Tag>
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between"><span>Motor</span><span>{item.motorNumber}</span></div>
                  <div className="flex justify-between"><span>Date</span><span>{item.dateAdded ? format(new Date(item.dateAdded), 'dd/MM/yyyy') : 'N/A'}</span></div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="small" onClick={() => navigate(`/inventory/edit/${item._id}`)}>Edit</Button>
                  {item.status !== 'sold' && (
                    <Button size="small" danger onClick={() => showDeleteModal(item)}>Delete</Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title="Delete Inventory Item"
        open={deleteModalVisible}
        onOk={handleDelete}
        onCancel={() => setDeleteModalVisible(false)}
        confirmLoading={loading}
        // Assuming Antd Modal will pick up dark theme from ConfigProvider. 
        // If not, specific styling for modal content might be needed if text is unreadable.
      >
        <p className="dark:text-gray-300">Are you sure you want to delete this inventory item?</p>
        {itemToDelete && (
          <div className="mt-2 dark:text-gray-300">
            <p><strong className="dark:text-gray-200">Model:</strong> {itemToDelete.bikeModelId?.name}</p>
            <p><strong className="dark:text-gray-200">Motor Number:</strong> {itemToDelete.motorNumber}</p>
            <p><strong className="dark:text-gray-200">Chassis Number:</strong> {itemToDelete.chassisNumber}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InventoryList;
