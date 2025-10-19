import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

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
      // Token expired or invalid - logout required
      console.log('Auto-logout: Received 401 response from server - invalid/expired token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('loginTimestamp');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      // Forbidden - valid token but insufficient permissions, don't logout
      console.log('403 Forbidden: Valid token but insufficient permissions');
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

  complete2FALogin: async (sessionData: { session_token: string; totp_token: string }) => {
    const response = await api.post('/auth/complete-2fa-login', sessionData);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

// 2FA API
export const twoFAApi = {
  getStatus: async () => {
    const response = await api.get('/2fa/status');
    return response.data;
  },

  setup: async () => {
    const response = await api.post('/2fa/setup');
    return response.data;
  },

  verifySetup: async (token: string) => {
    const response = await api.post('/2fa/verify-setup', { token });
    return response.data;
  },

  disable: async (token: string) => {
    const response = await api.post('/2fa/disable', { token });
    return response.data;
  },

  generateBackupCodes: async () => {
    const response = await api.post('/2fa/generate-backup-codes');
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


  requestAccountVerification: async () => {
    const response = await api.post('/user/request-account-verification');
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
    const response = await api.get(`/loans/${loanId}/analytics`);
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

  getUserTransactions: async (userId: string, limit = 50, offset = 0) => {
    const response = await api.get(`/admin/users/${userId}/transactions`, {
      params: { limit, offset }
    });
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

  downloadDocument: async (documentId: string) => {
    const response = await api.get(`/admin/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Loan management
  updateLoan: async (loanId: string, loanData: {
    principalAmount?: number;
    currentBalance?: number;
    monthlyRate?: number;
    totalBonuses?: number;
    totalWithdrawals?: number;
  }) => {
    const response = await api.put(`/admin/loans/${loanId}`, loanData);
    return response.data;
  },

  deleteLoan: async (loanId: string) => {
    const response = await api.delete(`/admin/loans/${loanId}`);
    return response.data;
  },

  addTransaction: async (loanId: string, transactionData: {
    amount: number;
    transactionType: 'loan' | 'monthly_payment' | 'bonus' | 'withdrawal';
    description?: string;
    transactionDate?: string;
    bonusPercentage?: number;
  }) => {
    const response = await api.post(`/admin/loans/${loanId}/transactions`, transactionData);
    return response.data;
  },

  getLoanTransactions: async (loanId: string, limit = 50, offset = 0) => {
    const response = await api.get(`/admin/loans/${loanId}/transactions`, {
      params: { limit, offset }
    });
    return response.data;
  },

  // Get all loans across all users
  getAllLoans: async () => {
    const response = await api.get('/admin/loans');
    return response.data;
  },

  // Create loan account for user
  createLoan: async (loanData: {
    userId: number;
    principalAmount: number;
    monthlyRate?: number;
  }) => {
    const response = await api.post('/admin/create-loan', loanData);
    return response.data;
  },

  // Toggle user account verification
  toggleUserVerification: async (userId: string, verified: boolean) => {
    const response = await api.put(`/admin/users/${userId}/verify`, { verified });
    return response.data;
  },

  // Get account verification requests
  getVerificationRequests: async (status?: string) => {
    const params = status ? { status } : {};
    const response = await api.get('/admin/verification-requests', { params });
    return response.data;
  },

  // Approve or reject verification request
  updateVerificationRequest: async (requestId: string, status: 'approved' | 'rejected', admin_notes?: string) => {
    const response = await api.put(`/admin/verification-requests/${requestId}`, { 
      status, 
      admin_notes 
    });
    return response.data;
  },

  // Excel Upload for Loan Updates
  uploadExcel: async (formData: FormData) => {
    const response = await api.post('/admin/loans/excel-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  downloadExcelTemplate: async () => {
    const response = await api.get('/admin/loans/excel-template', {
      responseType: 'arraybuffer',
    });
    return response.data;
  },

  // Excel Transaction Import
  uploadExcelTransactions: async (formData: FormData) => {
    const response = await api.post('/admin/loans/excel-transactions', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  downloadExcelTransactionsTemplate: async () => {
    const response = await api.get('/admin/loans/excel-transactions-template', {
      responseType: 'arraybuffer',
    });
    return response.data;
  },

  // Yield Deposits
  getYieldDeposits: async (filters?: { status?: string; user_id?: number; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.user_id) params.append('user_id', filters.user_id.toString());
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    
    const response = await api.get(`/admin/yield-deposits?${params.toString()}`);
    return response.data;
  },

  createYieldDeposit: async (depositData: {
    user_id: number;
    principal_amount: number;
    start_date: string;
    annual_yield_rate?: number;
    notes?: string;
  }) => {
    const response = await api.post('/admin/yield-deposits', depositData);
    return response.data;
  },

  updateYieldDeposit: async (id: number, updateData: {
    status?: string;
    notes?: string;
    principal_amount?: number;
  }) => {
    const response = await api.put(`/admin/yield-deposits/${id}`, updateData);
    return response.data;
  },

  getYieldDeposit: async (id: number) => {
    const response = await api.get(`/admin/yield-deposits/${id}`);
    return response.data;
  },

  triggerYieldPayout: async (id: number, payoutDate?: string) => {
    const response = await api.post(`/admin/yield-deposits/${id}/payout`, {
      payout_date: payoutDate,
    });
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