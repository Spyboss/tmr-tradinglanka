import apiClient from './apiClient';

export const getFinanceCompanySales = async (params) => {
  try {
    const data = await apiClient.get('/reports/finance-company-sales', { params });
    return data;
  } catch (error) {
    console.error('Error fetching finance company sales report:', error);
    throw error;
  }
};

export const getFinanceCompanySalesPdf = async (params) => {
  try {
    const blob = await apiClient.get('/reports/finance-company-sales/pdf', { params });
    return blob;
  } catch (error) {
    console.error('Error generating finance company sales PDF:', error);
    throw error;
  }
};

export default {
  getFinanceCompanySales,
  getFinanceCompanySalesPdf,
};
