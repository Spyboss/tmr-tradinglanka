import apiClient from './apiClient';

export const getAllFinanceCompanies = async () => {
  try {
    const data = await apiClient.get('/finance-companies');
    return data;
  } catch (error) {
    console.error('Error fetching finance companies:', error);
    throw error;
  }
};

export const createFinanceCompany = async (data) => {
  try {
    const result = await apiClient.post('/finance-companies', data);
    return result;
  } catch (error) {
    console.error('Error creating finance company:', error);
    throw error;
  }
};

export const updateFinanceCompany = async (id, data) => {
  try {
    const result = await apiClient.put(`/finance-companies/${id}`, data);
    return result;
  } catch (error) {
    console.error('Error updating finance company:', error);
    throw error;
  }
};

export const deleteFinanceCompany = async (id) => {
  try {
    const result = await apiClient.delete(`/finance-companies/${id}`);
    return result;
  } catch (error) {
    console.error('Error deleting finance company:', error);
    throw error;
  }
};

export default {
  getAllFinanceCompanies,
  createFinanceCompany,
  updateFinanceCompany,
  deleteFinanceCompany
};
