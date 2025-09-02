import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  Snackbar,
  Badge,
  keyframes,
  styled,
} from '@mui/material';
import {
  Upload,
  Download,
  Delete,
  People,
  Description,
  AccountBalance,
  Edit,
  Add,
  Save,
  AttachMoney,
  Receipt,
  CheckCircle,
  Cancel as CancelIcon,
  Verified,
  Schedule,
  Search,
  Clear,
  AccountBalanceWallet,
  CalendarMonth,
  RequestPage,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import AppNavigation from '../components/AppNavigation';

const FloatingOrb = styled(Box)(({ theme }) => ({
  position: 'absolute',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(147, 51, 234, 0.15))',
  filter: 'blur(80px)',
  animation: `${keyframes`
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
    33% { transform: translate(50px, -50px) scale(1.1); opacity: 0.4; }
    66% { transform: translate(-40px, 40px) scale(0.9); opacity: 0.8; }
  `} 20s ease-in-out infinite`,
  pointerEvents: 'none',
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Memoized UserCard component for better performance
const UserCard = memo(({ user, isSelected, onClick }: {
  user: any;
  isSelected: boolean;
  onClick: (userId: string) => void;
}) => (
  <Card 
    variant="outlined" 
    sx={{ 
      cursor: 'pointer',
      transition: 'all 0.2s',
      '&:hover': {
        boxShadow: 2,
        transform: 'translateY(-1px)'
      },
      backgroundColor: isSelected ? 'action.selected' : 'background.paper'
    }}
    onClick={() => onClick(user.id)}
  >
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {user.first_name} {user.last_name}
        </Typography>
        <Chip 
          icon={user.account_verified ? <CheckCircle /> : <CancelIcon />}
          label={user.account_verified ? 'Verified' : 'Unverified'}
          color={user.account_verified ? 'success' : 'default'}
          size="small"
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {user.email}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip 
          label={user.role || 'user'} 
          color={user.role === 'admin' ? 'secondary' : 'default'}
          size="small"
        />
        <Typography variant="caption" color="text.secondary">
          {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
        </Typography>
      </Box>
    </CardContent>
  </Card>
));

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [userDetailsTabValue, setUserDetailsTabValue] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [userLoans, setUserLoans] = useState<any[]>([]);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [loadingVerificationRequests, setLoadingVerificationRequests] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loadingWithdrawalRequests, setLoadingWithdrawalRequests] = useState(false);
  const [meetingRequests, setMeetingRequests] = useState<any[]>([]);
  const [loadingMeetingRequests, setLoadingMeetingRequests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Scheduling dialog state
  const [schedulingDialogOpen, setSchedulingDialogOpen] = useState(false);
  const [selectedMeetingRequest, setSelectedMeetingRequest] = useState<any>(null);
  const [schedulingData, setSchedulingData] = useState({
    scheduled_date: '',
    scheduled_time: '',
    meeting_link: '',
    admin_notes: ''
  });
  
  // Caching state
  const [userCache, setUserCache] = useState<Map<string, any>>(new Map());
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Memoized filtered users calculation
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm) return users;
    return users.filter((user) =>
      user.first_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(userSearchTerm.toLowerCase())
    );
  }, [users, userSearchTerm]);

  // Memoized pending meeting requests count for notification badge
  const pendingMeetingCount = useMemo(() => {
    return meetingRequests.filter(req => req.status === 'pending').length;
  }, [meetingRequests]);

  // Memoized pending withdrawal requests count for notification badge
  const pendingWithdrawalCount = useMemo(() => {
    return withdrawalRequests.filter(req => req.status === 'pending').length;
  }, [withdrawalRequests]);

  // Memoized pending verification requests count for notification badge
  const pendingVerificationCount = useMemo(() => {
    return verificationRequests.filter(req => req.status === 'pending').length;
  }, [verificationRequests]);
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    category: '',
    userId: '',
    file: null as File | null,
  });
  const [uploading, setUploading] = useState(false);

  // Loan editing state
  const [editingLoan, setEditingLoan] = useState<any>(null);
  const [loanEditForm, setLoanEditForm] = useState({
    principalAmount: '',
    currentBalance: '',
    monthlyRate: '',
    totalBonuses: '',
    totalWithdrawals: ''
  });
  const [loanEditDialogOpen, setLoanEditDialogOpen] = useState(false);
  const [savingLoan, setSavingLoan] = useState(false);

  // Transaction dialog state
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [selectedLoanForTransaction, setSelectedLoanForTransaction] = useState<any>(null);
  const [transactionForm, setTransactionForm] = useState({
    amount: '',
    transactionType: 'monthly_payment',
    description: '',
    transactionDate: '',
    bonusPercentage: ''
  });
  const [addingTransaction, setAddingTransaction] = useState(false);

  // Loan transactions state
  const [loanTransactions, setLoanTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [selectedLoanForTransactionView, setSelectedLoanForTransactionView] = useState<any>(null);

  // Create loan dialog state
  const [createLoanDialogOpen, setCreateLoanDialogOpen] = useState(false);
  const [createLoanForm, setCreateLoanForm] = useState({
    principalAmount: '',
    monthlyRate: '1.0' // Default 1% monthly rate
  });
  const [creatingLoan, setCreatingLoan] = useState(false);
  
  // Verification request dialog state
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [selectedVerificationRequest, setSelectedVerificationRequest] = useState<any>(null);
  const [verificationAction, setVerificationAction] = useState<'approved' | 'rejected' | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [processingVerification, setProcessingVerification] = useState(false);

  // Snackbar state for user feedback
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // If switching away from the users tab (index 0), clear the selected user details sub-tab
    if (newValue !== 0) {
      setUserDetailsTabValue(0); // Reset user details sub-tab
    } else if (newValue === 0) {
      // If switching to the users tab, refresh users data to show latest verification status
      fetchUsers(true);
    }
  };

  const handleUserDetailsTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setUserDetailsTabValue(newValue);
  };

  const fetchUsers = useCallback(async (forceRefresh = false) => {
    try {
      const now = Date.now();
      
      // Check if we have cached data and it's still valid
      if (!forceRefresh && users.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
        return; // Use cached data
      }
      
      setLoading(true);
      const usersData = await adminApi.getUsers();
      console.log('Users data received:', usersData);
      if (usersData.length > 0) {
        console.log('First user object:', usersData[0]);
        console.log('Created at field:', usersData[0].created_at);
      }
      setUsers(usersData);
      setLastFetchTime(now);
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Users fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [users.length, lastFetchTime, CACHE_DURATION]);


  const fetchVerificationRequests = async () => {
    try {
      setLoadingVerificationRequests(true);
      const requests = await adminApi.getVerificationRequests();
      setVerificationRequests(requests);
    } catch (err) {
      console.error('Verification requests fetch error:', err);
      setError('Failed to fetch verification requests');
    } finally {
      setLoadingVerificationRequests(false);
    }
  };

  const fetchWithdrawalRequests = async () => {
    try {
      setLoadingWithdrawalRequests(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/withdrawal-requests`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch withdrawal requests');
      }
      const requests = await response.json();
      setWithdrawalRequests(requests);
    } catch (err) {
      console.error('Withdrawal requests fetch error:', err);
      setError('Failed to fetch withdrawal requests');
    } finally {
      setLoadingWithdrawalRequests(false);
    }
  };

  const fetchMeetingRequests = async () => {
    try {
      setLoadingMeetingRequests(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/meeting-requests`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch meeting requests');
      }
      const requests = await response.json();
      setMeetingRequests(requests);
    } catch (err) {
      console.error('Meeting requests fetch error:', err);
      setError('Failed to fetch meeting requests');
    } finally {
      setLoadingMeetingRequests(false);
    }
  };

  const fetchUserDetails = useCallback(async (userId: string, forceRefresh = false) => {
    try {
      // Check cache first (unless forcing refresh)
      const cacheKey = `user_${userId}`;
      const cachedData = userCache.get(cacheKey);
      const now = Date.now();
      
      if (!forceRefresh && cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        setSelectedUser(cachedData.user);
        setUserDocuments(cachedData.documents);
        setUserLoans(cachedData.loans);
        setUserTransactions(cachedData.transactions);
        return;
      }
      
      const [documentsData, loansData, transactionsData] = await Promise.all([
        adminApi.getUserDocuments(userId),
        adminApi.getUserLoans(userId),
        adminApi.getUserTransactions(userId),
      ]);
      
      // Cache the results
      const newCache = new Map(userCache);
      newCache.set(cacheKey, {
        user: documentsData.user,
        documents: documentsData.documents,
        loans: loansData.loans,
        transactions: transactionsData.transactions,
        timestamp: now
      });
      setUserCache(newCache);
      
      setSelectedUser(documentsData.user);
      setUserDocuments(documentsData.documents);
      setUserLoans(loansData.loans);
      setUserTransactions(transactionsData.transactions);
    } catch (err) {
      console.error('User details fetch error:', err);
    }
  }, [userCache, CACHE_DURATION]);

  // Memoized event handlers
  const handleUserClick = useCallback((userId: string) => {
    fetchUserDetails(userId);
  }, [fetchUserDetails]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUserSearchTerm(event.target.value);
  }, []);

  const handleUploadDocument = async () => {
    if (!uploadForm.file || !uploadForm.title || !uploadForm.category || !uploadForm.userId) {
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('document', uploadForm.file);
      formData.append('title', uploadForm.title);
      formData.append('category', uploadForm.category);
      formData.append('userId', uploadForm.userId);

      await adminApi.uploadDocument(formData);
      
      // Refresh data
      await fetchUsers();
      if (selectedUser && selectedUser.id === uploadForm.userId) {
        await fetchUserDetails(uploadForm.userId);
      }

      // Reset form
      setUploadForm({
        title: '',
        category: '',
        userId: '',
        file: null,
      });
      setUploadDialogOpen(false);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await adminApi.deleteDocument(documentId);
      
      // Refresh data
      if (selectedUser) {
        await fetchUserDetails(selectedUser.id);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDocumentDownload = async (documentId: string, title: string) => {
    try {
      const blob = await adminApi.downloadDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = title;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleEditLoan = (loan: any) => {
    setEditingLoan(loan);
    setLoanEditForm({
      principalAmount: loan.principal_amount,
      currentBalance: loan.current_balance,
      monthlyRate: (parseFloat(loan.monthly_rate) * 100).toString(),
      totalBonuses: loan.total_bonuses,
      totalWithdrawals: loan.total_withdrawals
    });
    setLoanEditDialogOpen(true);
  };

  const handleSaveLoan = async () => {
    if (!editingLoan) return;

    try {
      setSavingLoan(true);
      const updateData: any = {};

      if (loanEditForm.principalAmount !== editingLoan.principal_amount) {
        updateData.principalAmount = parseFloat(loanEditForm.principalAmount);
      }
      if (loanEditForm.currentBalance !== editingLoan.current_balance) {
        updateData.currentBalance = parseFloat(loanEditForm.currentBalance);
      }
      if ((parseFloat(loanEditForm.monthlyRate) / 100).toString() !== editingLoan.monthly_rate) {
        updateData.monthlyRate = parseFloat(loanEditForm.monthlyRate) / 100;
      }
      if (loanEditForm.totalBonuses !== editingLoan.total_bonuses) {
        updateData.totalBonuses = parseFloat(loanEditForm.totalBonuses);
      }
      if (loanEditForm.totalWithdrawals !== editingLoan.total_withdrawals) {
        updateData.totalWithdrawals = parseFloat(loanEditForm.totalWithdrawals);
      }

      if (Object.keys(updateData).length > 0) {
        await adminApi.updateLoan(editingLoan.id, updateData);
        
        // Refresh loan data
        if (selectedUser) {
          await fetchUserDetails(selectedUser.id);
        }
      }

      setLoanEditDialogOpen(false);
      setEditingLoan(null);
    } catch (error) {
      console.error('Loan update error:', error);
    } finally {
      setSavingLoan(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteLoan = async (loanId: string) => {
    if (!window.confirm('Are you sure you want to delete this loan account? This action cannot be undone and will delete all associated transactions.')) {
      return;
    }

    try {
      await adminApi.deleteLoan(loanId);
      
      // Refresh loan data
      if (selectedUser) {
        await fetchUserDetails(selectedUser.id);
      }
    } catch (error) {
      console.error('Loan deletion error:', error);
    }
  };

  const handleAddTransaction = (loan: any) => {
    console.log('Adding transaction for loan:', loan);
    setSelectedLoanForTransaction(loan);
    setTransactionForm({
      amount: '',
      transactionType: 'monthly_payment',
      description: '',
      transactionDate: new Date().toISOString().split('T')[0],
      bonusPercentage: ''
    });
    setTransactionDialogOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!selectedLoanForTransaction || !transactionForm.amount) return;

    try {
      setAddingTransaction(true);
      const transactionData: any = {
        amount: parseFloat(transactionForm.amount),
        transactionType: transactionForm.transactionType,
        description: transactionForm.description,
        transactionDate: transactionForm.transactionDate
      };

      if (transactionForm.bonusPercentage && transactionForm.transactionType === 'bonus') {
        transactionData.bonusPercentage = parseFloat(transactionForm.bonusPercentage) / 100;
      }

      await adminApi.addTransaction(selectedLoanForTransaction.id, transactionData);
      
      // Refresh loan data
      if (selectedUser) {
        await fetchUserDetails(selectedUser.id);
      }

      setTransactionDialogOpen(false);
      setSelectedLoanForTransaction(null);
    } catch (error) {
      console.error('Transaction creation error:', error);
    } finally {
      setAddingTransaction(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchLoanTransactions = async (loanId: string, loanData?: any) => {
    try {
      setLoadingTransactions(true);
      const data = await adminApi.getLoanTransactions(loanId);
      setLoanTransactions(data.transactions);
      
      // If loanData is provided, open the modal to view transactions
      if (loanData) {
        setSelectedLoanForTransactionView(loanData);
        setTransactionsModalOpen(true);
      }
    } catch (error) {
      console.error('Transactions fetch error:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleCreateLoan = async () => {
    if (!selectedUser || !createLoanForm.principalAmount) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        severity: 'error'
      });
      return;
    }

    try {
      setCreatingLoan(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const response = await adminApi.createLoan({
        userId: selectedUser.id,
        principalAmount: parseFloat(createLoanForm.principalAmount),
        monthlyRate: parseFloat(createLoanForm.monthlyRate) / 100 // Convert percentage to decimal
      });
      
      // Show success message
      setSnackbar({
        open: true,
        message: `Loan account created successfully for ${selectedUser.firstName} ${selectedUser.lastName}`,
        severity: 'success'
      });
      
      // Refresh user loan data and users list
      await Promise.all([
        fetchUserDetails(selectedUser.id, true), // Force refresh user details
        fetchUsers(true) // Force refresh the users list
      ]);
      
      // Reset form and close dialog
      setCreateLoanForm({
        principalAmount: '',
        monthlyRate: '1.0'
      });
      setCreateLoanDialogOpen(false);
    } catch (error: any) {
      console.error('Loan creation error:', error);
      
      // Show error message with specific details
      let errorMessage = 'Failed to create loan account';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setCreatingLoan(false);
    }
  };

  const handleVerificationRequest = async () => {
    if (!selectedVerificationRequest || !verificationAction) return;
    
    try {
      setProcessingVerification(true);
      await adminApi.updateVerificationRequest(
        selectedVerificationRequest.id,
        verificationAction,
        verificationNotes || undefined
      );
      
      // Refresh data
      await Promise.all([fetchVerificationRequests(), fetchUsers()]);
      
      // Close dialog and reset state
      setVerificationDialogOpen(false);
      setSelectedVerificationRequest(null);
      setVerificationAction(null);
      setVerificationNotes('');
      
      // Show success message
      setSnackbar({
        open: true,
        message: `Verification request ${verificationAction} successfully`,
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Verification request error:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to process verification request',
        severity: 'error'
      });
    } finally {
      setProcessingVerification(false);
    }
  };

  const openVerificationDialog = (request: any, action: 'approved' | 'rejected') => {
    setSelectedVerificationRequest(request);
    setVerificationAction(action);
    setVerificationDialogOpen(true);
  };

  const updateWithdrawalRequestStatus = async (requestId: string, status: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/withdrawal-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update withdrawal request');
      }

      // Refresh the withdrawal requests
      await fetchWithdrawalRequests();
    } catch (error) {
      console.error('Update withdrawal request error:', error);
      setError('Failed to update withdrawal request');
    }
  };

  const handleCompleteWithdrawal = async (requestId: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/withdrawal-requests/${requestId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to complete withdrawal request');
      }

      // Refresh the withdrawal requests
      await fetchWithdrawalRequests();
      setSnackbar({
        open: true,
        message: 'Withdrawal processed successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Complete withdrawal error:', error);
      setError('Failed to complete withdrawal request');
    }
  };

  // Open scheduling dialog
  const handleScheduleClick = (request: any) => {
    setSelectedMeetingRequest(request);
    setSchedulingData({
      scheduled_date: '',
      scheduled_time: '',
      meeting_link: '',
      admin_notes: ''
    });
    setSchedulingDialogOpen(true);
  };

  // Handle scheduling submission
  const handleScheduleSubmit = async () => {
    if (!selectedMeetingRequest) return;
    
    if (!schedulingData.scheduled_date || !schedulingData.scheduled_time) {
      setError('Please fill in both date and time');
      return;
    }

    // Require Google Meet link for video meetings
    if (selectedMeetingRequest.meeting_type === 'video' && !schedulingData.meeting_link) {
      setError('Google Meet link is required for video meetings');
      return;
    }

    await updateMeetingRequestStatus(selectedMeetingRequest.id, 'scheduled', schedulingData);
    setSchedulingDialogOpen(false);
    setSelectedMeetingRequest(null);
  };

  const updateMeetingRequestStatus = async (requestId: string, status: string, schedulingData?: any) => {
    try {
      const body: any = { status };
      
      // If scheduling, include date and time
      if (status === 'scheduled' && schedulingData) {
        body.scheduled_date = schedulingData.scheduled_date;
        body.scheduled_time = schedulingData.scheduled_time;
        body.meeting_link = schedulingData.meeting_link || '';
        body.admin_notes = schedulingData.admin_notes || '';
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/admin/meeting-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to update meeting request');
      }

      // Refresh the meeting requests
      await fetchMeetingRequests();
    } catch (error) {
      console.error('Update meeting request error:', error);
      setError('Failed to update meeting request');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchVerificationRequests();
    fetchWithdrawalRequests();
    fetchMeetingRequests();
  }, []);

  // Removed redundant useEffect - using useMemo for filtering instead

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Background Orbs */}
      <FloatingOrb sx={{ width: 300, height: 300, top: '8%', left: '3%' }} />
      <FloatingOrb sx={{ width: 200, height: 200, bottom: '10%', right: '8%', animationDelay: '-7s' }} />
      <FloatingOrb sx={{ width: 150, height: 150, top: '50%', left: '85%', animationDelay: '-3s' }} />

      {/* Navigation Bar */}
      <AppNavigation 
        onTabChange={(tabIndex) => {
          // Navigate back to dashboard with the selected tab
          navigate('/dashboard', { state: { selectedTab: tabIndex } });
        }}
      />

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, position: 'relative', zIndex: 1 }}>
        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && !error && (
          <>
            {/* Tab Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange} 
                aria-label="admin tabs"
                textColor="primary"
                indicatorColor="primary"
              >
                <Tab 
                  icon={<People />} 
                  label="Users" 
                  id="admin-tab-0"
                  aria-controls="admin-tabpanel-0"
                />
                <Tab 
                  icon={
                    <Badge 
                      badgeContent={pendingVerificationCount} 
                      color="error"
                      invisible={pendingVerificationCount === 0}
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: '#EF4444',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                        }
                      }}
                    >
                      <Verified />
                    </Badge>
                  } 
                  label="Verification Requests" 
                  id="admin-tab-1"
                  aria-controls="admin-tabpanel-1"
                />
                <Tab 
                  icon={
                    <Badge 
                      badgeContent={pendingWithdrawalCount} 
                      color="error"
                      invisible={pendingWithdrawalCount === 0}
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: '#EF4444',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                        }
                      }}
                    >
                      <AccountBalanceWallet />
                    </Badge>
                  } 
                  label="Withdrawal Requests" 
                  id="admin-tab-2"
                  aria-controls="admin-tabpanel-2"
                />
                <Tab 
                  icon={
                    <Badge 
                      badgeContent={pendingMeetingCount} 
                      color="error"
                      invisible={pendingMeetingCount === 0}
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: '#EF4444',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                        }
                      }}
                    >
                      <CalendarMonth />
                    </Badge>
                  } 
                  label="Meetings" 
                  id="admin-tab-3"
                  aria-controls="admin-tabpanel-3"
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <TabPanel value={tabValue} index={0}>
              {/* Users Tab - Two Column Layout */}
              <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 200px)', minHeight: '600px' }}>
                {/* Left Column - Users List */}
                <Card sx={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6">
                        Users
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {filteredUsers.length} of {users.length}
                      </Typography>
                    </Box>
                    
                    {/* Search Bar */}
                    <Box sx={{ mb: 3 }}>
                      <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Search by name..."
                        value={userSearchTerm}
                        onChange={handleSearchChange}
                        InputProps={{
                          startAdornment: (
                            <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                              <Search color="action" />
                            </Box>
                          ),
                          endAdornment: userSearchTerm && (
                            <IconButton
                              size="small"
                              onClick={() => setUserSearchTerm('')}
                              sx={{ mr: 1 }}
                            >
                              <Clear />
                            </IconButton>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                              borderColor: 'primary.main',
                            },
                          },
                        }}
                      />
                    </Box>

                    {/* Users List */}
                    <Box sx={{ 
                      flex: 1, 
                      overflow: 'auto',
                      pr: 2, // Add right padding to create space from scrollbar
                      mr: -2 // Negative margin to maintain original width
                    }}>
                      {filteredUsers.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {filteredUsers.map((user) => (
                            <UserCard
                              key={user.id}
                              user={user}
                              isSelected={selectedUser?.id === user.id}
                              onClick={handleUserClick}
                            />
                          ))}
                        </Box>
                      ) : userSearchTerm.trim() ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <Search sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No users found
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Try adjusting your search terms or clear the search.
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <Typography variant="body1" color="text.secondary">
                            Loading users...
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* Right Column - User Details */}
                <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}>
                    {selectedUser ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* User Header */}
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
                            {selectedUser.firstName} {selectedUser.lastName}
                          </Typography>
                          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                            {selectedUser.email}
                          </Typography>
                        </Box>

                        {/* User Details Subtabs */}
                        <Box sx={{ mb: 3 }}>
                          <Tabs 
                            value={userDetailsTabValue} 
                            onChange={handleUserDetailsTabChange}
                            aria-label="user details tabs"
                            variant="fullWidth"
                            sx={{
                              '& .MuiTabs-indicator': {
                                background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                              },
                              '& .MuiTab-root': {
                                textTransform: 'none',
                                fontWeight: 600,
                                '&.Mui-selected': {
                                  color: 'primary.main',
                                },
                              },
                            }}
                          >
                            <Tab 
                              icon={<AccountBalance />} 
                              label={`Loans (${userLoans.length})`}
                              id="user-tab-0"
                            />
                            <Tab 
                              icon={<Receipt />} 
                              label={`Transactions (${userTransactions.length})`}
                              id="user-tab-1"
                            />
                            <Tab 
                              icon={<Description />} 
                              label={`Documents (${userDocuments.length})`}
                              id="user-tab-2"
                            />
                          </Tabs>
                        </Box>

                        {/* Tab Content */}
                        <Box sx={{ flex: 1, overflow: 'auto' }}>
                          {/* User Loans Subtab */}
                          {userDetailsTabValue === 0 && (
                            <Box>
                              {userLoans.length > 0 ? (
                                <TableContainer sx={{ 
                                  borderRadius: 2, 
                                  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15), 0 2px 4px -1px rgb(0 0 0 / 0.1)',
                                  backgroundColor: '#1a1a1a',
                                  border: '1px solid #333',
                                }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ backgroundColor: '#2d2d2d' }}>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Account Number</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Principal</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Current Balance</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Monthly Rate</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {userLoans.map((loan) => (
                                        <TableRow key={loan.id} hover sx={{ 
                                          '&:hover': { backgroundColor: '#333' },
                                          backgroundColor: '#1a1a1a'
                                        }}>
                                          <TableCell sx={{ 
                                            fontFamily: 'monospace', 
                                            fontWeight: 600, 
                                            color: '#6B46C1',
                                            borderBottom: '1px solid #333'
                                          }}>
                                            {loan.account_number}
                                          </TableCell>
                                          <TableCell sx={{ fontWeight: 500, color: '#e0e0e0', borderBottom: '1px solid #333' }}>
                                            {formatCurrency(loan.principal_amount)}
                                          </TableCell>
                                          <TableCell sx={{ fontWeight: 600, color: '#10B981', borderBottom: '1px solid #333' }}>
                                            {formatCurrency(loan.current_balance)}
                                          </TableCell>
                                          <TableCell sx={{ borderBottom: '1px solid #333' }}>
                                            <Chip 
                                              label={`${(parseFloat(loan.monthly_rate) * 100).toFixed(1)}%`}
                                              sx={{ 
                                                fontWeight: 600,
                                                backgroundColor: '#374151',
                                                color: '#60A5FA',
                                                border: '1px solid #4B5563'
                                              }}
                                              size="small"
                                            />
                                          </TableCell>
                                          <TableCell sx={{ borderBottom: '1px solid #333' }}>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                              <IconButton
                                                size="small"
                                                onClick={() => handleEditLoan(loan)}
                                                title="Edit Loan"
                                                sx={{ 
                                                  color: '#6B46C1',
                                                  '&:hover': { 
                                                    backgroundColor: '#6B46C1', 
                                                    color: 'white',
                                                    transform: 'scale(1.1)'
                                                  },
                                                  transition: 'all 0.2s'
                                                }}
                                              >
                                                <Edit />
                                              </IconButton>
                                              <IconButton
                                                size="small"
                                                onClick={() => handleAddTransaction(loan)}
                                                title="Add Transaction"
                                                sx={{ 
                                                  color: '#10B981',
                                                  '&:hover': { 
                                                    backgroundColor: '#10B981', 
                                                    color: 'white',
                                                    transform: 'scale(1.1)'
                                                  },
                                                  transition: 'all 0.2s'
                                                }}
                                              >
                                                <Add />
                                              </IconButton>
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              ) : (
                                <Box sx={{ 
                                  textAlign: 'center', 
                                  py: 6,
                                  background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                                  borderRadius: 2,
                                  border: '2px dashed #444',
                                  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)'
                                }}>
                                  <AccountBalance sx={{ fontSize: 48, color: '#6B46C1', mb: 2 }} />
                                  <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                                    No Loan Account
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                                    This user doesn't have a loan account yet.
                                  </Typography>
                                  <Button
                                    variant="contained"
                                    startIcon={<Add />}
                                    onClick={() => setCreateLoanDialogOpen(true)}
                                    size="large"
                                    sx={{ 
                                      background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                                      boxShadow: '0 4px 12px rgb(107 70 193 / 0.4)',
                                      '&:hover': {
                                        background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
                                        boxShadow: '0 6px 16px rgb(107 70 193 / 0.6)',
                                        transform: 'translateY(-1px)',
                                      },
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    Create Loan Account
                                  </Button>
                                </Box>
                              )}
                            </Box>
                          )}

                          {/* User Transactions Subtab */}
                          {userDetailsTabValue === 1 && (
                            <Box>
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                                {userLoans.length > 0 && (
                                  <Button
                                    variant="contained"
                                    startIcon={<Add />}
                                    onClick={() => handleAddTransaction(userLoans[0])}
                                    sx={{ 
                                      background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                                      boxShadow: '0 4px 12px rgb(107 70 193 / 0.4)',
                                      '&:hover': {
                                        background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
                                        boxShadow: '0 6px 16px rgb(107 70 193 / 0.6)',
                                        transform: 'translateY(-1px)',
                                      },
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    Add Transaction
                                  </Button>
                                )}
                              </Box>
                              
                              {userTransactions.length > 0 ? (
                                <TableContainer sx={{ 
                                  borderRadius: 2, 
                                  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15), 0 2px 4px -1px rgb(0 0 0 / 0.1)',
                                  backgroundColor: '#1a1a1a',
                                  border: '1px solid #333',
                                }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ backgroundColor: '#2d2d2d' }}>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Date</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Type</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Amount</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Description</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {userTransactions.map((transaction) => (
                                        <TableRow key={transaction.id} hover sx={{ 
                                          '&:hover': { backgroundColor: '#333' },
                                          backgroundColor: '#1a1a1a'
                                        }}>
                                          <TableCell sx={{ fontWeight: 500, color: '#e0e0e0', borderBottom: '1px solid #333' }}>
                                            {new Date(transaction.transaction_date).toLocaleDateString()}
                                          </TableCell>
                                          <TableCell sx={{ borderBottom: '1px solid #333' }}>
                                            <Chip 
                                              label={transaction.transaction_type.replace('_', ' ')}
                                              size="small"
                                              sx={{ 
                                                fontWeight: 600, 
                                                textTransform: 'capitalize',
                                                backgroundColor: 
                                                  transaction.transaction_type === 'withdrawal' ? '#7F1D1D' :
                                                  transaction.transaction_type === 'bonus' ? '#14532D' :
                                                  transaction.transaction_type === 'loan' ? '#1E3A8A' :
                                                  '#374151',
                                                color: 
                                                  transaction.transaction_type === 'withdrawal' ? '#FCA5A5' :
                                                  transaction.transaction_type === 'bonus' ? '#86EFAC' :
                                                  transaction.transaction_type === 'loan' ? '#93C5FD' :
                                                  '#D1D5DB',
                                                border: '1px solid',
                                                borderColor:
                                                  transaction.transaction_type === 'withdrawal' ? '#991B1B' :
                                                  transaction.transaction_type === 'bonus' ? '#166534' :
                                                  transaction.transaction_type === 'loan' ? '#1D4ED8' :
                                                  '#4B5563'
                                              }}
                                            />
                                          </TableCell>
                                          <TableCell sx={{ 
                                            color: transaction.transaction_type === 'withdrawal' ? '#F87171' : '#34D399',
                                            fontWeight: 600,
                                            fontFamily: 'monospace',
                                            borderBottom: '1px solid #333'
                                          }}>
                                            {transaction.transaction_type === 'withdrawal' ? '-' : '+'}
                                            {formatCurrency(Math.abs(parseFloat(transaction.amount)))}
                                          </TableCell>
                                          <TableCell sx={{ color: '#9ca3af', borderBottom: '1px solid #333' }}>
                                            {transaction.description || '-'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              ) : (
                                <Box sx={{ 
                                  textAlign: 'center', 
                                  py: 6,
                                  background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                                  borderRadius: 2,
                                  border: '2px dashed #444',
                                  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)'
                                }}>
                                  <Receipt sx={{ fontSize: 48, color: '#10B981', mb: 2 }} />
                                  <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                                    No Transactions
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                    This user doesn't have a loan account yet, so there's no transaction history to display.
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          )}

                          {/* User Documents Subtab */}
                          {userDetailsTabValue === 2 && (
                            <Box>
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                                <Button
                                  variant="contained"
                                  startIcon={<Upload />}
                                  onClick={() => {
                                    setUploadForm(prev => ({ ...prev, userId: selectedUser.id }));
                                    setUploadDialogOpen(true);
                                  }}
                                  sx={{ 
                                    background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                                    boxShadow: '0 4px 12px rgb(107 70 193 / 0.4)',
                                    '&:hover': {
                                      background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
                                      boxShadow: '0 6px 16px rgb(107 70 193 / 0.6)',
                                      transform: 'translateY(-1px)',
                                    },
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  Upload Document
                                </Button>
                              </Box>
                              
                              {userDocuments.length > 0 ? (
                                <TableContainer sx={{ 
                                  borderRadius: 2, 
                                  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15), 0 2px 4px -1px rgb(0 0 0 / 0.1)',
                                  backgroundColor: '#1a1a1a',
                                  border: '1px solid #333',
                                }}>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ backgroundColor: '#2d2d2d' }}>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Title</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Category</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Size</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Upload Date</TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#e0e0e0', borderBottom: '1px solid #444' }}>Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {userDocuments.map((doc) => (
                                        <TableRow key={doc.id} hover sx={{ 
                                          '&:hover': { backgroundColor: '#333' },
                                          backgroundColor: '#1a1a1a'
                                        }}>
                                          <TableCell sx={{ fontWeight: 600, color: '#6B46C1', borderBottom: '1px solid #333' }}>
                                            {doc.title}
                                          </TableCell>
                                          <TableCell sx={{ borderBottom: '1px solid #333' }}>
                                            <Chip 
                                              label={doc.category} 
                                              size="small" 
                                              sx={{ 
                                                fontWeight: 600, 
                                                textTransform: 'capitalize',
                                                backgroundColor: '#374151',
                                                color: '#9333EA',
                                                border: '1px solid #4B5563'
                                              }}
                                            />
                                          </TableCell>
                                          <TableCell sx={{ fontFamily: 'monospace', color: '#9ca3af', borderBottom: '1px solid #333' }}>
                                            {doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Unknown'}
                                          </TableCell>
                                          <TableCell sx={{ fontWeight: 500, color: '#e0e0e0', borderBottom: '1px solid #333' }}>
                                            {new Date(doc.upload_date).toLocaleDateString()}
                                          </TableCell>
                                          <TableCell sx={{ borderBottom: '1px solid #333' }}>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                              <IconButton
                                                size="small"
                                                onClick={() => handleDocumentDownload(doc.id, doc.title)}
                                                title="Download Document"
                                                sx={{ 
                                                  color: '#6B46C1',
                                                  '&:hover': { 
                                                    backgroundColor: '#6B46C1', 
                                                    color: 'white',
                                                    transform: 'scale(1.1)'
                                                  },
                                                  transition: 'all 0.2s'
                                                }}
                                              >
                                                <Download />
                                              </IconButton>
                                              <IconButton
                                                size="small"
                                                onClick={() => handleDeleteDocument(doc.id)}
                                                title="Delete Document"
                                                sx={{ 
                                                  color: '#DC2626',
                                                  '&:hover': { 
                                                    backgroundColor: '#DC2626', 
                                                    color: 'white',
                                                    transform: 'scale(1.1)'
                                                  },
                                                  transition: 'all 0.2s'
                                                }}
                                              >
                                                <Delete />
                                              </IconButton>
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              ) : (
                                <Box sx={{ 
                                  textAlign: 'center', 
                                  py: 6,
                                  background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                                  borderRadius: 2,
                                  border: '2px dashed #444',
                                  boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)'
                                }}>
                                  <Description sx={{ fontSize: 48, color: '#9333EA', mb: 2 }} />
                                  <Typography variant="h6" sx={{ color: '#e0e0e0', mb: 1 }}>
                                    No Documents
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                    No documents found for this user.
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        height: '100%',
                        textAlign: 'center'
                      }}>
                        <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h5" color="text.secondary" gutterBottom>
                          Select a User
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          Click on a user from the list to view their details, loans, transactions, and documents.
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {/* Verification Requests Tab */}
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6">
                      Account Verification Requests
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={fetchVerificationRequests}
                      disabled={loadingVerificationRequests}
                      startIcon={loadingVerificationRequests ? <CircularProgress size={16} /> : undefined}
                    >
                      {loadingVerificationRequests ? 'Loading...' : 'Refresh'}
                    </Button>
                  </Box>
                  
                  {loadingVerificationRequests ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : verificationRequests.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Schedule sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No Verification Requests
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        All users are verified or no requests have been submitted.
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>User</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Requested</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {verificationRequests.map((request) => (
                            <TableRow key={request.id}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {request.first_name} {request.last_name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {request.email}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {new Date(request.requested_at).toLocaleDateString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  color={
                                    request.status === 'pending' ? 'warning' :
                                    request.status === 'approved' ? 'success' : 'error'
                                  }
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                {request.status === 'pending' ? (
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="success"
                                      onClick={() => openVerificationDialog(request, 'approved')}
                                      startIcon={<CheckCircle />}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      onClick={() => openVerificationDialog(request, 'rejected')}
                                      startIcon={<CancelIcon />}
                                    >
                                      Reject
                                    </Button>
                                  </Box>
                                ) : (
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {request.status === 'approved' ? 'Approved' : 'Rejected'}
                                      {request.reviewer_first_name && (
                                        <> by {request.reviewer_first_name} {request.reviewer_last_name}</>
                                      )}
                                    </Typography>
                                    {request.admin_notes && (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        Notes: {request.admin_notes}
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            {/* Withdrawal Requests Tab */}
            <TabPanel value={tabValue} index={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Withdrawal Management
                </Typography>
                <Button
                  startIcon={<AccountBalanceWallet />}
                  onClick={fetchWithdrawalRequests}
                  disabled={loadingWithdrawalRequests}
                  variant="contained"
                >
                  Refresh
                </Button>
              </Box>
              {loadingWithdrawalRequests ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress size={60} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  
                  {/* Pending Withdrawal Requests Section */}
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <RequestPage sx={{ color: 'warning.main', fontSize: 28 }} />
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          Pending Withdrawal Requests ({pendingWithdrawalCount})
                        </Typography>
                      </Box>
                      
                      {pendingWithdrawalCount === 0 ? (
                        <Box sx={{ 
                          textAlign: 'center', 
                          py: 4,
                          background: 'rgba(245, 158, 11, 0.05)',
                          borderRadius: 2,
                          border: '1px dashed rgba(245, 158, 11, 0.3)'
                        }}>
                          <RequestPage sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                          <Typography variant="h6" color="text.secondary">
                            No pending withdrawal requests
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Withdrawal requests will appear here for review
                          </Typography>
                        </Box>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>User</TableCell>
                                <TableCell>Amount</TableCell>
                                <TableCell>Reason</TableCell>
                                <TableCell>Priority</TableCell>
                                <TableCell>Requested</TableCell>
                                <TableCell>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {withdrawalRequests.filter(req => req.status === 'pending').map((request) => (
                                <TableRow key={request.id}>
                                  <TableCell>
                                    <Box>
                                      <Typography variant="body2" fontWeight="medium">
                                        {request.first_name} {request.last_name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {request.email}
                                      </Typography>
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        Account: {request.account_number}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="h6" color="warning.main">
                                      ${parseFloat(request.amount).toLocaleString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Balance: ${parseFloat(request.current_balance).toLocaleString()}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {request.reason}
                                    </Typography>
                                    {request.notes && (
                                      <Typography variant="caption" color="text.secondary">
                                        Notes: {request.notes}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={request.urgency.toUpperCase()} 
                                      size="small"
                                      color={
                                        request.urgency === 'urgent' ? 'error' : 
                                        request.urgency === 'high' ? 'warning' : 
                                        request.urgency === 'normal' ? 'primary' : 'default'
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {new Date(request.created_at).toLocaleDateString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {new Date(request.created_at).toLocaleTimeString()}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        startIcon={<CheckCircle />}
                                        onClick={() => updateWithdrawalRequestStatus(request.id, 'approved')}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<CancelIcon />}
                                        onClick={() => updateWithdrawalRequestStatus(request.id, 'rejected')}
                                      >
                                        Reject
                                      </Button>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Approved/Processed Withdrawals Section */}
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <CheckCircle sx={{ color: 'success.main', fontSize: 28 }} />
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          Approved Withdrawals ({withdrawalRequests.filter(req => req.status === 'approved').length})
                        </Typography>
                      </Box>
                      
                      {withdrawalRequests.filter(req => req.status === 'approved').length === 0 ? (
                        <Box sx={{ 
                          textAlign: 'center', 
                          py: 4,
                          background: 'rgba(34, 197, 94, 0.05)',
                          borderRadius: 2,
                          border: '1px dashed rgba(34, 197, 94, 0.3)'
                        }}>
                          <CheckCircle sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                          <Typography variant="h6" color="text.secondary">
                            No approved withdrawals
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Approved withdrawals will appear here
                          </Typography>
                        </Box>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>User</TableCell>
                                <TableCell>Amount</TableCell>
                                <TableCell>Reason</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Dates</TableCell>
                                <TableCell>Admin Notes</TableCell>
                                <TableCell>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {withdrawalRequests.filter(req => req.status === 'approved').map((request) => (
                                <TableRow key={request.id}>
                                  <TableCell>
                                    <Box>
                                      <Typography variant="body2" fontWeight="medium">
                                        {request.first_name} {request.last_name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        Account: {request.account_number}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="h6" color="success.main">
                                      ${parseFloat(request.amount).toLocaleString()}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {request.reason}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={request.status.toUpperCase()} 
                                      size="small"
                                      color={
                                        request.status === 'approved' ? 'success' : 
                                        request.status === 'processed' ? 'info' : 'default'
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      Requested: {new Date(request.created_at).toLocaleDateString()}
                                    </Typography>
                                    {request.reviewed_at && (
                                      <Typography variant="caption" color="text.secondary">
                                        Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                      {request.admin_notes || 'No notes'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="contained"
                                      size="small"
                                      color="success"
                                      onClick={() => handleCompleteWithdrawal(request.id)}
                                      sx={{
                                        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                                        '&:hover': {
                                          background: 'linear-gradient(135deg, #16A34A, #15803D)',
                                        }
                                      }}
                                    >
                                      Complete
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* Completed Withdrawals Section */}
              <Box sx={{ mt: 4 }}>
                <Card sx={{ 
                  bgcolor: 'background.paper', 
                  borderRadius: 3, 
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                      <CheckCircle sx={{ color: 'info.main', fontSize: 28 }} />
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        Processed Withdrawals ({withdrawalRequests.filter(req => req.status === 'processed').length})
                      </Typography>
                    </Box>
                    
                    {withdrawalRequests.filter(req => req.status === 'processed').length === 0 ? (
                      <Box sx={{ 
                        textAlign: 'center', 
                        py: 4,
                        background: 'rgba(59, 130, 246, 0.05)',
                        borderRadius: 2,
                        border: '1px dashed',
                        borderColor: 'info.main'
                      }}>
                        <CheckCircle sx={{ fontSize: 48, color: 'info.main', mb: 2, opacity: 0.5 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No Completed Withdrawals
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Completed withdrawal transactions will appear here
                        </Typography>
                      </Box>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>User</TableCell>
                              <TableCell>Amount</TableCell>
                              <TableCell>Reason</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Dates</TableCell>
                              <TableCell>Admin Notes</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {withdrawalRequests.filter(req => req.status === 'processed').map((request) => (
                              <TableRow key={request.id}>
                                <TableCell>
                                  <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                      {request.first_name} {request.last_name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Account: {request.account_number}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="h6" color="info.main">
                                    ${parseFloat(request.amount).toLocaleString()}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {request.reason}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    label="COMPLETED" 
                                    size="small"
                                    color="info"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    Requested: {new Date(request.created_at).toLocaleDateString()}
                                  </Typography>
                                  {request.reviewed_at && (
                                    <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                                      Approved: {new Date(request.reviewed_at).toLocaleDateString()}
                                    </Typography>
                                  )}
                                  {request.completed_at && (
                                    <Typography variant="body2" color="info.main" sx={{ display: 'block' }}>
                                      Completed: {new Date(request.completed_at).toLocaleDateString()}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {request.admin_notes || 'No notes'}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </TabPanel>

            {/* Meetings Tab */}
            <TabPanel value={tabValue} index={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Meetings Management
                </Typography>
                <Button
                  startIcon={<CalendarMonth />}
                  onClick={fetchMeetingRequests}
                  disabled={loadingMeetingRequests}
                  variant="contained"
                >
                  Refresh
                </Button>
              </Box>

              {loadingMeetingRequests ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress size={60} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  
                  {/* Pending Meeting Requests Section */}
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <RequestPage sx={{ color: 'warning.main', fontSize: 28 }} />
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          Pending Requests ({pendingMeetingCount})
                        </Typography>
                      </Box>
                      
                      {pendingMeetingCount === 0 ? (
                        <Box sx={{ 
                          textAlign: 'center', 
                          py: 4,
                          background: 'rgba(245, 158, 11, 0.05)',
                          borderRadius: 2,
                          border: '1px dashed rgba(245, 158, 11, 0.3)'
                        }}>
                          <RequestPage sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                          <Typography variant="h6" color="text.secondary">
                            No pending meeting requests
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            New meeting requests will appear here
                          </Typography>
                        </Box>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>User</TableCell>
                                <TableCell>Purpose</TableCell>
                                <TableCell>Preferred Date/Time</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Priority</TableCell>
                                <TableCell>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {meetingRequests.filter(req => req.status === 'pending').map((request) => (
                                <TableRow key={request.id}>
                                  <TableCell>
                                    <Box>
                                      <Typography variant="body2" fontWeight="medium">
                                        {request.first_name} {request.last_name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {request.email}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {request.purpose}
                                    </Typography>
                                    {request.topics && (
                                      <Typography variant="caption" color="text.secondary">
                                        Topics: {request.topics}
                                      </Typography>
                                    )}
                                    {request.notes && (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        Notes: {request.notes}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {new Date(request.preferred_date).toLocaleDateString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {request.preferred_time}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={request.meeting_type.replace('_', ' ').toUpperCase()} 
                                      size="small"
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={request.urgency.toUpperCase()} 
                                      size="small"
                                      color={
                                        request.urgency === 'urgent' ? 'error' : 
                                        request.urgency === 'high' ? 'warning' : 
                                        request.urgency === 'normal' ? 'primary' : 'default'
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        startIcon={<CheckCircle />}
                                        onClick={() => handleScheduleClick(request)}
                                      >
                                        Schedule
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<CancelIcon />}
                                        onClick={() => updateMeetingRequestStatus(request.id, 'cancelled')}
                                      >
                                        Decline
                                      </Button>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Scheduled Meetings Section */}
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <CheckCircle sx={{ color: 'success.main', fontSize: 28 }} />
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          Scheduled Meetings ({meetingRequests.filter(req => req.status === 'scheduled').length})
                        </Typography>
                      </Box>
                      
                      {meetingRequests.filter(req => req.status === 'scheduled').length === 0 ? (
                        <Box sx={{ 
                          textAlign: 'center', 
                          py: 4,
                          background: 'rgba(34, 197, 94, 0.05)',
                          borderRadius: 2,
                          border: '1px dashed rgba(34, 197, 94, 0.3)'
                        }}>
                          <CheckCircle sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                          <Typography variant="h6" color="text.secondary">
                            No scheduled meetings
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Scheduled meetings will appear here
                          </Typography>
                        </Box>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>User</TableCell>
                                <TableCell>Purpose</TableCell>
                                <TableCell>Meeting Details</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Meeting Link</TableCell>
                                <TableCell>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {meetingRequests.filter(req => req.status === 'scheduled').map((request) => (
                                <TableRow key={request.id}>
                                  <TableCell>
                                    <Box>
                                      <Typography variant="body2" fontWeight="medium">
                                        {request.first_name} {request.last_name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {request.email}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {request.purpose}
                                    </Typography>
                                    {request.topics && (
                                      <Typography variant="caption" color="text.secondary">
                                        Topics: {request.topics}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight="medium" color="success.main">
                                      {request.scheduled_date ? 
                                        new Date(request.scheduled_date).toLocaleDateString() :
                                        new Date(request.preferred_date).toLocaleDateString()
                                      }
                                    </Typography>
                                    <Typography variant="caption" color="success.main">
                                      {request.scheduled_time || request.preferred_time}
                                    </Typography>
                                    {request.admin_notes && (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        Notes: {request.admin_notes}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={request.meeting_type.replace('_', ' ').toUpperCase()} 
                                      size="small"
                                      variant="outlined"
                                      color="success"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {request.meeting_link ? (
                                      <Button
                                        size="small"
                                        variant="text"
                                        color="primary"
                                        onClick={() => window.open(request.meeting_link, '_blank')}
                                      >
                                        Join Meeting
                                      </Button>
                                    ) : (
                                      <Typography variant="caption" color="text.secondary">
                                        No link provided
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="primary"
                                        onClick={() => updateMeetingRequestStatus(request.id, 'completed')}
                                      >
                                        Mark Complete
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={() => updateMeetingRequestStatus(request.id, 'cancelled')}
                                      >
                                        Cancel
                                      </Button>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              )}
            </TabPanel>

          </>
        )}
      </Container>

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            boxShadow: '0 8px 32px 0 rgb(0 0 0 / 0.37)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Upload />
          Upload Document
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#1a1a1a' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Document Title"
              value={uploadForm.title}
              onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={uploadForm.category}
                label="Category"
                onChange={(e) => setUploadForm(prev => ({ ...prev, category: e.target.value }))}
              >
                <MenuItem value="statement">Statement</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="invoice">Invoice</MenuItem>
                <MenuItem value="receipt">Receipt</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>User</InputLabel>
              <Select
                value={uploadForm.userId}
                label="User"
                onChange={(e) => setUploadForm(prev => ({ ...prev, userId: e.target.value }))}
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              component="label"
              variant="outlined"
              startIcon={<Upload />}
              sx={{ justifyContent: 'flex-start' }}
            >
              {uploadForm.file ? uploadForm.file.name : 'Choose File'}
              <input
                type="file"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadForm(prev => ({ ...prev, file }));
                  }
                }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
              />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUploadDocument}
            variant="contained"
            disabled={!uploadForm.file || !uploadForm.title || !uploadForm.category || !uploadForm.userId || uploading}
          >
            {uploading ? <CircularProgress size={20} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loan Edit Dialog */}
      <Dialog 
        open={loanEditDialogOpen} 
        onClose={() => setLoanEditDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            boxShadow: '0 8px 32px 0 rgb(0 0 0 / 0.37)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Edit />
          Edit Loan Account
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#1a1a1a' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mt: 2 }}>
            <TextField
              label="Principal Amount"
              type="number"
              value={loanEditForm.principalAmount}
              onChange={(e) => setLoanEditForm(prev => ({ ...prev, principalAmount: e.target.value }))}
              fullWidth
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>
              }}
            />
            
            <TextField
              label="Current Balance"
              type="number"
              value={loanEditForm.currentBalance}
              onChange={(e) => setLoanEditForm(prev => ({ ...prev, currentBalance: e.target.value }))}
              fullWidth
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>
              }}
            />

            <TextField
              label="Monthly Rate"
              type="number"
              value={loanEditForm.monthlyRate}
              onChange={(e) => setLoanEditForm(prev => ({ ...prev, monthlyRate: e.target.value }))}
              fullWidth
              InputProps={{
                endAdornment: <Typography sx={{ ml: 1, color: 'text.secondary' }}>%</Typography>
              }}
              helperText="Enter percentage (e.g., 1.5 for 1.5%)"
            />

            <TextField
              label="Total Bonuses"
              type="number"
              value={loanEditForm.totalBonuses}
              onChange={(e) => setLoanEditForm(prev => ({ ...prev, totalBonuses: e.target.value }))}
              fullWidth
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>
              }}
            />

            <TextField
              label="Total Withdrawals"
              type="number"
              value={loanEditForm.totalWithdrawals}
              onChange={(e) => setLoanEditForm(prev => ({ ...prev, totalWithdrawals: e.target.value }))}
              fullWidth
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>
              }}
              sx={{ gridColumn: 'span 2' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoanEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveLoan}
            variant="contained"
            disabled={savingLoan}
            startIcon={savingLoan ? <CircularProgress size={16} /> : <Save />}
            sx={{ 
              background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
              }
            }}
          >
            {savingLoan ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog 
        open={transactionDialogOpen} 
        onClose={() => setTransactionDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            boxShadow: '0 8px 32px 0 rgb(0 0 0 / 0.37)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <AttachMoney />
          Add Transaction
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#1a1a1a' }}>
          {selectedLoanForTransaction && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: '#2d2d2d', borderRadius: 1, border: '1px solid #444' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#e0e0e0' }}>
                Account: {selectedLoanForTransaction.account_number}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                {selectedLoanForTransaction.user?.firstName || selectedLoanForTransaction.first_name} {selectedLoanForTransaction.user?.lastName || selectedLoanForTransaction.last_name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                Current Balance: {formatCurrency(selectedLoanForTransaction.current_balance)}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#9ca3af', '&.Mui-focused': { color: '#10B981' } }}>
                Transaction Type
              </InputLabel>
              <Select
                value={transactionForm.transactionType}
                label="Transaction Type"
                onChange={(e) => setTransactionForm(prev => ({ ...prev, transactionType: e.target.value }))}
                sx={{
                  backgroundColor: '#2d2d2d',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#444',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#10B981',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#10B981',
                  },
                  '& .MuiSelect-select': {
                    color: '#e0e0e0',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#2d2d2d',
                      border: '1px solid #444',
                      '& .MuiMenuItem-root': {
                        color: '#e0e0e0',
                        '&:hover': {
                          backgroundColor: '#3d3d3d',
                        },
                        '&.Mui-selected': {
                          backgroundColor: '#10B981',
                          '&:hover': {
                            backgroundColor: '#059669',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="monthly_payment">Monthly Payment</MenuItem>
                <MenuItem value="bonus">Bonus Payment</MenuItem>
                <MenuItem value="withdrawal">Withdrawal</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Amount"
              type="number"
              value={transactionForm.amount}
              onChange={(e) => setTransactionForm(prev => ({ ...prev, amount: e.target.value }))}
              fullWidth
              required
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1, color: '#9ca3af' }}>$</Typography>
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2d2d2d',
                  '& fieldset': {
                    borderColor: '#444',
                  },
                  '&:hover fieldset': {
                    borderColor: '#10B981',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#10B981',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#9ca3af',
                  '&.Mui-focused': {
                    color: '#10B981',
                  },
                },
                '& .MuiInputBase-input': {
                  color: '#e0e0e0',
                },
              }}
            />

            <TextField
              label="Description"
              value={transactionForm.description}
              onChange={(e) => setTransactionForm(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              placeholder="Optional description for this transaction"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2d2d2d',
                  '& fieldset': {
                    borderColor: '#444',
                  },
                  '&:hover fieldset': {
                    borderColor: '#10B981',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#10B981',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#9ca3af',
                  '&.Mui-focused': {
                    color: '#10B981',
                  },
                },
                '& .MuiInputBase-input': {
                  color: '#e0e0e0',
                  '&::placeholder': {
                    color: '#6b7280',
                  },
                },
              }}
            />

            <TextField
              label="Transaction Date"
              type="date"
              value={transactionForm.transactionDate}
              onChange={(e) => setTransactionForm(prev => ({ ...prev, transactionDate: e.target.value }))}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2d2d2d',
                  '& fieldset': {
                    borderColor: '#444',
                  },
                  '&:hover fieldset': {
                    borderColor: '#10B981',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#10B981',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#9ca3af',
                  '&.Mui-focused': {
                    color: '#10B981',
                  },
                },
                '& .MuiInputBase-input': {
                  color: '#e0e0e0',
                },
              }}
            />

            {transactionForm.transactionType === 'bonus' && (
              <TextField
                label="Bonus Percentage"
                type="number"
                value={transactionForm.bonusPercentage}
                onChange={(e) => setTransactionForm(prev => ({ ...prev, bonusPercentage: e.target.value }))}
                fullWidth
                InputProps={{
                  endAdornment: <Typography sx={{ ml: 1, color: '#9ca3af' }}>%</Typography>
                }}
                helperText="Enter percentage (e.g., 0.5 for 0.5%)"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#2d2d2d',
                    '& fieldset': {
                      borderColor: '#444',
                    },
                    '&:hover fieldset': {
                      borderColor: '#10B981',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#10B981',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#9ca3af',
                    '&.Mui-focused': {
                      color: '#10B981',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: '#e0e0e0',
                  },
                  '& .MuiFormHelperText-root': {
                    color: '#9ca3af',
                  },
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#1a1a1a', borderTop: '1px solid #333' }}>
          <Button 
            onClick={() => setTransactionDialogOpen(false)}
            sx={{ color: '#9ca3af', '&:hover': { backgroundColor: '#2d2d2d' } }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveTransaction}
            variant="contained"
            disabled={!transactionForm.amount || addingTransaction}
            startIcon={addingTransaction ? <CircularProgress size={16} /> : <Add />}
            sx={{ 
              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              }
            }}
          >
            {addingTransaction ? 'Adding...' : 'Add Transaction'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Loan Dialog */}
      <Dialog 
        open={createLoanDialogOpen} 
        onClose={() => setCreateLoanDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            boxShadow: '0 8px 32px 0 rgb(0 0 0 / 0.37)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <AccountBalance />
          Create Loan Account
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#1a1a1a' }}>
          {selectedUser && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ mb: 3, p: 2, backgroundColor: '#2d2d2d', borderRadius: 1, border: '1px solid #444' }}>
                <Typography variant="h6" gutterBottom sx={{ color: '#e0e0e0' }}>
                  {selectedUser.firstName} {selectedUser.lastName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                  {selectedUser.email}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  label="Principal Amount"
                  type="number"
                  value={createLoanForm.principalAmount}
                  onChange={(e) => setCreateLoanForm(prev => ({ ...prev, principalAmount: e.target.value }))}
                  fullWidth
                  required
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1, color: '#9ca3af' }}>$</Typography>
                  }}
                  helperText="Initial loan amount"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#2d2d2d',
                      '& fieldset': {
                        borderColor: '#444',
                      },
                      '&:hover fieldset': {
                        borderColor: '#6B46C1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#6B46C1',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9ca3af',
                      '&.Mui-focused': {
                        color: '#6B46C1',
                      },
                    },
                    '& .MuiInputBase-input': {
                      color: '#e0e0e0',
                    },
                    '& .MuiFormHelperText-root': {
                      color: '#9ca3af',
                    },
                  }}
                />
                
                <TextField
                  label="Monthly Interest Rate"
                  type="number"
                  value={createLoanForm.monthlyRate}
                  onChange={(e) => setCreateLoanForm(prev => ({ ...prev, monthlyRate: e.target.value }))}
                  fullWidth
                  InputProps={{
                    endAdornment: <Typography sx={{ ml: 1, color: '#9ca3af' }}>%</Typography>
                  }}
                  helperText="Monthly interest rate (e.g., 1.0 for 1% per month)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#2d2d2d',
                      '& fieldset': {
                        borderColor: '#444',
                      },
                      '&:hover fieldset': {
                        borderColor: '#6B46C1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#6B46C1',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9ca3af',
                      '&.Mui-focused': {
                        color: '#6B46C1',
                      },
                    },
                    '& .MuiInputBase-input': {
                      color: '#e0e0e0',
                    },
                    '& .MuiFormHelperText-root': {
                      color: '#9ca3af',
                    },
                  }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#1a1a1a', borderTop: '1px solid #333' }}>
          <Button 
            onClick={() => setCreateLoanDialogOpen(false)}
            sx={{ color: '#9ca3af', '&:hover': { backgroundColor: '#2d2d2d' } }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateLoan}
            variant="contained"
            disabled={!createLoanForm.principalAmount || creatingLoan}
            startIcon={creatingLoan ? <CircularProgress size={16} /> : <AccountBalance />}
            sx={{ 
              background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
              }
            }}
          >
            {creatingLoan ? 'Creating...' : 'Create Loan Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transactions Modal */}
      <Dialog 
        open={transactionsModalOpen} 
        onClose={() => setTransactionsModalOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            boxShadow: '0 8px 32px 0 rgb(0 0 0 / 0.37)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Receipt />
          Loan Transactions
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#1a1a1a' }}>
          {selectedLoanForTransactionView && (
            <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Account: {selectedLoanForTransactionView.account_number}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Account Holder:</strong> {selectedLoanForTransactionView.first_name} {selectedLoanForTransactionView.last_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Email:</strong> {selectedLoanForTransactionView.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Principal Amount:</strong> {formatCurrency(selectedLoanForTransactionView.principal_amount)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Current Balance:</strong> {formatCurrency(selectedLoanForTransactionView.current_balance)}
                </Typography>
              </Box>
            </Box>
          )}
          
          {loadingTransactions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : loanTransactions.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Bonus %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loanTransactions.map((transaction) => (
                    <TableRow key={transaction.id} hover>
                      <TableCell>
                        {new Date(transaction.transaction_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={transaction.transaction_type.replace('_', ' ')}
                          color={
                            transaction.transaction_type === 'withdrawal' ? 'error' :
                            transaction.transaction_type === 'bonus' ? 'success' :
                            transaction.transaction_type === 'loan' ? 'primary' :
                            'default'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ 
                        color: transaction.transaction_type === 'withdrawal' ? 'error.main' : 'success.main',
                        fontWeight: 600
                      }}>
                        {transaction.transaction_type === 'withdrawal' ? '-' : '+'}
                        {formatCurrency(Math.abs(parseFloat(transaction.amount)))}
                      </TableCell>
                      <TableCell>{transaction.description || '-'}</TableCell>
                      <TableCell>
                        {transaction.bonus_percentage ? 
                          `${(parseFloat(transaction.bonus_percentage) * 100).toFixed(1)}%` : 
                          '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No transactions found for this loan account.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransactionsModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Verification Request Dialog */}
      <Dialog 
        open={verificationDialogOpen} 
        onClose={() => {
          setVerificationDialogOpen(false);
          setSelectedVerificationRequest(null);
          setVerificationAction(null);
          setVerificationNotes('');
        }} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            background: '#1a1a1a',
            border: '1px solid rgba(107, 70, 193, 0.3)',
            borderRadius: '16px',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          {verificationAction === 'approved' ? <CheckCircle /> : <CancelIcon />}
          {verificationAction === 'approved' ? 'Approve' : 'Reject'} Account Verification
        </DialogTitle>
        <DialogContent>
          {selectedVerificationRequest && (
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                {verificationAction === 'approved' ? 'Approve' : 'Reject'} Account Verification
              </Typography>
              
              <Box sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, rgba(107, 70, 193, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)', borderRadius: 2, border: '1px solid rgba(107, 70, 193, 0.2)' }}>
                <Typography variant="h6" gutterBottom>
                  {selectedVerificationRequest.first_name} {selectedVerificationRequest.last_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  📧 {selectedVerificationRequest.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  📅 Requested: {new Date(selectedVerificationRequest.requested_at).toLocaleDateString()}
                </Typography>
              </Box>
              
              {verificationAction === 'approved' && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  This will mark the user's account as verified and grant them full access to platform features.
                </Typography>
              )}
              
              {verificationAction === 'rejected' && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  This will reject the verification request. The user will remain unverified and can submit a new request.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => {
              setVerificationDialogOpen(false);
              setSelectedVerificationRequest(null);
              setVerificationAction(null);
              setVerificationNotes('');
            }}
            disabled={processingVerification}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleVerificationRequest}
            variant="contained"
            disabled={processingVerification}
            startIcon={processingVerification ? <CircularProgress size={16} /> : 
              (verificationAction === 'approved' ? <CheckCircle /> : <CancelIcon />)}
            color={verificationAction === 'approved' ? 'success' : 'error'}
          >
            {processingVerification 
              ? 'Processing...' 
              : `${verificationAction === 'approved' ? 'Approve' : 'Reject'} Request`
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Scheduling Dialog */}
      <Dialog
        open={schedulingDialogOpen}
        onClose={() => setSchedulingDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1f2937',
            border: '1px solid',
            borderColor: 'primary.main',
            borderRadius: 3,
          }
        }}
      >
        <DialogTitle>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Schedule Meeting
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Set date and time for the consultation
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Preferred Date/Time Info */}
            {selectedMeetingRequest && (
              <Box sx={{ 
                p: 2, 
                background: 'rgba(255, 255, 255, 0.05)', 
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'white' }}>
                  Client's Preferred Schedule
                </Typography>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  <strong>Preferred Date:</strong> {new Date(selectedMeetingRequest.preferred_date).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" sx={{ color: 'white', mt: 0.5 }}>
                  <strong>Preferred Time:</strong> {selectedMeetingRequest.preferred_time}
                </Typography>
                {selectedMeetingRequest.purpose && (
                  <Typography variant="body2" sx={{ color: 'white', mt: 0.5 }}>
                    <strong>Purpose:</strong> {selectedMeetingRequest.purpose}
                  </Typography>
                )}
              </Box>
            )}

            <TextField
              label="Scheduled Date"
              type="date"
              value={schedulingData.scheduled_date}
              onChange={(e) => setSchedulingData(prev => ({ ...prev, scheduled_date: e.target.value }))}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 1 }}
              inputProps={{
                min: new Date().toISOString().split('T')[0]
              }}
            />
            <TextField
              label="Scheduled Time"
              type="time"
              value={schedulingData.scheduled_time}
              onChange={(e) => setSchedulingData(prev => ({ ...prev, scheduled_time: e.target.value }))}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            {/* Meeting Type Specific Fields */}
            {selectedMeetingRequest?.meeting_type === 'video' && (
              <Box>
                <TextField
                  label="Google Meet Link"
                  value={schedulingData.meeting_link}
                  onChange={(e) => setSchedulingData(prev => ({ ...prev, meeting_link: e.target.value }))}
                  fullWidth
                  required
                  placeholder="https://meet.google.com/your-meeting-code"
                  helperText="Create a Google Meet room and paste the link here (required)"
                  error={!schedulingData.meeting_link && !!schedulingData.scheduled_date && !!schedulingData.scheduled_time}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  <strong>How to create:</strong> Go to{' '}
                  <a 
                    href="https://meet.google.com/new" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#4285F4' }}
                  >
                    meet.google.com/new
                  </a>
                  , create a meeting, and copy the link here.
                </Typography>
              </Box>
            )}

            <TextField
              label="Admin Notes"
              value={schedulingData.admin_notes}
              onChange={(e) => setSchedulingData(prev => ({ ...prev, admin_notes: e.target.value }))}
              multiline
              rows={3}
              fullWidth
              placeholder="Optional notes about the meeting"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
          <Button 
            onClick={() => setSchedulingDialogOpen(false)}
            variant="contained"
            sx={{ 
              minWidth: 100,
              background: 'linear-gradient(135deg, #6B7280, #4B5563)',
              color: 'white',
              fontWeight: 'bold',
              '&:hover': {
                background: 'linear-gradient(135deg, #4B5563, #374151)',
                boxShadow: '0 6px 12px rgba(107, 114, 128, 0.4)',
              },
              boxShadow: '0 3px 8px rgba(107, 114, 128, 0.3)',
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleScheduleSubmit}
            variant="contained"
            disabled={
              !schedulingData.scheduled_date || 
              !schedulingData.scheduled_time || 
              (selectedMeetingRequest?.meeting_type === 'video' && !schedulingData.meeting_link)
            }
            sx={{ 
              minWidth: 150,
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              '&:hover': {
                background: 'linear-gradient(135deg, #16A34A, #15803D)',
              },
              '&:disabled': {
                background: '#6B7280',
                color: '#9CA3AF'
              }
            }}
            startIcon={<CheckCircle />}
          >
            Schedule Meeting
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminDashboard; 