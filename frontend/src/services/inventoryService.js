import apiClient from '../config/apiClient';

/**
 * Get all inventory items with pagination and filtering
 * @param {Object} params - Query parameters
 * @returns {Promise} - Promise with inventory data
 */
export const getInventory = async (params = {}) => {
  try {
    const response = await apiClient.get('/inventory', { params });
    return response;
  } catch (error) {
    console.error('Error fetching inventory:', error);
    throw error;
  }
};

/**
 * Get inventory summary
 * @returns {Promise} - Promise with inventory summary
 */
export const getInventorySummary = async () => {
  try {
    const response = await apiClient.get('/inventory/summary');
    return response;
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    throw error;
  }
};

/**
 * Get enhanced inventory analytics for professional reporting
 * @returns {Promise} - Promise with inventory analytics
 */
export const getInventoryAnalytics = async () => {
  try {
    const response = await apiClient.get('/inventory/analytics');
    return response;
  } catch (error) {
    console.error('Error fetching inventory analytics:', error);
    throw error;
  }
};

/**
 * Get available bikes for a specific model
 * @param {string} modelId - Bike model ID
 * @returns {Promise} - Promise with available bikes
 */
export const getAvailableBikesByModel = async (modelId) => {
  try {
    const response = await apiClient.get(`/inventory/available/${modelId}`);
    return response;
  } catch (error) {
    console.error('Error fetching available bikes:', error);
    throw error;
  }
};

/**
 * Get inventory item by ID
 * @param {string} id - Inventory item ID
 * @returns {Promise} - Promise with inventory item
 */
export const getInventoryById = async (id) => {
  try {
    const response = await apiClient.get(`/inventory/${id}`);
    return response;
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    throw error;
  }
};

/**
 * Add a bike to inventory
 * @param {Object} data - Inventory item data
 * @returns {Promise} - Promise with created inventory item
 */
export const addToInventory = async (data) => {
  try {
    const response = await apiClient.post('/inventory', data);
    return response;
  } catch (error) {
    console.error('Error adding to inventory:', error);
    throw error;
  }
};

/**
 * Add multiple bikes to inventory
 * @param {Array} items - Array of inventory items
 * @returns {Promise} - Promise with created inventory items
 */
export const batchAddToInventory = async (items) => {
  try {
    const response = await apiClient.post('/inventory/batch', { items });
    return response;
  } catch (error) {
    console.error('Error batch adding to inventory:', error);
    throw error;
  }
};

/**
 * Update an inventory item
 * @param {string} id - Inventory item ID
 * @param {Object} data - Updated inventory item data
 * @returns {Promise} - Promise with updated inventory item
 */
export const updateInventory = async (id, data) => {
  try {
    const response = await apiClient.put(`/inventory/${id}`, data);
    return response;
  } catch (error) {
    console.error('Error updating inventory:', error);
    throw error;
  }
};

/**
 * Delete an inventory item
 * @param {string} id - Inventory item ID
 * @returns {Promise} - Promise with deletion result
 */
export const deleteInventory = async (id, reason) => {
  try {
    const response = await apiClient.delete(`/inventory/${id}`, reason ? { data: { reason } } : {});
    return response;
  } catch (error) {
    console.error('Error deleting inventory:', error);
    throw error;
  }
};

export default {
  getInventory,
  getInventorySummary,
  getInventoryAnalytics,
  getAvailableBikesByModel,
  getInventoryById,
  addToInventory,
  batchAddToInventory,
  updateInventory,
  deleteInventory
};
