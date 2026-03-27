import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, DatePicker, InputNumber, Switch, message, Modal, Table, Spin, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/apiClient';
import toast from 'react-hot-toast';
import { getAvailableBikesByModel, getInventory, addToInventory, updateInventory } from '../services/inventoryService';

const { Option } = Select;
const DOCUMENT_MODE = {
  BILL: 'bill',
  PROFORMA: 'proforma'
};

const createClientProformaNumber = () => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `PF-${year}${month}${day}-${hour}${minute}`;
};

const BillGeneratorUnified = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [bikeModels, setBikeModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [documentMode, setDocumentMode] = useState(DOCUMENT_MODE.BILL);
  const [billType, setBillType] = useState('cash');
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Inventory related states
  const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
  const [availableBikes, setAvailableBikes] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);

  const proformaUnitPrice = Form.useWatch('proforma_unit_price', form);
  const proformaDownPayment = Form.useWatch('down_payment', form);
  const computedAmountToBeLeased = Math.max(
    (Number(proformaUnitPrice) || 0) - (Number(proformaDownPayment) || 0),
    0
  );

  useEffect(() => {
    fetchBikeModels();
  }, []);

  const fetchBikeModels = async () => {
    try {
      const response = await apiClient.get('/bike-models');
      setBikeModels(response || []);
    } catch (error) {
      console.error('Error fetching bike models:', error);
      message.error('Failed to fetch bike models');
    }
  };

  const handleModelChange = async (modelId) => {
    if (!modelId) return;
    const model = bikeModels.find(m => m._id === modelId);
    if (model) {
      setSelectedModel(model);
      form.setFieldsValue({
        bike_price: model.price,
        proforma_unit_price: model.price
      });

      if (model.is_ebicycle || model.is_tricycle) {
        setBillType('cash');
      }

      // Clear any previously selected inventory item and related fields
      setSelectedInventoryItem(null);
      form.setFieldsValue({
        motor_number: '',
        chassis_number: '',
        inventoryItemId: null
      });
    }
  };

  const showInventoryModal = async () => {
    if (!selectedModel) {
      message.warning('Please select a vehicle model first');
      return;
    }
    try {
      setLoadingInventory(true);
      const response = await getAvailableBikesByModel(selectedModel._id);
      setAvailableBikes(response || []);
      setInventoryModalVisible(true);
    } catch (error) {
      console.error('Error fetching available bikes:', error);
      message.error('Failed to fetch available bikes');
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleSelectInventoryItem = (item) => {
    setSelectedInventoryItem(item);
    form.setFieldsValue({
      motor_number: item.motorNumber,
      chassis_number: item.chassisNumber,
      inventoryItemId: item._id
    });
    setInventoryModalVisible(false);
  };

  const clearInventorySelection = () => {
    setSelectedInventoryItem(null);
    form.setFieldsValue({
      motor_number: '',
      chassis_number: '',
      inventoryItemId: null
    });
  };

  const calculateTotalAmount = (values) => {
    const model = bikeModels.find(m => m._id === values.model_id);
    if (!model) return 0;
    const price = parseFloat(model.price);
    if (model.is_ebicycle || model.is_tricycle) return price;
    if (billType === 'leasing') return values.down_payment || 0;
    return price + 13000;
  };

  const handleDocumentModeChange = (mode) => {
    setDocumentMode(mode);

    if (mode === DOCUMENT_MODE.PROFORMA) {
      setBillType('leasing');
      setIsAdvancePayment(false);

      form.setFieldsValue({
        bill_type: 'leasing',
        is_advance_payment: false,
        proforma_number: form.getFieldValue('proforma_number') || createClientProformaNumber(),
        finance_provider_type: form.getFieldValue('finance_provider_type') || 'leasing',
        validity_days: form.getFieldValue('validity_days') || 10,
        proforma_unit_price: form.getFieldValue('proforma_unit_price') || selectedModel?.price || 0,
        down_payment: form.getFieldValue('down_payment') || 0
      });
      return;
    }

    form.setFieldsValue({
      bill_type: 'cash',
      is_advance_payment: false
    });
    setBillType('cash');
    setIsAdvancePayment(false);
  };

  const buildProformaData = (values) => {
    const unitPrice = parseFloat(values.proforma_unit_price ?? selectedModel?.price ?? 0);
    const downPayment = parseFloat(values.down_payment ?? 0);
    const amountToBeLeased = Math.max(unitPrice - downPayment, 0);

    return {
      proformaNumber: (values.proforma_number || '').trim() || createClientProformaNumber(),
      issueDate: values.bill_date ? values.bill_date.toISOString() : new Date().toISOString(),
      validityDays: parseInt(values.validity_days, 10) || 10,
      customerName: values.customer_name,
      customerNIC: values.customer_nic,
      customerAddress: values.customer_address,
      customerPhone: values.customer_phone?.trim(),
      facilityProviderType: values.finance_provider_type,
      facilityProviderName: values.finance_provider_name,
      facilityProviderAddress: values.finance_provider_address,
      facilityProviderPhone: values.finance_provider_phone?.trim(),
      bikeModel: selectedModel?.name || '',
      manufacturedYear: values.manufactured_year,
      color: values.vehicle_color,
      motorPower: values.motor_power,
      chassisNumber: values.chassis_number,
      motorNumber: values.motor_number,
      unitPrice,
      downPayment,
      amountToBeLeased,
      totalAmount: unitPrice,
      authorizedDealerLabel: 'Authorized Dealer'
    };
  };

  const buildBillData = async (values, forPreview = false) => {
    const totalAmount = calculateTotalAmount(values);
    const billData = {
      customerName: values.customer_name,
      customerNIC: values.customer_nic,
      customerAddress: values.customer_address,
      bikeModel: selectedModel.name,
      bikePrice: selectedModel.price,
      motorNumber: values.motor_number,
      chassisNumber: values.chassis_number,
      billType,
      isEbicycle: selectedModel.is_ebicycle || false,
      isTricycle: selectedModel.is_tricycle || false,
      totalAmount,
      billDate: values.bill_date ? values.bill_date.toISOString() : new Date().toISOString()
    };

    if (selectedInventoryItem) {
      billData.inventoryItemId = selectedInventoryItem._id;
    }

    if (billType === 'leasing') {
      billData.downPayment = parseFloat(values.down_payment || 0);
      billData.rmvCharge = 13500;
    } else {
      billData.rmvCharge = selectedModel.is_ebicycle || selectedModel.is_tricycle ? 0 : 13000;
    }

    if (isAdvancePayment) {
      billData.isAdvancePayment = true;
      billData.advanceAmount = parseFloat(values.advance_amount || 0);
      billData.balanceAmount = totalAmount - (parseFloat(values.advance_amount || 0));
      billData.customerPhone = values.customer_phone?.trim();
      if (values.estimated_delivery_date) {
        billData.estimatedDeliveryDate = values.estimated_delivery_date.toISOString();
      }
    }

    if (forPreview) {
      try {
        const branding = await apiClient.get('/api/branding');
        const thankYou = 'Thank you for your business!';
        const footerCombined = branding?.footerNote ? `${thankYou}\n${branding.footerNote}` : thankYou;
        billData.branding = {
          dealerName: branding?.dealerName,
          logoUrl: branding?.logoUrl,
          footerNote: footerCombined,
          brandPartner: branding?.brandPartner,
          addressLine1: branding?.addressLine1,
          addressLine2: branding?.addressLine2,
          primaryColor: branding?.primaryColor,
        };
      } catch (_) {}
    }

    if (selectedModel.is_tricycle) {
      billData.vehicleType = 'E-TRICYCLE';
    } else if (selectedModel.is_ebicycle) {
      billData.vehicleType = 'E-MOTORBICYCLE';
    } else {
      billData.vehicleType = 'E-MOTORCYCLE';
    }

    return billData;
  };

  const handlePreview = async () => {
    try {
      await form.validateFields();
      setPreviewLoading(true);
      const values = form.getFieldsValue();
      const isProformaMode = documentMode === DOCUMENT_MODE.PROFORMA;
      const payload = isProformaMode
        ? buildProformaData(values)
        : await buildBillData(values, true);
      const endpoint = isProformaMode ? '/bills/proforma/preview' : '/bills/preview';
      const blob = await apiClient.post(endpoint, payload, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPreviewUrl(url);
      setPreviewVisible(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      message.error(documentMode === DOCUMENT_MODE.PROFORMA
        ? 'Please fill in all required proforma fields'
        : 'Please fill in all required fields');
    } finally {
      setPreviewLoading(false);
    }
  };

  const warnIfDuplicateInInventory = async (motor, chassis) => {
    try {
      const tasks = [];
      if (motor) tasks.push(getInventory({ search: motor, limit: 5 }));
      if (chassis) tasks.push(getInventory({ search: chassis, limit: 5 }));
      const results = await Promise.all(tasks);
      const items = results.flatMap(r => (r?.items || r?.data?.items || [])).
        filter(Boolean);
      const hasMotorDup = motor && items.some(i => (i.motorNumber || '').toLowerCase() === motor.toLowerCase());
      const hasChassisDup = chassis && items.some(i => (i.chassisNumber || '').toLowerCase() === chassis.toLowerCase());
      if (hasMotorDup || hasChassisDup) {
        toast((t) => (
          <span>
            {hasMotorDup && 'A bike with this motor already exists in inventory.'}
            {hasMotorDup && hasChassisDup ? ' ' : ''}
            {hasChassisDup && 'A bike with this chassis already exists in inventory.'}
          </span>
        ));
      }
    } catch (_) {}
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      if (!selectedModel) {
        toast.error('Please select a vehicle model');
        return;
      }

      if (documentMode === DOCUMENT_MODE.PROFORMA) {
        const proformaData = buildProformaData(values);
        const blob = await apiClient.post('/bills/proforma/preview?download=true', proformaData, { responseType: 'blob' });

        const safeNumber = (proformaData.proformaNumber || 'PROFORMA').replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `TMR_Proforma_${safeNumber}.pdf`;
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl('');
        }
        setPreviewVisible(false);

        toast.success('Proforma invoice generated successfully');
        return;
      }

      if (!selectedInventoryItem) {
        await warnIfDuplicateInInventory(values.motor_number, values.chassis_number);
      }

      const billData = await buildBillData(values, false);
      const response = await apiClient.post('/bills', billData);
      toast.success('Bill generated successfully');

      const createdBill = response;
      const billId = createdBill._id || createdBill.id;
      const isCompleted = (createdBill.status || '').toLowerCase() === 'completed';
      if (!selectedInventoryItem) {
        Modal.confirm({
          title: 'Add to Inventory?',
          content: 'Do you want to add this bike to inventory now?',
          okText: 'Yes',
          cancelText: 'No',
          onOk: async () => {
            const motor = values.motor_number;
            const chassis = values.chassis_number;
            let linked = false;

            try {
              const [byMotor, byChassis] = await Promise.all([
                motor ? getInventory({ search: motor, limit: 10 }) : Promise.resolve(null),
                chassis ? getInventory({ search: chassis, limit: 10 }) : Promise.resolve(null)
              ]);

              const itemsMotor = byMotor?.items || byMotor?.data?.items || [];
              const itemsChassis = byChassis?.items || byChassis?.data?.items || [];

              const lc = (s) => (s || '').toString().toLowerCase();
              const intersection = itemsMotor.filter(m => itemsChassis.some(c => lc(c._id||c.id)===lc(m._id||m.id)))
                .filter(i => lc(i.motorNumber) === lc(motor) && lc(i.chassisNumber) === lc(chassis));

              const preferred = intersection.find(i => (i.status || '').toLowerCase() === 'available') || intersection[0];
              if (preferred) {
                await apiClient.put(`/bills/${billId}`, { inventoryItemId: preferred._id || preferred.id });
                if (isCompleted && (preferred.status || '').toLowerCase() !== 'sold') {
                  await updateInventory(preferred._id || preferred.id, { status: 'sold', dateSold: new Date().toISOString(), billId });
                }
                toast.success('Linked to existing inventory item');
                linked = true;
              }
            } catch (_) {}

            if (!linked) {
              const billDateISO = billData.billDate || new Date().toISOString();
              const inventoryPayload = {
                bikeModelId: selectedModel._id,
                motorNumber: motor,
                chassisNumber: chassis,
                status: 'sold',
                dateAdded: billDateISO,
                dateSold: billDateISO,
                notes: 'Auto-added from bill creation'
              };

              const created = await addToInventory(inventoryPayload);
              try {
                await apiClient.put(`/bills/${billId}`, { inventoryItemId: created._id || created.id });
              } catch (_) {}
              toast.success('Bike added to inventory as SOLD');
            }
            navigate(`/bills/${billId}`);
          },
          onCancel: () => navigate(`/bills/${billId}`)
        });
      } else {
        navigate(`/bills/${billId}`);
      }
    } catch (error) {
      console.error('Error generating document:', error);
      if (documentMode === DOCUMENT_MODE.PROFORMA) {
        toast.error(error?.message || 'Failed to generate proforma invoice');
      } else {
        toast.error('Failed to generate bill');
      }
    } finally {
      setLoading(false);
    }
  };

  const inventoryColumns = [
    { title: 'Motor Number', dataIndex: 'motorNumber', key: 'motorNumber' },
    { title: 'Chassis Number', dataIndex: 'chassisNumber', key: 'chassisNumber' },
    { title: 'Date Added', dataIndex: 'dateAdded', key: 'dateAdded', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color="green">{s.toUpperCase()}</Tag> },
    { title: 'Action', key: 'action', render: (_, record) => (
      <Button type="primary" size="small" onClick={() => handleSelectInventoryItem(record)}>Select</Button>
    )}
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 dark:bg-slate-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        {documentMode === DOCUMENT_MODE.PROFORMA ? 'Generate Proforma Invoice' : 'Create Bill'}
      </h1>

      {documentMode === DOCUMENT_MODE.BILL && selectedModel?.is_ebicycle && (
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 mb-6 rounded border border-blue-200 dark:border-blue-700">
          <h3 className="text-blue-800 dark:text-blue-300 font-medium">E-Bicycle Selected</h3>
          <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">Only cash sales; no RMV charges.</p>
        </div>
      )}

      {documentMode === DOCUMENT_MODE.BILL && selectedModel?.is_tricycle && (
        <div className="bg-green-50 dark:bg-green-900/30 p-4 mb-6 rounded border border-green-200 dark:border-green-700">
          <h3 className="text-green-800 dark:text-green-300 font-medium">E-Tricycle Selected</h3>
          <p className="text-green-600 dark:text-green-400 text-sm mt-1">Only cash sales; no RMV charges.</p>
        </div>
      )}

      {selectedInventoryItem && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 mb-6 rounded border border-yellow-200 dark:border-yellow-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-yellow-800 dark:text-yellow-300 font-medium">Bike Selected from Inventory</h3>
              <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-1">
                Motor: {selectedInventoryItem.motorNumber}, Chassis: {selectedInventoryItem.chassisNumber}
              </p>
            </div>
            <Button type="link" onClick={clearInventorySelection}>Clear selection</Button>
          </div>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          document_mode: DOCUMENT_MODE.BILL,
          bill_type: 'cash',
          is_advance_payment: false,
          bill_date: null,
          estimated_delivery_date: null,
          finance_provider_type: 'leasing',
          validity_days: 10,
          down_payment: 0,
          proforma_number: createClientProformaNumber()
        }}
      >
        <Form.Item
          name="document_mode"
          label="Document Type"
          rules={[{ required: true, message: 'Please select document type' }]}
        >
          <Select
            onChange={handleDocumentModeChange}
            options={[
              { label: 'Sales Bill', value: DOCUMENT_MODE.BILL },
              { label: 'Proforma Invoice', value: DOCUMENT_MODE.PROFORMA }
            ]}
          />
        </Form.Item>

        <Form.Item name="model_id" label="Vehicle Model" rules={[{ required: true, message: 'Please select a vehicle model' }]}> 
          <Select
            onChange={handleModelChange}
            placeholder="Select vehicle model"
            options={bikeModels.map(model => ({
              label: `${model.name} - Rs. ${model.price?.toLocaleString() || 'N/A'} ${model.is_tricycle ? '(E-TRICYCLE)' : model.is_ebicycle ? '(E-MOTORBICYCLE)' : '(E-MOTORCYCLE)'}`,
              value: model._id
            }))}
            notFoundContent={bikeModels.length === 0 ? 'No vehicle models available' : 'No matching models found'}
          />
        </Form.Item>

        <div className="mb-4">
          <Button type="dashed" onClick={showInventoryModal} disabled={!selectedModel} className="w-full">
            Select Bike from Inventory (optional)
          </Button>
        </div>

        {documentMode === DOCUMENT_MODE.BILL && (
          <Form.Item name="bill_type" label="Bill Type">
            <Select
              value={billType}
              onChange={(value) => setBillType(value)}
              disabled={selectedModel?.is_ebicycle || selectedModel?.is_tricycle}
              options={[
                { label: 'Cash', value: 'cash' },
                { label: 'Leasing', value: 'leasing', disabled: selectedModel?.is_ebicycle || selectedModel?.is_tricycle }
              ]}
            />
          </Form.Item>
        )}

        {documentMode === DOCUMENT_MODE.PROFORMA && (
          <>
            <Form.Item
              name="proforma_number"
              label="Proforma Number"
              rules={[{ required: true, message: 'Please enter proforma number' }]}
              getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
            >
              <Input style={{ textTransform: 'uppercase' }} autoCapitalize="characters" placeholder="PF-YYMMDD-XXXX" />
            </Form.Item>

            <Form.Item
              name="validity_days"
              label="Validity (Days)"
              rules={[{ required: true, message: 'Please enter validity period' }]}
            >
              <InputNumber min={1} max={90} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="finance_provider_type"
              label="Facility Type"
              rules={[{ required: true, message: 'Please select facility type' }]}
            >
              <Select
                options={[
                  { label: 'Leasing', value: 'leasing' },
                  { label: 'Finance', value: 'finance' },
                  { label: 'Insurance', value: 'insurance' }
                ]}
              />
            </Form.Item>

            <Form.Item
              name="finance_provider_name"
              label="Leasing / Finance / Insurance By"
              rules={[{ required: true, message: 'Please enter provider name' }]}
              getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
            >
              <Input style={{ textTransform: 'uppercase' }} autoCapitalize="characters" />
            </Form.Item>

            <Form.Item
              name="finance_provider_address"
              label="Provider Address"
              rules={[{ required: true, message: 'Please enter provider address' }]}
              getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
            >
              <Input.TextArea style={{ textTransform: 'uppercase' }} autoCapitalize="characters" rows={2} />
            </Form.Item>

            <Form.Item
              name="finance_provider_phone"
              label="Provider Contact Number"
              rules={[
                { required: true, message: 'Please enter provider contact number' },
                { pattern: /^[0-9+()\-\s]{7,20}$/, message: 'Enter a valid contact number' }
              ]}
            >
              <Input maxLength={20} placeholder="0112345678 / 0701234567" />
            </Form.Item>

            <Form.Item
              name="manufactured_year"
              label="Manufactured Year"
              rules={[
                { required: true, message: 'Please enter manufactured year' },
                { pattern: /^\d{4}$/, message: 'Enter a valid year (YYYY)' }
              ]}
            >
              <Input maxLength={4} placeholder="2025" />
            </Form.Item>

            <Form.Item
              name="vehicle_color"
              label="Vehicle Color"
              rules={[{ required: true, message: 'Please enter vehicle color' }]}
              getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
            >
              <Input style={{ textTransform: 'uppercase' }} autoCapitalize="characters" />
            </Form.Item>

            <Form.Item
              name="motor_power"
              label="Motor Power"
              rules={[{ required: true, message: 'Please enter motor power' }]}
              getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
            >
              <Input style={{ textTransform: 'uppercase' }} autoCapitalize="characters" placeholder="e.g. 2000W" />
            </Form.Item>

            <Form.Item
              name="proforma_unit_price"
              label="Unit Price"
              rules={[{ required: true, message: 'Please enter unit price' }]}
            >
              <InputNumber
                min={0}
                addonBefore="Rs."
                style={{ width: '100%' }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => v.replace(/\₹\s?|(,*)/g, '')}
              />
            </Form.Item>
          </>
        )}

        {(billType === 'leasing' || documentMode === DOCUMENT_MODE.PROFORMA) && (
          <Form.Item
            name="down_payment"
            label={documentMode === DOCUMENT_MODE.PROFORMA ? 'Down Payment' : 'Down Payment'}
            rules={[
              {
                required: billType === 'leasing' || documentMode === DOCUMENT_MODE.PROFORMA,
                message: 'Please enter down payment amount'
              }
            ]}
          >
            <InputNumber
              min={0}
              addonBefore="Rs."
              style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/\₹\s?|(,*)/g, '')}
            />
          </Form.Item>
        )}

        {documentMode === DOCUMENT_MODE.PROFORMA && (
          <Form.Item label="Amount to be Leased">
            <Input value={`Rs. ${computedAmountToBeLeased.toLocaleString()}`} disabled />
          </Form.Item>
        )}

        {documentMode === DOCUMENT_MODE.BILL && (
          <Form.Item label="Advance Payment" name="is_advance_payment" valuePropName="checked">
            <Switch onChange={(checked) => setIsAdvancePayment(checked)} />
          </Form.Item>
        )}

        {documentMode === DOCUMENT_MODE.BILL && isAdvancePayment && (
          <Form.Item name="advance_amount" label="Advance Amount" rules={[{ required: isAdvancePayment, message: 'Please enter advance amount' }]}> 
            <InputNumber min={0} addonBefore="Rs." style={{ width: '100%' }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/\₹\s?|(,*)/g, '')}
            />
          </Form.Item>
        )}

        {documentMode === DOCUMENT_MODE.BILL && isAdvancePayment && (
          <Form.Item name="estimated_delivery_date" label="Estimated Delivery Date">
            <DatePicker className="w-full" />
          </Form.Item>
        )}

        {(isAdvancePayment || documentMode === DOCUMENT_MODE.PROFORMA) && (
          <Form.Item
            name="customer_phone"
            label="Customer Contact Number"
            rules={[
              { required: true, message: 'Please enter customer contact number' },
              { pattern: /^07\d{8}$/, message: 'Enter a valid Sri Lankan mobile number (07XXXXXXXX)' }
            ]}
          >
            <Input maxLength={10} placeholder="0701234567" />
          </Form.Item>
        )}

        <Form.Item 
          name="customer_name" 
          label="Customer Name" 
          rules={[{ required: true, message: 'Please enter customer name' }]}
          getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
        >
          <Input style={{ textTransform: 'uppercase' }} autoCapitalize="characters" />
        </Form.Item>

        <Form.Item 
          name="customer_nic" 
          label="Customer NIC" 
          rules={[{ required: true, message: 'Please enter customer NIC' }]}
          getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
        >
          <Input style={{ textTransform: 'uppercase' }} autoCapitalize="characters" />
        </Form.Item>

        <Form.Item 
          name="customer_address" 
          label="Customer Address" 
          rules={[{ required: true, message: 'Please enter customer address' }]}
          getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
        >
          <Input.TextArea style={{ textTransform: 'uppercase' }} autoCapitalize="characters" />
        </Form.Item>

        <Form.Item 
          name="motor_number" 
          label="Motor Number" 
          rules={[{ required: true, message: 'Please enter motor number' }]}
          getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
        >
          <Input disabled={!!selectedInventoryItem} style={{ textTransform: 'uppercase' }} autoCapitalize="characters" />
        </Form.Item>

        <Form.Item 
          name="chassis_number" 
          label="Chassis Number" 
          rules={[{ required: true, message: 'Please enter chassis number' }]}
          getValueFromEvent={e => e?.target?.value?.toUpperCase?.() || ''}
        >
          <Input disabled={!!selectedInventoryItem} style={{ textTransform: 'uppercase' }} autoCapitalize="characters" />
        </Form.Item>

        <Form.Item name="inventoryItemId" hidden>
          <Input />
        </Form.Item>

        <Form.Item name="bill_date" label={documentMode === DOCUMENT_MODE.PROFORMA ? 'Issue Date' : 'Bill Date'}>
          <DatePicker className="w-full" />
        </Form.Item>

        <div className="flex justify-end space-x-4 mt-6">
          <Button onClick={() => navigate('/bills')}>Cancel</Button>
          <Button type="default" onClick={handlePreview} loading={previewLoading}>
            {documentMode === DOCUMENT_MODE.PROFORMA ? 'Preview Proforma' : 'Preview'}
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {documentMode === DOCUMENT_MODE.PROFORMA ? 'Download Proforma' : 'Generate Bill'}
          </Button>
        </div>
      </Form>

      <Modal
        title="Select Bike from Inventory"
        open={inventoryModalVisible}
        onCancel={() => setInventoryModalVisible(false)}
        footer={[<Button key="back" onClick={() => setInventoryModalVisible(false)}>Cancel</Button>]}
        width={800}
      >
        {loadingInventory ? (
          <div className="flex justify-center items-center py-8"><Spin size="large" /></div>
        ) : availableBikes.length === 0 ? (
          <div className="text-center py-8 dark:text-gray-300">
            <p>No available bikes found for this model.</p>
            <Button type="primary" onClick={() => navigate('/inventory/add')} className="mt-4">Add Bikes to Inventory</Button>
          </div>
        ) : (
          <Table columns={inventoryColumns} dataSource={availableBikes} rowKey="_id" pagination={{ pageSize: 5 }} />
        )}
      </Modal>

      <Modal
        title={documentMode === DOCUMENT_MODE.PROFORMA ? 'Proforma Preview' : 'Bill Preview'}
        open={previewVisible}
        onCancel={() => { setPreviewVisible(false); URL.revokeObjectURL(previewUrl); }}
        width={800}
        footer={[
          <Button key="close" onClick={() => { setPreviewVisible(false); URL.revokeObjectURL(previewUrl); }}>Close</Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            {documentMode === DOCUMENT_MODE.PROFORMA ? 'Download Proforma' : 'Generate Bill'}
          </Button>,
        ]}
      >
        <div className="h-[700px]">
          <iframe
            src={previewUrl}
            title={documentMode === DOCUMENT_MODE.PROFORMA ? 'Proforma Preview' : 'Bill Preview'}
            className="w-full h-full border-0"
          />
        </div>
      </Modal>
    </div>
  );
};

export default BillGeneratorUnified;
