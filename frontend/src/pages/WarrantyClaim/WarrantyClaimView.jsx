import React, { useState, useEffect } from 'react';
import {
  Button, Card, Descriptions, Tag, Table, Spin, Space, Divider, message, Popconfirm
} from 'antd';
import { DownloadOutlined, ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../config/apiClient';
import moment from 'moment';

const WarrantyClaimView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClaim();
  }, [id]);

  const fetchClaim = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/warranty-claims/${id}`);
      setClaim(response);
    } catch (error) {
      message.error('Failed to fetch warranty claim');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!claim) return;
    try {
      const blob = await apiClient.get(`/warranty-claims/${id}/pdf`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TMR_Warranty_${claim.warrantyNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('PDF downloaded successfully');
    } catch (error) {
      message.error('Failed to download PDF');
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/warranty-claims/${id}`);
      message.success('Warranty claim deleted successfully');
      navigate('/warranty-claims');
    } catch (error) {
      message.error('Failed to delete warranty claim');
    }
  };

  const getStatusColor = (status) => {
    const colors = { pending: 'orange', completed: 'green', cancelled: 'red' };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Warranty claim not found</p>
        <Button onClick={() => navigate('/warranty-claims')}>Back to Claims</Button>
      </div>
    );
  }

  const itemColumns = [
    { title: 'Item', dataIndex: 'item', key: 'item' },
    { title: 'Part Number', dataIndex: 'partNumber', key: 'partNumber' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    { title: 'Remark', dataIndex: 'remark', key: 'remark' }
  ];

  return (
    <div className="p-4 sm:p-6 dark:bg-slate-900">
      <div className="flex justify-between items-center mb-6">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/warranty-claims')} />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Warranty Claim: {claim.warrantyNumber}
          </h1>
          <Tag color={getStatusColor(claim.status)}>{(claim.status || '').toUpperCase()}</Tag>
        </Space>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadPDF}>
            Download PDF
          </Button>
          <Popconfirm
            title="Delete this warranty claim?"
            onConfirm={handleDelete}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      </div>

      <Card title="Customer & Vehicle Information" className="mb-4 dark:bg-slate-800">
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Customer Name">{claim.customerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Telephone">{claim.customerPhone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Date of Sale">
            {claim.dateOfSale ? moment(claim.dateOfSale).format('DD/MM/YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Address">{claim.customerAddress || '-'}</Descriptions.Item>
          <Descriptions.Item label="Odometer (km)">{claim.odometerReading || '-'}</Descriptions.Item>
          <Descriptions.Item label="Date of Complaint">
            {claim.dateOfComplaint ? moment(claim.dateOfComplaint).format('DD/MM/YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Chassis No">{claim.chassisNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="Register No">{claim.registerNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="Date of Repair">
            {claim.dateOfRepair ? moment(claim.dateOfRepair).format('DD/MM/YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Motor Number">{claim.motorNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="Model">{claim.bikeModel || '-'}</Descriptions.Item>
          <Descriptions.Item label="Color">{claim.color || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Defect & Actions" className="mb-4 dark:bg-slate-800">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Defect reported by customer">
            {claim.defectReported || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Probable cause">
            {claim.probableCause || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Action taken">
            {claim.actionTaken || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Suggestion">
            {claim.suggestion || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {claim.items && claim.items.length > 0 && (
        <Card title="Parts / Items" className="mb-4 dark:bg-slate-800">
          <Table
            columns={itemColumns}
            dataSource={claim.items.filter(i => i.item || i.partNumber || i.description)}
            rowKey={(_, idx) => idx}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {claim.batterySerialNumbers && claim.batterySerialNumbers.length > 0 && (
        <Card title="Battery Serial Numbers" className="mb-4 dark:bg-slate-800">
          <div className="flex flex-wrap gap-2">
            {claim.batterySerialNumbers.map((s, idx) => (
              <Tag key={idx} color="blue">{s}</Tag>
            ))}
          </div>
        </Card>
      )}

      <Card title="Office Use Only" className="mb-4 dark:bg-slate-800">
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Serial Number">{claim.serialNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="Approved By">{claim.approvedBy || '-'}</Descriptions.Item>
          <Descriptions.Item label="Approval Date">
            {claim.approvalDate ? moment(claim.approvalDate).format('DD/MM/YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Comments" span={3}>
            {claim.officeComments || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default WarrantyClaimView;
