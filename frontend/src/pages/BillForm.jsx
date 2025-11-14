import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import apiClient from '../config/apiClient'

export default function BillForm() {
  const navigate = useNavigate()
  const [bikeModels, setBikeModels] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [currentModel, setCurrentModel] = useState(null)
  const [formData, setFormData] = useState({
    billType: 'cash',
    customerName: '',
    customerNIC: '',
    customerAddress: '',
    bikeModel: '',
    motorNumber: '',
    chassisNumber: '',
    bikePrice: 0,
    downPayment: 0,
    totalAmount: 0,
    balanceAmount: 0,
    estimatedDeliveryDate: ''
  })

  // Calculate total and balance amounts when relevant fields change
  useEffect(() => {
    calculateTotalAndBalance();
  }, [formData.bikePrice, formData.billType, formData.downPayment]);

  const calculateTotalAndBalance = () => {
    const bikePrice = parseInt(formData.bikePrice) || 0;
    let total = bikePrice;
    let rmvCharge = 0;

    console.log('CALCULATE TOTAL DEBUG:');
    console.log('- Bike price:', bikePrice);
    console.log('- Current model:', currentModel ? JSON.stringify(currentModel) : 'null');
    console.log('- Model name:', formData.bikeModel);
    console.log('- Bill type:', formData.billType);

    // Add RMV charges based on bill type and bike type
    const modelNameUpper = (formData.bikeModel || '').toUpperCase();
    const isCola5 = modelNameUpper.includes('COLA5');
    const isX01 = modelNameUpper.includes('X01');
    const isEBicycle = isCola5 || isX01 || (currentModel && currentModel.is_ebicycle);

    if (!isEBicycle) {
      // Add RMV charges for non-e-bicycles
      if (formData.billType === 'cash') {
        rmvCharge = 13000; // Cash bill RMV charge
      } else if (formData.billType === 'leasing') {
        rmvCharge = 0; // Leasing bills use CPZ
      }
      total += rmvCharge;
    }

    console.log('- Is E-Bicycle:', isEBicycle);
    console.log('- RMV Charge:', rmvCharge);
    console.log('- Final total amount:', total);

    // Calculate balance for advancement bills
    let balance = 0;
    if (formData.billType === 'advancement') {
      const downPayment = parseInt(formData.downPayment) || 0;
      balance = total - downPayment;
    }

    setFormData(prev => ({
      ...prev,
      totalAmount: total,
      balanceAmount: balance,
      rmvCharge: rmvCharge
    }));
  };

  useEffect(() => {
    // Fetch bike models when component mounts
const fetchBikeModels = async () => {
  try {
    setLoading(true)
    // Filter models only if bill type is leasing
    const url = formData.billType === 'leasing'
      ? `/bike-models?bill_type=${formData.billType}`
      : '/bike-models';

    const response = await apiClient.get(url)
    console.log('bikeModels state:', response)
    setBikeModels(response || [])
  } catch (error) {
    toast.error('Failed to load bike models')
    console.error('Error fetching bike models:', error)
  } finally {
    setLoading(false)
  }
}
    fetchBikeModels()
  }, [formData.bill_type])

  const handleInputChange = (e) => {
    const { name, value } = e.target

    // Special handling for model selection
    if (name === 'bikeModel') {
      const selectedModel = bikeModels.find(model => model.name === value);
      if (selectedModel) {
        console.log('SELECTED MODEL DEBUG INFO:');
        console.log('- Model name:', selectedModel.name);
        console.log('- is_ebicycle flag value:', selectedModel.is_ebicycle);
        console.log('- is_ebicycle type:', typeof selectedModel.is_ebicycle);
        console.log('- Full model object:', JSON.stringify(selectedModel));

        setCurrentModel(selectedModel);

        // COLA5 DEBUG OVERRIDE - Force e-bicycle status for any COLA5 model
        if (selectedModel.name.toUpperCase().includes('COLA5') && !selectedModel.is_ebicycle) {
          console.log('⚠️ CRITICAL: COLA5 model found with is_ebicycle=false, applying EMERGENCY OVERRIDE');
          const correctedModel = {...selectedModel, is_ebicycle: true};
          setCurrentModel(correctedModel);
        }

        setFormData(prev => ({
          ...prev,
          [name]: value,
          bikePrice: selectedModel.price
        }));

        // Force a recalculation of total amount
        setTimeout(() => {
          calculateTotalAndBalance();
        }, 100);
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  }

  const handleBillTypeChange = (e) => {
    const newBillType = e.target.value;

    // Reset model selection if switching to leasing and current model is e-bicycle
    if (newBillType === 'leasing' && currentModel?.is_ebicycle) {
      setCurrentModel(null);
      setFormData(prev => ({
        ...prev,
        billType: newBillType,
        bikeModel: '',
        bikePrice: 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        billType: newBillType
      }));
    }
  }

  const handlePreviewPDF = async () => {
    try {
      setLoading(true);

      // Prepare the preview data
      const previewData = {
        id: 'PREVIEW',
        billType: formData.billType.toUpperCase(),
        billDate: new Date().toISOString(),
        customerName: formData.customerName,
        customerNIC: formData.customerNIC,
        customerAddress: formData.customerAddress,
        bikeModel: formData.bikeModel,
        bikePrice: formData.bikePrice,
        totalAmount: formData.totalAmount || 0,
        rmvCharge: formData.rmvCharge || 0,
        isEbicycle: currentModel?.is_ebicycle || false,
        can_be_leased: currentModel?.can_be_leased || true,
        balanceAmount: formData.balanceAmount || 0,
        estimatedDeliveryDate: formData.estimatedDeliveryDate || ''
      };

      try {
        const branding = await apiClient.get('/api/branding');
        const thankYou = 'Thank you for your business!';
        const footerCombined = branding?.footerNote
          ? `${thankYou}\n${branding.footerNote}`
          : thankYou;
        previewData.branding = {
          dealerName: branding?.dealerName,
          logoUrl: branding?.logoUrl,
          footerNote: footerCombined,
          brandPartner: branding?.brandPartner,
          addressLine1: branding?.addressLine1,
          addressLine2: branding?.addressLine2,
          primaryColor: branding?.primaryColor,
        };
      } catch (_) {}

      // Generate preview PDF
      const blob = await apiClient.get(`/api/bills/preview/pdf?formData=${encodeURIComponent(JSON.stringify(previewData))}`);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      toast.error('Failed to generate preview');
      console.error('Error generating preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setSubmitting(true);

      // Validate fields
      if (!formData.billType) {
        toast.error('Please select a bill type');
        return;
      }

      // Create a copy of the form data with proper formatting
      const submitData = {
        billType: formData.billType.toUpperCase(),
        customerName: formData.customerName,
        customerNIC: formData.customerNIC,
        customerAddress: formData.customerAddress,
        bikeModel: formData.bikeModel,
        motorNumber: formData.motorNumber,
        chassisNumber: formData.chassisNumber,
        bikePrice: parseFloat(formData.bikePrice) || 0,
        downPayment: parseFloat(formData.downPayment) || 0,
        totalAmount: parseFloat(formData.totalAmount) || 0,
        balanceAmount: parseFloat(formData.balanceAmount) || 0,
        rmvCharge: formData.billType === 'cash' ? 13000 : 0,
        isEbicycle: currentModel?.is_ebicycle || false,
        can_be_leased: currentModel?.can_be_leased || true,
        billDate: new Date().toISOString(),
        estimatedDeliveryDate: formData.estimatedDeliveryDate || ''
      };

      // Additional validation for RMV charges
      if (submitData.billType === 'CASH' && !submitData.isEbicycle && submitData.rmvCharge !== 13000) {
        toast.error('Cash bills must have RMV charge of Rs. 13,000');
        return;
      }

      // Validate that chassis and motor numbers are provided
      if (!submitData.chassisNumber || !submitData.motorNumber) {
        toast.error('Please provide both chassis and motor numbers');
        return;
      }

      try {
        const branding = await apiClient.get('/api/branding');
        const thankYou = 'Thank you for your business!';
        const footerCombined = branding?.footerNote
          ? `${thankYou}\n${branding.footerNote}`
          : thankYou;
        submitData.branding = {
          dealerName: branding?.dealerName,
          logoUrl: branding?.logoUrl,
          footerNote: footerCombined,
          brandPartner: branding?.brandPartner,
          addressLine1: branding?.addressLine1,
          addressLine2: branding?.addressLine2,
          primaryColor: branding?.primaryColor,
        };
      } catch (_) {}

      const response = await apiClient.post('/bills', submitData);
      console.log('Bill created successfully:', response);
      toast.success('Bill created successfully');

      // Navigate to the bill view page
      navigate(`/bills/${response._id || response.id}`);
    } catch (error) {
      console.error('Error creating bill:', error);
      toast.error(error.response?.data?.error || 'Failed to save bill');
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create New Bill</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 sm:p-6">
        <div className="mb-6">
          <label className="label">Bill Type</label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
            <input
              type="radio"
              name="billType"
              value="cash"
              checked={formData.billType === 'cash'}
              onChange={handleBillTypeChange}
              className="form-radio h-5 w-5 text-blue-600"
            />
              <span className="ml-2">Cash Sale</span>
            </label>
            <label className="inline-flex items-center">
            <input
              type="radio"
              name="billType"
              value="leasing"
              checked={formData.billType === 'leasing'}
              onChange={handleBillTypeChange}
              className="form-radio h-5 w-5 text-blue-600"
            />
              <span className="ml-2">Leasing</span>
            </label>
            <label className="inline-flex items-center">
            <input
              type="radio"
              name="billType"
              value="advancement"
              checked={formData.billType === 'advancement'}
              onChange={handleBillTypeChange}
              className="form-radio h-5 w-5 text-blue-600"
            />
              <span className="ml-2">Advancement</span>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="label">NIC</label>
              <input
                type="text"
                name="customerNIC"
                value={formData.customerNIC}
                onChange={handleInputChange}
                className="input w-full"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <textarea
                name="customerAddress"
                value={formData.customerAddress}
                onChange={handleInputChange}
                className="input w-full"
                rows="2"
                required
              />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b">Vehicle Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="label">Bike Model</label>
              <select
                name="bikeModel"
                value={formData.bikeModel}
                onChange={handleInputChange}
                className="input w-full"
                required
              >
                <option value="">Select Bike Model</option>
                {bikeModels.map((model) => (
                  <option key={model._id} value={model.name}>
                    {model.name} - Rs. {(model.price || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Price</label>
              <input
                type="number"
                name="bikePrice"
                value={formData.bikePrice}
                onChange={handleInputChange}
                className="input w-full bg-gray-100 dark:bg-gray-700"
                readOnly
              />
            </div>
            <div>
              <label className="label">Motor Number</label>
              <input
                type="text"
                name="motorNumber"
                value={formData.motorNumber}
                onChange={handleInputChange}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="label">Chassis Number</label>
              <input
                type="text"
                name="chassisNumber"
                value={formData.chassisNumber}
                onChange={handleInputChange}
                className="input w-full"
                required
              />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b">Payment Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {(formData.billType === 'leasing' || formData.billType === 'advancement') && (
              <div>
                <label className="label">
                  {formData.billType === 'advancement' ? 'Advancement Amount' : 'Down Payment'}
                </label>
                <input
                  type="number"
                  name="downPayment"
                  value={formData.downPayment}
                  onChange={handleInputChange}
                  className="input w-full"
                  required={formData.billType === 'leasing' || formData.billType === 'advancement'}
                />
              </div>
            )}

            {formData.billType === 'advancement' && (
              <>
                <div>
                  <label className="label">Balance Amount</label>
                  <input
                    type="number"
                    name="balanceAmount"
                    value={formData.balanceAmount}
                    className="input w-full bg-gray-100 dark:bg-gray-700"
                    readOnly
                  />
                </div>
                <div>
                  <label className="label">Estimated Delivery Date</label>
                  <input
                    type="date"
                    name="estimatedDeliveryDate"
                    value={formData.estimatedDeliveryDate}
                    onChange={handleInputChange}
                    className="input w-full"
                    required={formData.billType === 'advancement'}
                  />
                </div>
              </>
            )}

            <div>
              <label className="label">Total Amount</label>
              <div>
                <input
                  type="number"
                name="totalAmount"
                value={formData.totalAmount}
                className="input w-full bg-gray-100 dark:bg-gray-700"
                readOnly
              />
                {/* Show RMV charges for non-e-bicycles and non-advancement bills */}
                {currentModel &&
                 !currentModel.is_ebicycle &&
                 !(formData.bikeModel || '').toUpperCase().includes('COLA5') &&
                 !(formData.bikeModel || '').toUpperCase().includes('X01') &&
                 formData.billType !== 'advancement' && formData.rmvCharge > 0 && (
                  <div className="mt-2 text-sm">
                    <div className="text-gray-600">Breakdown:</div>
                    <div className="flex justify-between text-gray-500">
                      <span>Bike Price:</span>
                      <span>Rs. {formData.bikePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>RMV Charges:</span>
                      <span>Rs. {formData.rmvCharge.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="btn"
          >
            Preview Bill
          </button>
          <button
            type="submit"
            disabled={submitting || loading}
            className="btn btn-primary disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Bill'}
          </button>
        </div>
      </form>
    </div>
  )
}
