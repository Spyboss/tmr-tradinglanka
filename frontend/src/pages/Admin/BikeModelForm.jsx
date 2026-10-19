import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import bikeModelService from '../../services/bikeModelService';

const BikeModelForm = () => {
  const { id } = useParams(); // For editing existing model
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    // motor_number_prefix: '', // Removed
    // chassis_number_prefix: '', // Removed
    is_ebicycle: false,
    is_tricycle: false,
    // can_be_leased is determined by the backend based on is_ebicycle and is_tricycle
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isEditing) {
      const fetchBikeModel = async () => {
        setLoading(true);
        try {
          const modelData = await bikeModelService.getBikeModelById(id);

          // Validate that we received valid data
          if (!modelData || typeof modelData !== 'object') {
            throw new Error('Invalid bike model data received');
          }

          // Handle the response - apiClient.get() returns data directly
          const formDataToSet = {
            name: modelData.name || '',
            price: modelData.price ? modelData.price.toString() : '', // Ensure price is a string for input field
            is_ebicycle: Boolean(modelData.is_ebicycle),
            is_tricycle: Boolean(modelData.is_tricycle),
          };

          setFormData(formDataToSet);
        } catch (err) {
          console.error('🔧 BikeModelForm: Error fetching bike model:', err);
          const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch bike model details';
          toast.error(errorMessage);
          navigate('/admin/bike-models'); // Redirect if model not found or error
        } finally {
          setLoading(false);
        }
      };
      fetchBikeModel();
    }
  }, [id, isEditing, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError('');

    const dataToSubmit = {
      ...formData,
      price: parseFloat(formData.price) // Convert price to number before sending
    };

    // Basic validation
    if (!dataToSubmit.name.trim()) {
      setFormError('Name is required.');
      setLoading(false);
      return;
    }
    if (isNaN(dataToSubmit.price) || dataToSubmit.price <= 0) {
      setFormError('Price must be a positive number.');
      setLoading(false);
      return;
    }
    // Motor number prefix is now optional
    // if (!dataToSubmit.motor_number_prefix.trim()) {
    //   setFormError('Motor number prefix is required.');
    //   setLoading(false);
    //   return;
    // }
    // Chassis number prefix is now optional
    // if (!dataToSubmit.chassis_number_prefix.trim()) {
    //   setFormError('Chassis number prefix is required.');
    //   setLoading(false);
    //   return;
    // }

    try {
      if (isEditing) {
        await bikeModelService.updateBikeModel(id, dataToSubmit);
        toast.success('Bike model updated successfully!');
      } else {
        await bikeModelService.createBikeModel(dataToSubmit);
        toast.success('Bike model created successfully!');
      }
      navigate('/admin/bike-models');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred.';
      setFormError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditing) {
    return <div className="text-center py-10 dark:text-gray-300">Loading model details...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        {isEditing ? 'Edit Bike Model' : 'Add New Bike Model'}
      </h1>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
        {formError && <p className="text-red-500 text-xs italic mb-4">{formError}</p>}

        <div className="mb-4">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="name">
            Model Name
          </label>
          <input
            type="text"
            name="name"
            id="name"
            value={formData.name}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="price">
            Price (Rs.)
          </label>
          <input
            type="number"
            name="price"
            id="price"
            value={formData.price}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
            required
            min="0.01"
            step="0.01"
          />
        </div>

        {/* Motor Number Prefix and Chassis Number Prefix fields removed */}

        <div className="mb-6">
          <span className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Properties</span>
          <label className="inline-flex items-center mr-6">
            <input
              type="checkbox"
              name="is_ebicycle"
              checked={formData.is_ebicycle}
              onChange={handleChange}
              className="form-checkbox h-5 w-5 text-blue-600 dark:text-blue-500 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-600"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">Is E-Bicycle</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              name="is_tricycle"
              checked={formData.is_tricycle}
              onChange={handleChange}
              className="form-checkbox h-5 w-5 text-blue-600 dark:text-blue-500 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-600"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">Is Tricycle</span>
          </label>
        </div>

        {/* can_be_leased is not directly editable as it's derived by backend logic */}
        {/* We could show a read-only indication if needed: */}
        {/* <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Note: Leasable status is determined automatically based on E-Bicycle/Tricycle selection.</p> */}


        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-blue-400"
          >
            {loading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Model' : 'Create Model')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/bike-models')}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline dark:bg-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default BikeModelForm;
