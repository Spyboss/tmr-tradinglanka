import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Button, Badge, Descriptions, Card, Popconfirm, message, Alert, Tag, Modal, Table } from 'antd';
import { DownloadOutlined, DeleteOutlined, EditOutlined, PrinterOutlined, EyeOutlined, FileTextOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import apiClient from '../config/apiClient';
import moment from 'moment';

const QuotationView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    try {
      const response = await apiClient.get(`/quotations/${id}`);
      setQuotation(response);
    } catch (error) {
      console.error('Error fetching quotation:', error);
      toast.error('Failed to fetch quotation details');
      navigate('/quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setActionLoading(true);
    try {
      const response = await apiClient.get(`/quotations/${id}/pdf`, {
        responseType: 'blob'
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GM_${quotation.type}_${quotation.quotationNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await apiClient.delete(`/quotations/${id}`);
      toast.success('Quotation deleted successfully');
      // Add a small delay to ensure backend processing is complete
      setTimeout(() => {
        navigate('/quotations', { replace: true });
        // Force a page reload to ensure fresh data
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error deleting quotation:', error);
      toast.error('Failed to delete quotation');
      setActionLoading(false);
    }
  };

  const handleConvertToInvoice = async () => {
    setActionLoading(true);
    try {
      const response = await apiClient.post(`/quotations/${id}/convert-to-invoice`);
      toast.success('Quotation converted to invoice successfully');
      // Navigate to the new invoice
      navigate(`/quotations/${response._id || response.id}`);
    } catch (error) {
      console.error('Error converting to invoice:', error);
      toast.error('Failed to convert to invoice');
    } finally {
      setActionLoading(false);
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

  const itemColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
    },
    {
      title: 'Rate (LKR)',
      dataIndex: 'rate',
      key: 'rate',
      width: 130,
      render: (rate) => rate.toLocaleString(),
    },
    {
      title: 'Amount (LKR)',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (amount) => amount.toLocaleString(),
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
        <Alert
          message="Quotation not found"
          description="The quotation you're looking for doesn't exist or you don't have permission to view it."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-slate-900 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/quotations')}
          >
            Back to Quotations
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {quotation.quotationNumber}
            </h1>
            <div className="flex items-center space-x-2 mt-1">
              <Tag color={getTypeColor(quotation.type)}>
                {quotation.type.toUpperCase()}
              </Tag>
              <Tag color={getStatusColor(quotation.status)}>
                {quotation.status.toUpperCase()}
              </Tag>
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadPDF}
            loading={actionLoading}
          >
            Download PDF
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/quotations/${id}/edit`)}
          >
            Edit
          </Button>
          {quotation.type === 'quotation' && quotation.status !== 'converted' && (
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={handleConvertToInvoice}
              loading={actionLoading}
            >
              Convert to Invoice
            </Button>
          )}
          <Popconfirm
            title="Are you sure you want to delete this quotation?"
            onConfirm={handleDelete}
            okText="Yes"
            cancelText="No"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={actionLoading}
            >
              Delete
            </Button>
          </Popconfirm>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Details */}
        <Card title="Document Details" className="mb-6">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Document Number">
              {quotation.quotationNumber}
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color={getTypeColor(quotation.type)}>
                {quotation.type.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={getStatusColor(quotation.status)}>
                {quotation.status.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Date">
              {moment(quotation.quotationDate).format('DD/MM/YYYY')}
            </Descriptions.Item>
            {quotation.validUntil && (
              <Descriptions.Item label="Valid Until">
                {moment(quotation.validUntil).format('DD/MM/YYYY')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Total Amount">
              <span className="text-lg font-semibold">
                LKR {quotation.totalAmount.toLocaleString()}
              </span>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Customer Details */}
        <Card title="Customer Details" className="mb-6">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Name">
              {quotation.customerName}
            </Descriptions.Item>
            <Descriptions.Item label="Address">
              {quotation.customerAddress}
            </Descriptions.Item>
            {quotation.customerNIC && (
              <Descriptions.Item label="NIC">
                {quotation.customerNIC}
              </Descriptions.Item>
            )}
            {quotation.customerPhone && (
              <Descriptions.Item label="Phone">
                {quotation.customerPhone}
              </Descriptions.Item>
            )}
            {quotation.bikeRegNo && (
              <Descriptions.Item label="Bike Registration">
                {quotation.bikeRegNo}
              </Descriptions.Item>
            )}
            {quotation.referenceBillId && (
              <Descriptions.Item label="Reference Bill">
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate(`/bills/${quotation.referenceBillId._id}`)}
                >
                  {quotation.referenceBillId.billNumber}
                </Button>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      </div>

      {/* Insurance Details */}
      {(quotation.claimNumber || quotation.insuranceCompany || quotation.accidentDate) && (
        <Card title="Insurance/Accident Details" className="mb-6">
          <Descriptions column={3} size="small">
            {quotation.claimNumber && (
              <Descriptions.Item label="Claim Number">
                {quotation.claimNumber}
              </Descriptions.Item>
            )}
            {quotation.insuranceCompany && (
              <Descriptions.Item label="Insurance Company">
                {quotation.insuranceCompany}
              </Descriptions.Item>
            )}
            {quotation.accidentDate && (
              <Descriptions.Item label="Accident Date">
                {moment(quotation.accidentDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* Items */}
      <Card title="Items" className="mb-6">
        <Table
          columns={itemColumns}
          dataSource={quotation.items}
          pagination={false}
          rowKey={(record, index) => index}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}>
                <strong>Total</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <strong>LKR {quotation.totalAmount.toLocaleString()}</strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>

      {/* Remarks */}
      {quotation.remarks && (
        <Card title="Remarks" className="mb-6">
          <p className="text-gray-700 dark:text-gray-300">
            {quotation.remarks}
          </p>
        </Card>
      )}

      {/* Timestamps */}
      <Card title="System Information" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Created">
            {moment(quotation.createdAt).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated">
            {moment(quotation.updatedAt).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default QuotationView;
