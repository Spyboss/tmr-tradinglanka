import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import bikeModelService from '../../services/bikeModelService'; // Assuming this path is correct

const BikeModelList = () => {
  const [bikeModels, setBikeModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPrice, setEditingPrice] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    const fetchBikeModels = async () => {
      try {
        setLoading(true);
        const data = await bikeModelService.getAllBikeModels();
        console.log('BikeModelList - fetched data:', data);

        // Validate that we received an array
        if (Array.isArray(data)) {
          setBikeModels(data);
        } else {
          console.error('Expected array but received:', typeof data, data);
          setBikeModels([]);
          toast.error('Invalid data format received from server');
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching bike models:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch bike models';
        setError(errorMessage);
        toast.error(errorMessage);
        setBikeModels([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBikeModels();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this bike model?')) {
      try {
        await bikeModelService.deleteBikeModel(id);
        setBikeModels(bikeModels.filter(model => model._id !== id));
        toast.success('Bike model deleted successfully');
      } catch (err) {
        toast.error(err.message || 'Failed to delete bike model');
      }
    }
  };

  const handlePriceEdit = (modelId, currentPrice) => {
    setEditingPrice(modelId);
    setEditingValue(currentPrice.toString());
  };

  const handlePriceSave = async (modelId) => {
    try {
      const newPrice = parseFloat(editingValue);
      if (isNaN(newPrice) || newPrice <= 0) {
        toast.error('Please enter a valid price');
        return;
      }

      const model = bikeModels.find(m => m._id === modelId);
      if (!model) {
        toast.error('Model not found');
        return;
      }

      const updatedData = {
        name: model.name,
        price: newPrice,
        is_ebicycle: Boolean(model.is_ebicycle),
        is_tricycle: Boolean(model.is_tricycle)
      };

      console.log('Updating bike model with data:', updatedData);
      const result = await bikeModelService.updateBikeModel(modelId, updatedData);
      console.log('Update result:', result);

      // Update the local state
      setBikeModels(bikeModels.map(model =>
        model._id === modelId ? { ...model, price: newPrice } : model
      ));

      setEditingPrice(null);
      setEditingValue('');
      toast.success('Price updated successfully');
    } catch (err) {
      console.error('Error updating price:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update price';
      toast.error(errorMessage);
    }
  };

  const handlePriceCancel = () => {
    setEditingPrice(null);
    setEditingValue('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 dark:bg-slate-900">
        <div className="text-center py-10 dark:text-gray-300">Loading bike models...</div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Bike Models Management</h1>
        <Link
          to="/admin/bike-models/new"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          Add New Bike Model
        </Link>
      </div>

      {bikeModels.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No bike models found. Add one to get started!</p>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">E-Bike</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tricycle</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Leasable</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {bikeModels.map((model) => (
                <tr key={model._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{model.name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {editingPrice === model._id ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs">Rs.</span>
                        <input
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handlePriceSave(model._id);
                            } else if (e.key === 'Escape') {
                              handlePriceCancel();
                            }
                          }}
                          className="w-24 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0.01"
                          step="0.01"
                          autoFocus
                        />
                        <button
                          onClick={() => handlePriceSave(model._id)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-xs"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handlePriceCancel}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Rs. {(model.price || 0).toLocaleString()}</span>
                        <button
                          onClick={() => handlePriceEdit(model._id, model.price || 0)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                          title="Edit price"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{model.is_ebicycle ? 'Yes' : 'No'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{model.is_tricycle ? 'Yes' : 'No'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{model.can_be_leased ? 'Yes' : 'No'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/admin/bike-models/edit/${model._id}`}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                      onClick={() => console.log('🔧 BikeModelList: Edit clicked for model:', model._id, model.name)}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(model._id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BikeModelList;
