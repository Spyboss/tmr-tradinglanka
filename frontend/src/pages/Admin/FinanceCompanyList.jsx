import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Space, Card, Typography, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import financeCompanyService from '../../services/financeCompanyService';

const { Title } = Typography;

const FinanceCompanyList = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await financeCompanyService.getAllFinanceCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(err.message || 'Failed to fetch finance companies');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const openAddModal = () => {
    setEditingCompany(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (company) => {
    setEditingCompany(company);
    form.setFieldsValue({
      name: company.name,
      address: company.address,
      contact: company.contact,
    });
    setModalOpen(true);
  };

  const handleSave = async (values) => {
    try {
      setSaving(true);
      if (editingCompany) {
        await financeCompanyService.updateFinanceCompany(editingCompany._id, values);
        message.success('Finance company updated');
      } else {
        await financeCompanyService.createFinanceCompany(values);
        message.success('Finance company created');
      }
      setModalOpen(false);
      fetchCompanies();
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Operation failed';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await financeCompanyService.deleteFinanceCompany(id);
      message.success('Finance company deleted');
      fetchCompanies();
    } catch (err) {
      message.error(err.message || 'Failed to delete');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      width: 240,
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: 'Contact',
      dataIndex: 'contact',
      key: 'contact',
      width: 140,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this finance company?"
            description="This cannot be undone."
            onConfirm={() => handleDelete(record._id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
            />
            <Title level={4} className="!mb-0">Finance Companies</Title>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            Add Company
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table
            dataSource={companies}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={false}
          />
        </div>
      </Card>

      <Modal
        title={editingCompany ? 'Edit Finance Company' : 'Add Finance Company'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="Company Name"
            rules={[{ required: true, message: 'Company name is required' }]}
          >
            <Input placeholder="e.g., HNB FINANCE PLC" />
          </Form.Item>

          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Address is required' }]}
          >
            <Input.TextArea rows={2} placeholder="Company address" />
          </Form.Item>

          <Form.Item
            name="contact"
            label="Contact Number"
            rules={[{ required: true, message: 'Contact number is required' }]}
          >
            <Input placeholder="e.g., 0770550898" />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {editingCompany ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default FinanceCompanyList;
