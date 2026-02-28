import axios from 'axios';

class ApiClient {
  constructor() {
    // Get the base URL from environment or use a relative path
    let baseURL = import.meta.env.VITE_API_URL || '/api';
    
    // Remove trailing slash if present
    baseURL = baseURL.replace(/\/$/, '');
    
    // Store if the baseURL already includes /api
    this.baseURLHasApiPrefix = baseURL.endsWith('/api');
    
    console.log('Using API URL:', baseURL);
    console.log('Base URL has /api prefix:', this.baseURLHasApiPrefix);
    
    this.baseURL = baseURL;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // Increase timeout to 2 minutes for large responses like PDFs
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Friendly 403 interceptor: redirect users to verification flow when required
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        try {
          const status = error?.response?.status;
          const data = error?.response?.data;
          if (
            status === 403 &&
            data && data.code === 'EMAIL_NOT_VERIFIED' && data.friendly === true
          ) {
            const verifyUrl = typeof data.verifyUrl === 'string' ? data.verifyUrl : '/verify';
            // Dispatch a global event for the app to handle navigation/UX
            window.dispatchEvent(new CustomEvent('email-verification-required', { detail: { url: verifyUrl } }));
          }
        } catch (_) {
          // no-op
        }
        return Promise.reject(error);
      }
    );
  }
  
  getFullUrl(url) {
    // Ensure url starts with a slash
    const urlWithSlash = url.startsWith('/') ? url : `/${url}`;
    
    // If URL starts with /api/ and baseURL already ends with /api, remove the duplicate prefix
    if (this.baseURLHasApiPrefix && urlWithSlash.startsWith('/api/')) {
      return `${this.baseURL}${urlWithSlash.substring(4)}`;
    }
    
    // Regular path joining with baseURL
    return `${this.baseURL}${urlWithSlash}`;
  }
  
  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  async get(url, config = {}) {
    // Remove any /api prefix from URL if baseURL already has it
    const processedUrl = this.baseURLHasApiPrefix && url.startsWith('/api/') 
      ? url.substring(4) 
      : url;
    
    // Special handling for PDF endpoints
    if (processedUrl.includes('/pdf')) {
      console.log('PDF request detected:', processedUrl);
      
      try {
        // Always use axios for PDF requests with blob responseType
        console.log('Using axios for PDF with responseType: blob');
        
        // Get the current authorization token
        const token = localStorage.getItem('accessToken');
        
        // Create a custom instance with extended timeout for PDFs
        const pdfAxiosInstance = axios.create({
          baseURL: this.baseURL,
          timeout: 240000, // 4 minutes timeout for PDFs
          responseType: 'blob',
          headers: {
            'Accept': 'application/pdf',
            'Authorization': token ? `Bearer ${token}` : undefined
          }
        });
        
        // Add a timestamp to prevent caching
        const timestampedUrl = `${processedUrl}${processedUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
        
        const response = await pdfAxiosInstance.get(timestampedUrl, {
          ...config,
          responseType: 'blob',
          headers: {
            'Accept': 'application/pdf',
            'Authorization': token ? `Bearer ${token}` : undefined,
            ...(config.headers || {})
          }
        });
        
        // Verify we got a PDF
        if (response.headers['content-type'] && 
            response.headers['content-type'].includes('application/pdf')) {
          return response.data;
        } else if (response.data instanceof Blob) {
          // Even without correct headers, if it's a blob, return it
          return response.data;
        } else {
          throw new Error('Response is not a valid PDF');
        }
      } catch (error) {
        console.error('Error fetching PDF:', error);
        
        // Create a more specific error message
        if (error.code === 'ECONNABORTED') {
          throw new Error('PDF generation timed out. Please try again or generate a smaller document.');
        }
        
        throw error;
      }
    }

    // Regular API request
    try {
      const response = await this.axiosInstance.get(processedUrl, config);
      return response.data;
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  async post(url, data, config = {}) {
    // Remove any /api prefix from URL if baseURL already has it
    const processedUrl = this.baseURLHasApiPrefix && url.startsWith('/api/') 
      ? url.substring(4) 
      : url;
    
    try {
      const response = await this.axiosInstance.post(processedUrl, data, config);
      return response.data;
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  async put(url, data, config = {}) {
    // Remove any /api prefix from URL if baseURL already has it
    const processedUrl = this.baseURLHasApiPrefix && url.startsWith('/api/') 
      ? url.substring(4) 
      : url;
    
    try {
      const response = await this.axiosInstance.put(processedUrl, data, config);
      return response.data;
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }
  
  async patch(url, data, config = {}) {
    // Remove any /api prefix from URL if baseURL already has it
    const processedUrl = this.baseURLHasApiPrefix && url.startsWith('/api/') 
      ? url.substring(4) 
      : url;
    
    try {
      const response = await this.axiosInstance.patch(processedUrl, data, config);
      return response.data;
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  async delete(url, config = {}) {
    // Remove any /api prefix from URL if baseURL already has it
    const processedUrl = this.baseURLHasApiPrefix && url.startsWith('/api/') 
      ? url.substring(4) 
      : url;
    
    try {
      const response = await this.axiosInstance.delete(processedUrl, config);
      return response.data;
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  _handleError(error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error Response:', error.response.status, error.response.data);
      if (error.response.data && error.response.data.error) {
        error.message = error.response.data.error;
      } else if (error.response.data && error.response.data.message) {
        error.message = error.response.data.message;
      } else {
        error.message = `Server error: ${error.response.status}`;
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error: No response received');
      error.message = 'No response from server';
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error:', error.message);
    }
  }
}

const apiClient = new ApiClient();

export default apiClient;