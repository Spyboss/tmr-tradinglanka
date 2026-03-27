import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Button, Badge, Descriptions, Card, Popconfirm, message, Alert, Tag, Modal, Form, Input, InputNumber, Select, DatePicker } from 'antd';
import { DownloadOutlined, DeleteOutlined, EditOutlined, PrinterOutlined, EyeOutlined, FileDoneOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import apiClient from '../config/apiClient';
import AdvancementConversion from '../components/AdvancementConversion';
import dayjs from 'dayjs';

const BillView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proformaForm] = Form.useForm();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [proformaVisible, setProformaVisible] = useState(false);
  const [proformaLoading, setProformaLoading] = useState(false);
  const [proformaSubmitting, setProformaSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBill(id);
    }
  }, [id]);

  const fetchBill = async (billId) => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/bills/${billId}`);
      
      console.log('Received bill data:', data);
      
      // Ensure the bill has an id property (MongoDB uses _id)
      if (data && data._id) {
        data.id = data._id;
      }
      
      setBill(data);
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error('Failed to fetch bill details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return 'N/A';
      
      // Use UTC methods to avoid timezone conversion issues
      const day = d.getUTCDate().toString().padStart(2, '0');
      const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      const year = d.getUTCFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: 'processing',
      completed: 'success',
      cancelled: 'error',
      converted: 'warning'
    };
    return statusMap[status?.toLowerCase()] || 'default';
  };

  const handleDeleteBill = async () => {
    try {
      setLoading(true);
      await apiClient.delete(`/bills/${id}`);
      toast.success('Bill deleted successfully');
      navigate('/bills');
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast.error(`Failed to delete bill: ${error.message || 'Server error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPDF = async () => {
    try {
      setPreviewLoading(true);
      // Log the request for debugging
      console.log(`Requesting PDF preview for bill: ${id}`);
      
      try {
        const blob = await apiClient.get(`/bills/${id}/pdf?preview=true`, {
          responseType: 'blob'
        });
        
        if (!blob || !(blob instanceof Blob)) {
          throw new Error('Invalid response from server');
        }
        
        // Create a blob URL and open it in a new window
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewVisible(true);
        
        // Also open in a new tab for better viewing
        window.open(url, '_blank');
        return url;
      } catch (error) {
        console.error('Error previewing PDF:', error);
        toast.error(`Failed to preview PDF: ${error.message || 'Server error'}`);
        throw error;
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setLoading(true);
      // Log the request for debugging
      console.log(`Requesting PDF download for bill: ${id}`);
      
      const blob = await apiClient.get(`/bills/${id}/pdf`, {
        responseType: 'blob'
      });
      
      if (!blob || !(blob instanceof Blob)) {
        throw new Error('Invalid response from server');
      }
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bill-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error(`Failed to download PDF: ${error.message || 'Server error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToLeasing = async () => {
    try {
      await apiClient.put(`/bills/${bill.id}/convert-to-leasing`, {
        // ... existing code ...
      });
      toast.success('Bill converted to leasing successfully');
      fetchBill(id);
    } catch (error) {
      console.error('Error converting bill:', error);
      toast.error('Failed to convert bill');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setLoading(true);
      // Log the request for debugging
      console.log(`Updating bill ${id} status to ${newStatus}`);
      
      // Use the specific status endpoint
      await apiClient.patch(`/bills/${id}/status`, { status: newStatus });
      toast.success(`Bill status updated to ${newStatus}`);
      
      // Update the local bill object
      setBill({
        ...bill,
        status: newStatus,
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(`Failed to update status: ${error.message || 'Server error'}`);
    } finally {
      setLoading(false);
    }
  };

  const openProformaModal = async () => {
    try {
      setProformaLoading(true);
      const response = await apiClient.get(`/bills/${id}/proforma`);
      const proforma = response?.proforma || {};

      proformaForm.setFieldsValue({
        type: proforma.type || 'leasing',
        documentNumber: proforma.documentNumber || `PF-${bill?.billNumber || bill?._id || id}`,
        issueDate: proforma.issueDate ? dayjs(proforma.issueDate) : dayjs(),
        financeCompanyName: proforma.financeCompanyName || '',
        financeCompanyAddress: proforma.financeCompanyAddress || '',
        financeCompanyContact: proforma.financeCompanyContact || '',
        manufactureYear: proforma.manufactureYear || '',
        color: proforma.color || '',
        motorPower: proforma.motorPower || '',
        unitPrice: Number(proforma.unitPrice ?? bill?.bikePrice ?? 0),
        downPayment: Number(proforma.downPayment ?? bill?.downPayment ?? 0),
        amountToBeLeased: Number(proforma.amountToBeLeased ?? Math.max(Number(proforma.unitPrice ?? bill?.bikePrice ?? 0) - Number(proforma.downPayment ?? bill?.downPayment ?? 0), 0))
      });

      setProformaVisible(true);
    } catch (error) {
      console.error('Error loading proforma details:', error);
      toast.error(error.message || 'Failed to load proforma details');
    } finally {
      setProformaLoading(false);
    }
  };

  const handleProformaValuesChange = (_, allValues) => {
    const unitPrice = Number(allValues.unitPrice || 0);
    const downPayment = Number(allValues.downPayment || 0);
    const amountToBeLeased = Math.max(unitPrice - downPayment, 0);
    proformaForm.setFieldsValue({ amountToBeLeased });
  };

  const saveAndDownloadProforma = async () => {
    try {
      const values = await proformaForm.validateFields();
      setProformaSubmitting(true);

      const payload = {
        ...values,
        issueDate: values.issueDate ? values.issueDate.toISOString() : new Date().toISOString()
      };

      await apiClient.put(`/bills/${id}/proforma`, payload);

      const pdfBlob = await apiClient.get(`/bills/${id}/proforma/pdf`, {
        responseType: 'blob'
      });

      const blob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `proforma-${bill?.billNumber || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Proforma invoice generated successfully');
      setProformaVisible(false);
    } catch (error) {
      console.error('Error generating proforma:', error);
      toast.error(error.message || 'Failed to generate proforma invoice');
    } finally {
      setProformaSubmitting(false);
    }
  };

  const getBillTypeTag = (type) => {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen dark:bg-slate-900">
        <Spin size="large" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-6">
        <Alert
          message="Bill not found"
          description="The requested bill could not be found. It may have been deleted or the ID is incorrect."
          type="error"
          showIcon
        />
        <Button 
          type="primary" 
          onClick={() => navigate('/bills')}
          className="mt-4"
        >
          Return to Bill List
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 dark:bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Bill #{bill._id || bill.id}</h1>
          <div className="flex items-center mt-2">
            {getBillTypeTag(bill.billType)}
            <Badge 
              status={getStatusBadgeClass(bill.status)} 
              text={bill.status} 
              className="ml-2"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            icon={<EyeOutlined />}
            onClick={handlePreviewPDF}
            loading={previewLoading}
          >
            Preview
          </Button>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={handleDownloadPDF}
          >
            Download PDF
          </Button>
          <Button
            icon={<FileDoneOutlined />}
            onClick={openProformaModal}
            loading={proformaLoading}
            disabled={(bill.status || '').toLowerCase() !== 'completed'}
          >
            Generate Proforma Invoice
          </Button>
          <Button 
            icon={<PrinterOutlined />} 
            onClick={() => {
              handlePreviewPDF().then(() => {
                setTimeout(() => {
                  const printFrame = document.getElementById('pdf-preview-frame');
                  if (printFrame) {
                    printFrame.contentWindow.print();
                  }
                }, 1000);
              });
            }}
          >
            Print
          </Button>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => navigate(`/bills/${id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this bill?"
            onConfirm={handleDeleteBill}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              danger 
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card title="Bill Details" className="mb-6 dark:bg-slate-800">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Bill Number">{bill.billNumber || bill._id || bill.id}</Descriptions.Item>
            <Descriptions.Item label="Bill Date">{formatDate(bill.billDate || bill.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Bill Type">{getBillTypeTag(bill.billType)}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge 
                status={getStatusBadgeClass(bill.status)} 
                text={bill.status} 
              />
            </Descriptions.Item>
            {(bill.billType === 'advance' || bill.billType === 'advancement') && bill.estimatedDeliveryDate && (
              <Descriptions.Item label="Estimated Delivery Date">
                {formatDate(bill.estimatedDeliveryDate)}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Card title="Customer Information" className="mb-6 dark:bg-slate-800">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Name">{bill.customerName}</Descriptions.Item>
            <Descriptions.Item label="NIC">{bill.customerNIC}</Descriptions.Item>
            <Descriptions.Item label="Address">{bill.customerAddress}</Descriptions.Item>
            {(bill.isAdvancePayment || bill.customerPhone) && (
              <Descriptions.Item label="Contact Number">{bill.customerPhone || 'N/A'}</Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Card title="Vehicle Information" className="mb-6 dark:bg-slate-800">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Model">{bill.bikeModel}</Descriptions.Item>
            <Descriptions.Item label="Type">
              {bill.vehicleType || (bill.isEbicycle ? 'E-Bicycle' : 'Bicycle')}
            </Descriptions.Item>
            <Descriptions.Item label="Motor Number">{bill.motorNumber || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Chassis Number">{bill.chassisNumber || 'N/A'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Payment Information" className="mb-6 dark:bg-slate-800">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Bike Price">{formatAmount(bill.bikePrice)}</Descriptions.Item>
            {!bill.isEbicycle && bill.billType === 'cash' && (
              <Descriptions.Item label="RMV Charge">{formatAmount(bill.rmvCharge || 13000)}</Descriptions.Item>
            )}
            <Descriptions.Item label="Total Amount">{formatAmount(bill.totalAmount)}</Descriptions.Item>
            {(bill.billType === 'advance' || bill.billType === 'advancement') && (
              <>
                <Descriptions.Item label="Down Payment">{formatAmount(bill.downPayment)}</Descriptions.Item>
                <Descriptions.Item label="Balance Amount">{formatAmount(bill.balanceAmount)}</Descriptions.Item>
              </>
            )}
            {bill.billType === 'leasing' && (
              <Descriptions.Item label="Down Payment">{formatAmount(bill.downPayment)}</Descriptions.Item>
            )}
          </Descriptions>
        </Card>
        </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        {bill.status !== 'completed' && (
          <Button
            type="primary"
                onClick={() => handleStatusChange('completed')}
              >
                Mark as Completed
          </Button>
        )}
        
        {bill.status !== 'cancelled' && (
          <Button
            danger
            onClick={() => handleStatusChange('cancelled')}
          >
            Mark as Cancelled
          </Button>
        )}
        
        {(bill.billType === 'cash' && bill.status !== 'converted' && !bill.isEbicycle) && (
          <Popconfirm
            title="Convert this cash bill to leasing?"
            onConfirm={handleConvertToLeasing}
            okText="Yes"
            cancelText="No"
          >
            <Button>
              Convert to Leasing
            </Button>
          </Popconfirm>
        )}
      </div>

      <Modal
        title="Bill Preview"
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          URL.revokeObjectURL(previewUrl);
        }}
        width={800}
        footer={[
          <Button key="back" onClick={() => {
            setPreviewVisible(false);
            URL.revokeObjectURL(previewUrl);
          }}>
            Close
          </Button>,
          <Button 
            key="print" 
            type="primary" 
            icon={<PrinterOutlined />}
            onClick={() => {
              const printFrame = document.getElementById('pdf-preview-frame');
              if (printFrame) {
                printFrame.contentWindow.print();
              }
            }}
          >
            Print
          </Button>,
        ]}
      >
        <div className="h-[70vh] sm:h-[700px]">
          <iframe 
            id="pdf-preview-frame"
            src={previewUrl} 
            title="Bill Preview" 
            className="w-full h-full border-0"
          />
        </div>
      </Modal>

      <Modal
        title="Proforma Invoice Details"
        open={proformaVisible}
        onCancel={() => setProformaVisible(false)}
        width={820}
        footer={[
          <Button key="cancel" onClick={() => setProformaVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="generate"
            type="primary"
            loading={proformaSubmitting}
            onClick={saveAndDownloadProforma}
          >
            Save & Generate PDF
          </Button>
        ]}
      >
        <Form
          form={proformaForm}
          layout="vertical"
          onValuesChange={handleProformaValuesChange}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="type" label="Proforma Type" rules={[{ required: true, message: 'Select a type' }]}>
              <Select
                options={[
                  { label: 'Leasing', value: 'leasing' },
                  { label: 'Finance', value: 'finance' },
                  { label: 'Insurance', value: 'insurance' }
                ]}
              />
            </Form.Item>

            <Form.Item name="documentNumber" label="Document Number">
              <Input placeholder="PF-XXXX" />
            </Form.Item>

            <Form.Item name="issueDate" label="Issue Date" rules={[{ required: true, message: 'Select issue date' }]}>
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item
              name="financeCompanyContact"
              label="Leasing/Finance Contact"
              rules={[{ required: true, message: 'Enter finance company contact' }]}
            >
              <Input placeholder="Contact number" />
            </Form.Item>
          </div>

          <Form.Item
            name="financeCompanyName"
            label="Leasing/Finance By"
            rules={[{ required: true, message: 'Enter finance company name' }]}
          >
            <Input placeholder="Company name" />
          </Form.Item>

          <Form.Item
            name="financeCompanyAddress"
            label="Leasing/Finance Address"
            rules={[{ required: true, message: 'Enter finance company address' }]}
          >
            <Input.TextArea rows={2} placeholder="Company address" />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item name="manufactureYear" label="Manufacture Year">
              <Input placeholder="e.g. 2025" />
            </Form.Item>
            <Form.Item name="color" label="Color">
              <Input placeholder="Vehicle color" />
            </Form.Item>
            <Form.Item name="motorPower" label="Motor Power">
              <Input placeholder="e.g. 1500W" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item name="unitPrice" label="Unit Price (LKR)" rules={[{ required: true, message: 'Enter unit price' }]}>
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item name="downPayment" label="Down Payment (LKR)">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item name="amountToBeLeased" label="Amount To Be Leased (LKR)" rules={[{ required: true, message: 'Enter leased amount' }]}>
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default BillView;
