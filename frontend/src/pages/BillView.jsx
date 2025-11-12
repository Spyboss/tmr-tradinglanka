import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Button, Badge, Descriptions, Card, Popconfirm, message, Alert, Tag, Modal } from 'antd';
import { DownloadOutlined, DeleteOutlined, EditOutlined, PrinterOutlined, EyeOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import apiClient from '../config/apiClient';
import AdvancementConversion from '../components/AdvancementConversion';

const BillView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

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
      <div className="flex justify-center items-center h-screen">
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
            {getBillTypeTag(bill.billType || bill.bill_type)}
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
            <Descriptions.Item label="Bill Number">{bill.billNumber || bill.bill_number || bill._id || bill.id}</Descriptions.Item>
            <Descriptions.Item label="Bill Date">{formatDate(bill.billDate || bill.bill_date || bill.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Bill Type">{getBillTypeTag(bill.billType || bill.bill_type)}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge 
                status={getStatusBadgeClass(bill.status)} 
                text={bill.status} 
              />
            </Descriptions.Item>
            {((bill.billType === 'advance' || bill.bill_type === 'advance' || 
               bill.billType === 'advancement' || bill.bill_type === 'advancement') && 
              (bill.estimatedDeliveryDate || bill.estimated_delivery_date)) && (
              <Descriptions.Item label="Estimated Delivery Date">
                {formatDate(bill.estimatedDeliveryDate || bill.estimated_delivery_date)}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Card title="Customer Information" className="mb-6 dark:bg-slate-800">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Name">{bill.customerName || bill.customer_name}</Descriptions.Item>
            <Descriptions.Item label="NIC">{bill.customerNIC || bill.customer_nic}</Descriptions.Item>
            <Descriptions.Item label="Address">{bill.customerAddress || bill.customer_address}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Vehicle Information" className="mb-6 dark:bg-slate-800">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Model">{bill.bikeModel || bill.model_name}</Descriptions.Item>
            <Descriptions.Item label="Type">
              {bill.vehicleType || bill.vehicle_type || (bill.isEbicycle || bill.is_ebicycle ? 'E-Bicycle' : 'Bicycle')}
            </Descriptions.Item>
            <Descriptions.Item label="Motor Number">{bill.motorNumber || bill.motor_number || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Chassis Number">{bill.chassisNumber || bill.chassis_number || 'N/A'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Payment Information" className="mb-6 dark:bg-slate-800">
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Bike Price">{formatAmount(bill.bikePrice || bill.bike_price)}</Descriptions.Item>
            {!(bill.isEbicycle || bill.is_ebicycle) && (bill.billType === 'cash' || bill.bill_type === 'cash') && (
              <Descriptions.Item label="RMV Charge">{formatAmount(bill.rmvCharge || 13000)}</Descriptions.Item>
            )}
            <Descriptions.Item label="Total Amount">{formatAmount(bill.totalAmount || bill.total_amount)}</Descriptions.Item>
            {((bill.billType === 'advance' || bill.bill_type === 'advance' || 
               bill.billType === 'advancement' || bill.bill_type === 'advancement')) && (
              <>
                <Descriptions.Item label="Down Payment">{formatAmount(bill.downPayment || bill.down_payment)}</Descriptions.Item>
                <Descriptions.Item label="Balance Amount">{formatAmount(bill.balanceAmount || bill.balance_amount)}</Descriptions.Item>
              </>
            )}
            {(bill.billType === 'leasing' || bill.bill_type === 'leasing') && (
              <Descriptions.Item label="Down Payment">{formatAmount(bill.downPayment || bill.down_payment)}</Descriptions.Item>
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
        
        {((bill.billType === 'cash' || bill.bill_type === 'cash') && 
          bill.status !== 'converted' && 
          !(bill.isEbicycle || bill.is_ebicycle)) && (
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
    </div>
  );
};

export default BillView;
