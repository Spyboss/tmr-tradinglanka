import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message } from 'antd';
import apiClient from '../config/apiClient';

const AdvancementConversion = () => {
  const [form] = Form.useForm();
  const [advancePayments, setAdvancePayments] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAdvancePayments();
  }, []);

  const fetchAdvancePayments = async () => {
    try {
      const response = await apiClient.get('/api/bills');
      const data = Array.isArray(response?.bills) ? response.bills : Array.isArray(response) ? response : [];
      const filtered = data.filter(b => b.isAdvancePayment === true && (b.status || '').toLowerCase() === 'pending');
      setAdvancePayments(filtered);
    } catch (error) {
      message.error('Failed to fetch advance payments');
    }
  };

  const handleConvert = (record) => {
    setSelectedBill(record);
    setIsModalVisible(true);
    form.setFieldsValue({
      remaining_amount: record.balanceAmount
    });
  };

  const handleConversion = async (values) => {
    try {
      setLoading(true);
      
      // Create a new full bill
      const newBillData = {
        customerName: selectedBill.customerName,
        customerNIC: selectedBill.customerNIC,
        customerAddress: selectedBill.customerAddress,
        bikeModel: selectedBill.bikeModel,
        bikePrice: selectedBill.bikePrice,
        motorNumber: selectedBill.motorNumber,
        chassisNumber: selectedBill.chassisNumber,
        billType: selectedBill.billType,
        billDate: selectedBill.billDate,
        isAdvancePayment: false,
        status: 'completed',
        balanceAmount: 0,
        originalBillId: selectedBill.id
      };

      delete newBillData.id; // Remove the id so a new one is generated

      // Create new bill
      await apiClient.post('/api/bills', newBillData);

      // Update the advance payment bill status
      await apiClient.patch(`/api/bills/${selectedBill.id}/status`, {
        status: 'converted'
      });

      message.success('Successfully converted advance payment to full bill');
      setIsModalVisible(false);
      fetchAdvancePayments();
    } catch (error) {
      message.error('Failed to convert advance payment');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Customer Name',
      dataIndex: 'customerName',
    },
    {
      title: 'Model',
      dataIndex: 'bikeModel',
    },
    {
      title: 'Payment Type',
      dataIndex: 'payment_type',
    },
    {
      title: 'Advance Amount',
      dataIndex: 'advanceAmount',
      render: (amount) => `Rs. ${amount?.toFixed(2)}`,
    },
    {
      title: 'Balance',
      dataIndex: 'balanceAmount',
      render: (amount) => `Rs. ${amount?.toFixed(2)}`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button type="primary" onClick={() => handleConvert(record)}>
          Convert to Full Bill
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl mb-4">Advance Payment Conversions</h2>
      <Table 
        dataSource={advancePayments} 
        columns={columns} 
        rowKey="id"
      />

      <Modal
        title="Convert to Full Bill"
        open={isModalVisible}
        onOk={form.submit}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={loading}
      >
        <Form
          form={form}
          onFinish={handleConversion}
          layout="vertical"
        >
          <Form.Item
            name="remaining_amount"
            label="Remaining Amount to be Paid"
          >
            <Input disabled />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdvancementConversion;