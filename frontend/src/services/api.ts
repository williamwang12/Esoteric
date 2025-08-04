import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

// User API
export const userApi = {
  getProfile: async () => {
    const response = await api.get('/user/profile');
    return response.data;
  },

  updateProfile: async (userData: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => {
    const response = await api.put('/user/profile', userData);
    return response.data;
  },
};

// Loans API
export const loansApi = {
  getLoans: async () => {
    const response = await api.get('/loans');
    return response.data;
  },

  getLoanTransactions: async (loanId: string) => {
    const response = await api.get(`/loans/${loanId}/transactions`);
    return response.data;
  },

  getLoanPerformance: async (loanId: string) => {
    const response = await api.get(`/loans/${loanId}/performance`);
    return response.data;
  },

  getPayments: async (loanId: string) => {
    const response = await api.get(`/loans/${loanId}/payments`);
    return response.data;
  },
};

// Documents API
export const documentsApi = {
  getDocuments: async (category?: string) => {
    const params = category ? { category } : {};
    const response = await api.get('/documents', { params });
    return response.data;
  },

  downloadDocument: async (documentId: string) => {
    const response = await api.get(`/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Admin API
export const adminApi = {
  getUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },

  getUserLoans: async (userId: string) => {
    const response = await api.get(`/admin/users/${userId}/loans`);
    return response.data;
  },

  getUserDocuments: async (userId: string) => {
    const response = await api.get(`/admin/users/${userId}/documents`);
    return response.data;
  },

  uploadDocument: async (formData: FormData) => {
    const response = await api.post('/admin/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteDocument: async (documentId: string) => {
    const response = await api.delete(`/admin/documents/${documentId}`);
    return response.data;
  },
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api; 