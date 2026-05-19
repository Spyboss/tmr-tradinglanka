import React, { useState, useEffect, useRef } from 'react';
import {
  Button, Card, Form, Input, DatePicker, Space, Row, Col,
  message, Spin, Modal, Table, Tag
} from 'antd';
import { PlusOutlined, CloseOutlined, ScanOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../config/apiClient';
import moment from 'moment';

const { TextArea } = Input;
const emptyItem = { item: '', partNumber: '', description: '', remark: '' };

const WarrantyClaimForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [batterySerials, setBatterySerials] = useState([]);
  const [serialInput, setSerialInput] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const scanInputRef = useRef(null);

  const billIdParam = searchParams.get('billId');
  const chassisParam = searchParams.get('chassis');

  useEffect(() => {
    if (billIdParam || chassisParam) {
      loadPrefill(billIdParam, chassisParam);
    }
  }, [billIdParam, chassisParam]);

  const loadPrefill = async (billId, chassis) => {
    setLoading(true);
    try {
      const params = {};
      if (billId) params.billId = billId;
      if (chassis) params.chassisNumber = chassis;

      const response = await apiClient.get('/warranty-claims/prefill', { params });
      if (response.prefill) {
        form.setFieldsValue({
          customerName: response.prefill.customerName,
          customerPhone: response.prefill.customerPhone,
          customerAddress: response.prefill.customerAddress,
          chassisNumber: response.prefill.chassisNumber,
          motorNumber: response.prefill.motorNumber,
          bikeModel: response.prefill.bikeModel,
          color: response.prefill.color,
          dateOfSale: response.prefill.dateOfSale ? moment(response.prefill.dateOfSale) : null
        });
      }
    } catch (error) {
      message.error('Failed to load prefill data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchBills = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const response = await apiClient.get('/warranty-claims/search-bills', {
        params: { q: searchQuery }
      });
      setSearchResults(response.bills || []);
    } catch (error) {
      message.error('Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectBill = (bill) => {
    setSearchModalOpen(false);
    loadPrefill(bill._id, null);
  };

  const handleAddSerial = () => {
    const val = serialInput.trim();
    if (val && !batterySerials.includes(val)) {
      setBatterySerials([...batterySerials, val]);
      setSerialInput('');
    }
    if (scanInputRef.current) scanInputRef.current.focus();
  };

  const handleRemoveSerial = (idx) => {
    setBatterySerials(batterySerials.filter((_, i) => i !== idx));
  };

  const handleSerialKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSerial();
    }
  };

  const handleAddItem = () => {
    setItems([...items, { ...emptyItem }]);
  };

  const handleRemoveItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    const updated = items.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    );
    setItems(updated);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        ...values,
        dateOfSale: values.dateOfSale ? values.dateOfSale.toISOString() : null,
        dateOfComplaint: values.dateOfComplaint ? values.dateOfComplaint.toISOString() : null,
        dateOfRepair: values.dateOfRepair ? values.dateOfRepair.toISOString() : null,
        batterySerialNumbers: batterySerials,
        items: items.filter(item => item.item || item.partNumber || item.description)
      };

      const result = await apiClient.post('/warranty-claims', payload);
      message.success('Warranty claim created successfully');
      navigate(`/warranty-claims/${result._id}`);
    } catch (error) {
      if (error.error) {
        message.error(error.error);
      } else {
        message.error('Failed to create warranty claim');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 dark:bg-slate-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">New Warranty Claim</h1>
        <Space>
          <Button onClick={() => setSearchModalOpen(true)} icon={<SearchOutlined />}>
            Find from Bill
          </Button>
          <Button onClick={() => navigate('/warranty-claims')}>Cancel</Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Card title="Customer & Vehicle Information" className="mb-4 dark:bg-slate-800">
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="customerName" label="Customer Name">
                  <Input placeholder="Enter customer name" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="customerPhone" label="Telephone">
                  <Input placeholder="07XXXXXXXX" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="dateOfSale" label="Date of Sale">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="customerAddress" label="Address">
                  <Input placeholder="Enter address" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="odometerReading" label="Odometer (km)">
                  <Input placeholder="Enter odometer reading" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="dateOfComplaint" label="Date of Complaint">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Form.Item name="chassisNumber" label="Chassis No">
                  <Input placeholder="Enter chassis number" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="registerNo" label="Register No">
                  <Input placeholder="Enter register number" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="dateOfRepair" label="Date of Repair">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Form.Item name="motorNumber" label="Motor Number">
                  <Input placeholder="Enter motor number" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="bikeModel" label="Model">
                  <Input placeholder="Enter bike model" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="color" label="Color">
                  <Input placeholder="Enter color" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="Defect & Actions" className="mb-4 dark:bg-slate-800">
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item name="defectReported" label="Defect reported by customer">
                  <TextArea rows={2} placeholder="Enter defect reported by customer" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item name="probableCause" label="Probable cause">
                  <TextArea rows={2} placeholder="Enter probable cause" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item name="actionTaken" label="Action taken">
                  <TextArea rows={2} placeholder="Enter action taken" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item name="suggestion" label="Suggestion">
                  <TextArea rows={2} placeholder="Enter suggestion" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="Parts / Items" className="mb-4 dark:bg-slate-800">
            {items.map((item, idx) => (
              <Row key={idx} gutter={8} className="mb-2">
                <Col xs={24} sm={5}>
                  <Input
                    placeholder="Item"
                    value={item.item}
                    onChange={(e) => handleItemChange(idx, 'item', e.target.value)}
                  />
                </Col>
                <Col xs={24} sm={5}>
                  <Input
                    placeholder="Part Number"
                    value={item.partNumber}
                    onChange={(e) => handleItemChange(idx, 'partNumber', e.target.value)}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                  />
                </Col>
                <Col xs={24} sm={4}>
                  <Input
                    placeholder="Remark"
                    value={item.remark}
                    onChange={(e) => handleItemChange(idx, 'remark', e.target.value)}
                  />
                </Col>
                <Col xs={24} sm={2}>
                  {items.length > 1 && (
                    <Button danger icon={<CloseOutlined />} onClick={() => handleRemoveItem(idx)} />
                  )}
                </Col>
              </Row>
            ))}
            <Button type="dashed" onClick={handleAddItem} icon={<PlusOutlined />} block>
              Add Item
            </Button>
          </Card>

          <Card title="Battery Serial Numbers" className="mb-4 dark:bg-slate-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Scan QR codes or manually enter battery serial numbers
            </p>
            <Space className="w-full mb-2">
              <Input
                ref={scanInputRef}
                placeholder="Scan or type battery serial number"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                onKeyDown={handleSerialKeyDown}
                style={{ width: 350 }}
                prefix={<ScanOutlined />}
                autoFocus
              />
              <Button onClick={handleAddSerial}>Add</Button>
            </Space>
            <div className="flex flex-wrap gap-2">
              {batterySerials.map((s, idx) => (
                <Tag key={idx} closable onClose={() => handleRemoveSerial(idx)}>
                  {s}
                </Tag>
              ))}
              {batterySerials.length === 0 && (
                <span className="text-gray-400 text-sm">No serial numbers added yet</span>
              )}
            </div>
          </Card>

          <Card title="Office Use Only" className="mb-4 dark:bg-slate-800">
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item name="officeComments" label="Comments">
                  <TextArea rows={2} placeholder="Office comments" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="approvedBy" label="Approved By">
                  <Input placeholder="Name of approver" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="approvalDate" label="Approval Date">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="serialNumber" label="Serial Number (stamped)">
                  <Input placeholder="e.g. 5784" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <div className="flex justify-end gap-3">
            <Button onClick={() => navigate('/warranty-claims')}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              Create Warranty Claim
            </Button>
          </div>
        </Form>
      </Spin>

      <Modal
        title="Search Bills for Pre-fill"
        open={searchModalOpen}
        onCancel={() => setSearchModalOpen(false)}
        footer={null}
        width={700}
      >
        <Space className="w-full mb-4">
          <Input
            placeholder="Search by bill number, customer name, chassis, or motor number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearchBills}
            style={{ width: 400 }}
            prefix={<SearchOutlined />}
          />
          <Button onClick={handleSearchBills} loading={searchLoading}>Search</Button>
        </Space>
        <Table
          dataSource={searchResults}
          rowKey="_id"
          loading={searchLoading}
          pagination={false}
          columns={[
            { title: 'Bill No', dataIndex: 'billNumber', key: 'billNumber' },
            { title: 'Customer', dataIndex: 'customerName', key: 'customerName' },
            { title: 'Chassis', dataIndex: 'chassisNumber', key: 'chassisNumber', width: 150 },
            { title: 'Motor', dataIndex: 'motorNumber', key: 'motorNumber', width: 130 },
            { title: 'Model', dataIndex: 'bikeModel', key: 'bikeModel' },
            {
              title: 'Action', key: 'action', width: 100,
              render: (_, record) => (
                <Button type="link" onClick={() => handleSelectBill(record)}>Select</Button>
              )
            }
          ]}
          locale={{ emptyText: 'No bills found. Try a different search.' }}
        />
      </Modal>
    </div>
  );
};

export default WarrantyClaimForm;
