import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, DatePicker, InputNumber, Switch, message, Modal, Table, Space, Card, Divider, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../config/apiClient';
import toast from 'react-hot-toast';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

const QuotationEdit = () => {
  const { id } = useParams();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quotation, setQuotation] = useState(null);
  const [items, setItems] = useState([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  // Calculate total amount whenever items change
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    setTotalAmount(total);
  }, [items]);

  const fetchQuotation = async () => {
    try {
      const response = await apiClient.get(`/quotations/${id}`);
      setQuotation(response);
      setItems(response.items || [{ description: '', quantity: 1, rate: 0, amount: 0 }]);

      // Set form values
      form.setFieldsValue({
        ...response,
        quotationDate: response.quotationDate ? moment(response.quotationDate) : moment(),
        validUntil: response.validUntil ? moment(response.validUntil) : null,
        accidentDate: response.accidentDate ? moment(response.accidentDate) : null
      });
    } catch (error) {
      console.error('Error fetching quotation:', error);
      toast.error('Failed to fetch quotation details');
      navigate('/quotations');
    } finally {
      setLoading(false);
    }
  };

  // Search for existing customers
  const searchCustomers = async (searchText) => {
    if (!searchText || searchText.length < 2) {
      setCustomerSuggestions([]);
      return;
    }

    setCustomerSearchLoading(true);
    try {
      const response = await apiClient.get(`/quotations/customers/suggestions?search=${searchText}`);
      setCustomerSuggestions(response || []);
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setCustomerSearchLoading(false);
    }
  };

  // Handle customer selection
  const handleCustomerSelect = (customerId) => {
    const customer = customerSuggestions.find(c => c._id === customerId);
    if (customer) {
      form.setFieldsValue({
        customerName: customer.customerName,
        customerNIC: customer.customerNIC,
        customerAddress: customer.customerAddress,
        referenceBillId: customer._id
      });
    }
  };

  // Handle item changes
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // Calculate amount for this item
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }

    setItems(newItems);
  };

  // Add new item
  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  // Remove item
  const removeItem = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  // Handle form submission
  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      // Validate items
      const validItems = items.filter(item => item.description && item.quantity > 0 && item.rate >= 0);

      if (validItems.length === 0) {
        toast.error('Please add at least one valid item');
        setSaving(false);
        return;
      }

      const quotationData = {
        ...values,
        items: validItems,
        totalAmount,
        quotationDate: values.quotationDate ? values.quotationDate.toDate() : new Date(),
        validUntil: values.validUntil ? values.validUntil.toDate() : null,
        accidentDate: values.accidentDate ? values.accidentDate.toDate() : null
      };

      console.log('Updating quotation data:', quotationData);

      await apiClient.put(`/quotations/${id}`, quotationData);

      toast.success('Quotation updated successfully');
      navigate(`/quotations/${id}`);
    } catch (error) {
      console.error('Error updating quotation:', error);
      toast.error('Failed to update quotation');
    } finally {
      setSaving(false);
    }
  };

  const itemColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text, record, index) => (
        <Input
          value={text}
          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
          placeholder="Item description"
        />
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (text, record, index) => (
        <InputNumber
          value={text}
          onChange={(value) => handleItemChange(index, 'quantity', value || 1)}
          min={1}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Rate (LKR)',
      dataIndex: 'rate',
      key: 'rate',
      width: 130,
      render: (text, record, index) => (
        <InputNumber
          value={text}
          onChange={(value) => handleItemChange(index, 'rate', value || 0)}
          min={0}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value.replace(/\$\s?|(,*)/g, '')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Amount (LKR)',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (text) => (
        <span>{text.toLocaleString()}</span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (text, record, index) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(index)}
          disabled={items.length === 1}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 dark:bg-slate-900">
        <Spin size="large" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Quotation not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">The quotation you're looking for doesn't exist.</p>
          <Button
            type="primary"
            onClick={() => navigate('/quotations')}
            className="mt-4"
          >
            Back to Quotations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 dark:bg-slate-800 rounded-lg shadow-lg">
      <div className="flex items-center space-x-4 mb-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/quotations/${id}`)}
        >
          Back to View
        </Button>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Edit {quotation.type === 'invoice' ? 'Invoice' : 'Quotation'} - {quotation.quotationNumber}
        </h1>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div>
            <Card title="Document Details" className="mb-6">
              <Form.Item
                name="type"
                label="Document Type"
                rules={[{ required: true }]}
              >
                <Select disabled>
                  <Option value="quotation">Quotation</Option>
                  <Option value="invoice">Invoice</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="quotationDate"
                label="Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="validUntil"
                label="Valid Until (Optional)"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="status"
                label="Status"
              >
                <Select>
                  <Option value="draft">Draft</Option>
                  <Option value="sent">Sent</Option>
                  <Option value="accepted">Accepted</Option>
                  <Option value="rejected">Rejected</Option>
                  <Option value="converted">Converted</Option>
                </Select>
              </Form.Item>
            </Card>

            <Card title="Customer Details" className="mb-6">
              <Form.Item
                label="Search Existing Customer"
              >
                <Select
                  showSearch
                  placeholder="Search by name or NIC"
                  onSearch={searchCustomers}
                  onSelect={handleCustomerSelect}
                  loading={customerSearchLoading}
                  filterOption={false}
                  allowClear
                >
                  {customerSuggestions.map(customer => (
                    <Option key={customer._id} value={customer._id}>
                      {customer.customerName} - {customer.billNumber}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="customerName"
                label="Customer Name"
                rules={[{ required: true, message: 'Please enter customer name' }]}
              >
                <Input placeholder="Customer name" />
              </Form.Item>

              <Form.Item
                name="customerNIC"
                label="Customer NIC (Optional)"
              >
                <Input placeholder="Customer NIC" />
              </Form.Item>

              <Form.Item
                name="customerAddress"
                label="Customer Address"
                rules={[{ required: true, message: 'Please enter customer address' }]}
              >
                <TextArea rows={3} placeholder="Customer address" />
              </Form.Item>

              <Form.Item
                name="customerPhone"
                label="Customer Phone (Optional)"
              >
                <Input placeholder="Customer phone" />
              </Form.Item>

              <Form.Item
                name="bikeRegNo"
                label="Bike Registration No (Optional)"
              >
                <Input placeholder="Bike registration number" />
              </Form.Item>

              <Form.Item name="referenceBillId" hidden>
                <Input />
              </Form.Item>
            </Card>
          </div>

          {/* Right Column */}
          <div>
            <Card title="Insurance/Accident Details (Optional)" className="mb-6">
              <Form.Item
                name="claimNumber"
                label="Claim Number"
              >
                <Input placeholder="Insurance claim number" />
              </Form.Item>

              <Form.Item
                name="insuranceCompany"
                label="Insurance Company"
              >
                <Input placeholder="Insurance company name" />
              </Form.Item>

              <Form.Item
                name="accidentDate"
                label="Accident Date"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            <Card title="Additional Details" className="mb-6">
              <Form.Item
                name="remarks"
                label="Remarks"
              >
                <TextArea rows={4} placeholder="Additional remarks" />
              </Form.Item>
            </Card>
          </div>
        </div>

        {/* Items Section */}
        <Card title="Items" className="mb-6">
          <Table
            dataSource={items}
            columns={itemColumns}
            pagination={false}
            rowKey={(record, index) => index}
            className="mb-4"
          />

          <div className="flex justify-between items-center mb-4">
            <Button
              type="dashed"
              onClick={addItem}
              icon={<PlusOutlined />}
            >
              Add Item
            </Button>

            <div className="text-lg font-semibold">
              Total: LKR {totalAmount.toLocaleString()}
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button onClick={() => navigate(`/quotations/${id}`)}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
          >
            Update {quotation.type === 'invoice' ? 'Invoice' : 'Quotation'}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default QuotationEdit;
