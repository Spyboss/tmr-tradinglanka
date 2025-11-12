import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, DatePicker, InputNumber, Switch, message, Modal, Table, Space, Card, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/apiClient';
import toast from 'react-hot-toast';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

const QuotationGenerator = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Calculate total amount whenever items change
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    setTotalAmount(total);
  }, [items]);

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
      setSelectedCustomer(customer);
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
    setLoading(true);
    try {
      // Validate items
      const validItems = items.filter(item => item.description && item.quantity > 0 && item.rate >= 0);

      if (validItems.length === 0) {
        toast.error('Please add at least one valid item');
        setLoading(false);
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

      console.log('Submitting quotation data:', quotationData);

      const response = await apiClient.post('/quotations', quotationData);

      toast.success('Quotation generated successfully');
      navigate(`/quotations/${response._id || response.id}`);
    } catch (error) {
      console.error('Error generating quotation:', error);
      toast.error('Failed to generate quotation');
    } finally {
      setLoading(false);
    }
  };

  // Handle preview
  const handlePreview = async () => {
    try {
      const values = await form.validateFields();
      const validItems = items.filter(item => item.description && item.quantity > 0 && item.rate >= 0);

      if (validItems.length === 0) {
        toast.error('Please add at least one valid item');
        return;
      }

      // Create a temporary quotation for preview
      const tempQuotation = {
        ...values,
        items: validItems,
        totalAmount,
        quotationNumber: 'PREVIEW',
        quotationDate: values.quotationDate ? values.quotationDate.toDate() : new Date(),
        validUntil: values.validUntil ? values.validUntil.toDate() : null,
        accidentDate: values.accidentDate ? values.accidentDate.toDate() : null
      };

      // For now, we'll show a simple preview modal
      // In a real implementation, you might want to generate a preview PDF
      setPreviewVisible(true);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const itemColumns = [
    {
      title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (text, record, index) => (
          <TextArea
            value={text}
            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
            placeholder="Enter description (Shift+Enter for new line)"
            autoSize={{ minRows: 1, maxRows: 4 }}
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

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 dark:bg-slate-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">Generate New Quotation</h1>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          type: 'quotation',
          quotationDate: moment(),
          remarks: 'Payment should be made within 7 days of invoice date.'
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column */}
          <div>
            <Card title="Document Details" className="mb-6">
              <Form.Item
                name="type"
                label="Document Type"
                rules={[{ required: true }]}
              >
                <Select>
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
          <div className="overflow-x-auto">
            <Table
              dataSource={items}
              columns={itemColumns}
              pagination={false}
              rowKey={(record, index) => index}
              className="mb-4 min-w-[640px]"
            />
          </div>

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
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
          <Button onClick={handlePreview} icon={<EyeOutlined />}>Preview</Button>
          <Button type="primary" htmlType="submit" loading={loading}>Generate Quotation</Button>
        </div>
      </Form>

      {/* Preview Modal */}
      <Modal
        title="Quotation Preview"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={800}
        footer={[
          <Button key="back" onClick={() => setPreviewVisible(false)}>
            Close
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            Generate Quotation
          </Button>,
        ]}
      >
        <div className="p-4">
          <p>Preview functionality will be implemented with PDF generation.</p>
          <p>Total Amount: LKR {totalAmount.toLocaleString()}</p>
        </div>
      </Modal>
    </div>
  );
};

export default QuotationGenerator;
