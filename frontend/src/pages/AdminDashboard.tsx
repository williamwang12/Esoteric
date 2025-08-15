import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
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
} from '@mui/material';
import {
  Upload,
  Download,
  Delete,
  Visibility,
  ArrowBack,
  People,
  Description,
  AccountBalance,
  Edit,
  Add,
  Save,
  Cancel,
  AttachMoney,
  TrendingUp,
  Receipt,
  CheckCircle,
  Cancel as CancelIcon,
  ToggleOn,
  ToggleOff,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { adminApi, documentsApi } from '../services/api';
import AppNavigation from '../components/AppNavigation';

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

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [userDetailsTabValue, setUserDetailsTabValue] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [userLoans, setUserLoans] = useState<any[]>([]);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [loadingUserTransactions, setLoadingUserTransactions] = useState(false);
  const [allLoans, setAllLoans] = useState<any[]>([]);
  const [loadingAllLoans, setLoadingAllLoans] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
  const [verificationLoading, setVerificationLoading] = useState<{[key: string]: boolean}>({});

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
  };

  const handleUserDetailsTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setUserDetailsTabValue(newValue);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await adminApi.getUsers();
      console.log('Users data received:', usersData);
      if (usersData.length > 0) {
        console.log('First user object:', usersData[0]);
        console.log('Created at field:', usersData[0].created_at);
      }
      setUsers(usersData);
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Users fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLoans = async () => {
    try {
      setLoadingAllLoans(true);
      const loansData = await adminApi.getAllLoans();
      setAllLoans(loansData.loans);
    } catch (err) {
      console.error('All loans fetch error:', err);
      setError('Failed to fetch loans');
    } finally {
      setLoadingAllLoans(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const [documentsData, loansData, transactionsData] = await Promise.all([
        adminApi.getUserDocuments(userId),
        adminApi.getUserLoans(userId),
        adminApi.getUserTransactions(userId),
      ]);
      
      setSelectedUser(documentsData.user);
      setUserDocuments(documentsData.documents);
      setUserLoans(loansData.loans);
      setUserTransactions(transactionsData.transactions);
    } catch (err) {
      console.error('User details fetch error:', err);
    }
  };

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
        await fetchAllLoans(); // Refresh all loans data
      }

      setLoanEditDialogOpen(false);
      setEditingLoan(null);
    } catch (error) {
      console.error('Loan update error:', error);
    } finally {
      setSavingLoan(false);
    }
  };

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
      await fetchAllLoans(); // Refresh all loans data
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
      await fetchAllLoans(); // Refresh all loans data

      setTransactionDialogOpen(false);
      setSelectedLoanForTransaction(null);
    } catch (error) {
      console.error('Transaction creation error:', error);
    } finally {
      setAddingTransaction(false);
    }
  };

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
      const response = await adminApi.createLoan({
        userId: selectedUser.id,
        principalAmount: parseFloat(createLoanForm.principalAmount),
        monthlyRate: parseFloat(createLoanForm.monthlyRate) / 100 // Convert percentage to decimal
      });
      
      // Show success message
      setSnackbar({
        open: true,
        message: `Loan account created successfully for ${selectedUser.first_name} ${selectedUser.last_name}`,
        severity: 'success'
      });
      
      // Refresh user loan data
      await fetchUserDetails(selectedUser.id);
      await fetchAllLoans(); // Also refresh all loans data
      
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

  const handleToggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      setVerificationLoading(prev => ({ ...prev, [userId]: true }));
      await adminApi.toggleUserVerification(userId, !currentStatus);
      // Refresh users list to show updated status
      await fetchUsers();
      
      // Show success message
      const action = !currentStatus ? 'verified' : 'unverified';
      setSnackbar({
        open: true,
        message: `User account ${action} successfully`,
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Verification toggle error:', error);
      
      // Show error message
      let errorMessage = 'Failed to update verification status';
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
      setVerificationLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAllLoans();
  }, []);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Navigation Bar */}
      <AppNavigation />

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
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
                  icon={<AccountBalance />} 
                  label="All Loans" 
                  id="admin-tab-1"
                  aria-controls="admin-tabpanel-1"
                />
                {selectedUser && (
                  <Tab 
                    icon={<Visibility />} 
                    label={`${selectedUser.firstName} ${selectedUser.lastName}`}
                    id="admin-tab-2"
                    aria-controls="admin-tabpanel-2"
                  />
                )}
              </Tabs>
            </Box>

            {/* Tab Content */}
            <TabPanel value={tabValue} index={0}>
              {/* Users Tab */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    👥 User Management
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell>Verification</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id} hover>
                            <TableCell>
                              {user.first_name} {user.last_name}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Chip 
                                label={user.role || 'user'} 
                                color={user.role === 'admin' ? 'secondary' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip 
                                  icon={user.account_verified ? <CheckCircle /> : <CancelIcon />}
                                  label={user.account_verified ? 'Verified' : 'Unverified'}
                                  color={user.account_verified ? 'success' : 'default'}
                                  size="small"
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleToggleVerification(user.id, user.account_verified)}
                                  disabled={verificationLoading[user.id]}
                                  sx={{ 
                                    color: user.account_verified ? 'error.main' : 'success.main',
                                    '&:hover': {
                                      backgroundColor: user.account_verified ? 'error.light' : 'success.light',
                                      opacity: 0.1
                                    }
                                  }}
                                >
                                  {verificationLoading[user.id] ? (
                                    <CircularProgress size={16} />
                                  ) : user.account_verified ? (
                                    <ToggleOff />
                                  ) : (
                                    <ToggleOn />
                                  )}
                                </IconButton>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                console.log('Processing user:', user);
                                return user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
                              })()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                startIcon={<Visibility />}
                                onClick={() => {
                                  fetchUserDetails(user.id);
                                  setTabValue(2);
                                }}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {/* All Loans Tab */}
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      🏦 All Loan Accounts
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={fetchAllLoans}
                      disabled={loadingAllLoans}
                    >
                      {loadingAllLoans ? <CircularProgress size={20} /> : 'Refresh'}
                    </Button>
                  </Box>
                  
                  {loadingAllLoans ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : allLoans.length > 0 ? (
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Account Number</TableCell>
                            <TableCell>User</TableCell>
                            <TableCell>Principal</TableCell>
                            <TableCell>Current Balance</TableCell>
                            <TableCell>Monthly Rate</TableCell>
                            <TableCell>Total Bonuses</TableCell>
                            <TableCell>Total Withdrawals</TableCell>
                            <TableCell>Transactions</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allLoans.map((loan) => (
                            <TableRow key={loan.id} hover>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {loan.account_number}
                              </TableCell>
                              <TableCell>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {loan.user.firstName} {loan.user.lastName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {loan.user.email}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>{formatCurrency(loan.principal_amount)}</TableCell>
                              <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                                {formatCurrency(loan.current_balance)}
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={`${(parseFloat(loan.monthly_rate) * 100).toFixed(1)}%`}
                                  color="info"
                                  size="small"
                                />
                              </TableCell>
                              <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>
                                {formatCurrency(loan.total_bonuses)}
                              </TableCell>
                              <TableCell sx={{ color: 'warning.main', fontWeight: 600 }}>
                                {formatCurrency(loan.total_withdrawals)}
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={`${loan.transactionCount} txns`}
                                  size="small"
                                  variant="outlined"
                                />
                                {loan.lastTransactionDate && (
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    Last: {new Date(loan.lastTransactionDate).toLocaleDateString()}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {new Date(loan.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditLoan(loan)}
                                    color="primary"
                                    title="Edit Loan"
                                  >
                                    <Edit />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleAddTransaction(loan)}
                                    color="secondary"
                                    title="Add Transaction"
                                  >
                                    <Add />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => fetchLoanTransactions(loan.id, loan)}
                                    color="info"
                                    title="View Transactions"
                                  >
                                    <Receipt />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      fetchUserDetails(loan.user_id);
                                      setTabValue(2);
                                      setUserDetailsTabValue(0); // Start with loans tab
                                    }}
                                    color="primary"
                                    title="View User Details"
                                  >
                                    <Visibility />
                                  </IconButton>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No loan accounts found in the system.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {/* User Details Tab */}
              {selectedUser && (
                <Box>
                  {/* User Header */}
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                            👤 {selectedUser.firstName} {selectedUser.lastName}
                          </Typography>
                          <Typography variant="body1" color="text.secondary">
                            {selectedUser.email}
                          </Typography>
                        </Box>
                        <Button
                          variant="outlined"
                          startIcon={<ArrowBack />}
                          onClick={() => {
                            setSelectedUser(null);
                            setTabValue(0);
                            setUserDetailsTabValue(0);
                          }}
                        >
                          Back to Users
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* User Details Subtabs */}
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs 
                      value={userDetailsTabValue} 
                      onChange={handleUserDetailsTabChange}
                      aria-label="user details tabs"
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

                    {/* User Loans Subtab */}
                    <TabPanel value={userDetailsTabValue} index={0}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                              💳 Loan Accounts
                            </Typography>
                          </Box>
                          
                          {userLoans.length > 0 ? (
                            <TableContainer component={Paper} sx={{ mb: 4 }}>
                              <Table>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Account Number</TableCell>
                                    <TableCell>Principal</TableCell>
                                    <TableCell>Current Balance</TableCell>
                                    <TableCell>Monthly Rate</TableCell>
                                    <TableCell>Total Bonuses</TableCell>
                                    <TableCell>Total Withdrawals</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell>Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {userLoans.map((loan) => (
                                    <TableRow key={loan.id} hover>
                                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                        {loan.account_number}
                                      </TableCell>
                                      <TableCell>{formatCurrency(loan.principal_amount)}</TableCell>
                                      <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                                        {formatCurrency(loan.current_balance)}
                                      </TableCell>
                                      <TableCell>
                                        <Chip 
                                          label={`${(parseFloat(loan.monthly_rate) * 100).toFixed(1)}%`}
                                          color="info"
                                          size="small"
                                        />
                                      </TableCell>
                                      <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>
                                        {formatCurrency(loan.total_bonuses)}
                                      </TableCell>
                                      <TableCell sx={{ color: 'warning.main', fontWeight: 600 }}>
                                        {formatCurrency(loan.total_withdrawals)}
                                      </TableCell>
                                      <TableCell>
                                        {new Date(loan.created_at).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleEditLoan(loan)}
                                            color="primary"
                                            title="Edit Loan"
                                          >
                                            <Edit />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleAddTransaction(loan)}
                                            color="secondary"
                                            title="Add Transaction"
                                          >
                                            <Add />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => fetchLoanTransactions(loan.id)}
                                            color="info"
                                            title="View Transactions"
                                          >
                                            <Receipt />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleDeleteLoan(loan.id)}
                                            color="error"
                                            title="Delete Loan"
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
                            <Box sx={{ textAlign: 'center', py: 6 }}>
                              <Typography variant="h6" color="text.secondary" gutterBottom>
                                No Loan Account
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                This user doesn't have a loan account yet.
                              </Typography>
                              <Button
                                variant="contained"
                                startIcon={<Add />}
                                onClick={() => setCreateLoanDialogOpen(true)}
                                size="large"
                                sx={{ 
                                  background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                                  '&:hover': {
                                    background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
                                  }
                                }}
                              >
                                Create Loan Account
                              </Button>
                            </Box>
                          )}

                          {/* Recent Transactions */}
                          {loanTransactions.length > 0 && (
                            <Card variant="outlined" sx={{ mt: 3 }}>
                              <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Receipt color="primary" />
                                  Recent Transactions
                                </Typography>
                                {loadingTransactions ? (
                                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress />
                                  </Box>
                                ) : (
                                  <TableContainer>
                                    <Table size="small">
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
                                        {loanTransactions.slice(0, 10).map((transaction) => (
                                          <TableRow key={transaction.id}>
                                            <TableCell>
                                              {new Date(transaction.transaction_date).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                              <Chip 
                                                label={transaction.transaction_type.replace('_', ' ')}
                                                color={
                                                  transaction.transaction_type === 'withdrawal' ? 'error' :
                                                  transaction.transaction_type === 'bonus' ? 'success' :
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
                                            <TableCell>{transaction.description}</TableCell>
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
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </CardContent>
                      </Card>
                    </TabPanel>

                    {/* User Transactions Subtab */}
                    <TabPanel value={userDetailsTabValue} index={1}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                              📋 All Transactions
                            </Typography>
                            {userLoans.length > 0 && (
                              <Button
                                variant="contained"
                                startIcon={<Add />}
                                onClick={() => handleAddTransaction(userLoans[0])}
                                sx={{ 
                                  background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                                  '&:hover': {
                                    background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
                                  }
                                }}
                              >
                                Add Transaction
                              </Button>
                            )}
                          </Box>
                          
                          {userTransactions.length > 0 ? (
                            <TableContainer component={Paper}>
                              <Table>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Account</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Amount</TableCell>
                                    <TableCell>Description</TableCell>
                                    <TableCell>Bonus %</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {userTransactions.map((transaction) => (
                                    <TableRow key={transaction.id} hover>
                                      <TableCell>
                                        {new Date(transaction.transaction_date).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                        {transaction.account_number}
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
                                No transactions found for this user.
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </TabPanel>

                    {/* User Documents Subtab */}
                    <TabPanel value={userDetailsTabValue} index={2}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                              📄 Documents
                            </Typography>
                            <Button
                              variant="contained"
                              startIcon={<Upload />}
                              onClick={() => {
                                setUploadForm(prev => ({ ...prev, userId: selectedUser.id }));
                                setUploadDialogOpen(true);
                              }}
                              sx={{ 
                                background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
                                }
                              }}
                            >
                              Upload Document
                            </Button>
                          </Box>
                          
                          {userDocuments.length > 0 ? (
                            <TableContainer component={Paper}>
                              <Table>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Title</TableCell>
                                    <TableCell>Category</TableCell>
                                    <TableCell>Size</TableCell>
                                    <TableCell>Upload Date</TableCell>
                                    <TableCell>Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {userDocuments.map((doc) => (
                                    <TableRow key={doc.id} hover>
                                      <TableCell>{doc.title}</TableCell>
                                      <TableCell>
                                        <Chip label={doc.category} size="small" />
                                      </TableCell>
                                      <TableCell>
                                        {doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Unknown'}
                                      </TableCell>
                                      <TableCell>
                                        {new Date(doc.upload_date).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleDocumentDownload(doc.id, doc.title)}
                                        >
                                          <Download />
                                        </IconButton>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleDeleteDocument(doc.id)}
                                          color="error"
                                        >
                                          <Delete />
                                        </IconButton>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                              <Typography variant="body1" color="text.secondary">
                                No documents found for this user.
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </TabPanel>
                  </Box>
                )}
            </TabPanel>
          </>
        )}
      </Container>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
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
      <Dialog open={loanEditDialogOpen} onClose={() => setLoanEditDialogOpen(false)} maxWidth="md" fullWidth>
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
        <DialogContent>
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
      <Dialog open={transactionDialogOpen} onClose={() => setTransactionDialogOpen(false)} maxWidth="sm" fullWidth>
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
        <DialogContent>
          {selectedLoanForTransaction && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                📋 Account: {selectedLoanForTransaction.account_number}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedLoanForTransaction.user?.firstName || selectedLoanForTransaction.first_name} {selectedLoanForTransaction.user?.lastName || selectedLoanForTransaction.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current Balance: {formatCurrency(selectedLoanForTransaction.current_balance)}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Transaction Type</InputLabel>
              <Select
                value={transactionForm.transactionType}
                label="Transaction Type"
                onChange={(e) => setTransactionForm(prev => ({ ...prev, transactionType: e.target.value }))}
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
                startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>
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
            />

            {transactionForm.transactionType === 'bonus' && (
              <TextField
                label="Bonus Percentage"
                type="number"
                value={transactionForm.bonusPercentage}
                onChange={(e) => setTransactionForm(prev => ({ ...prev, bonusPercentage: e.target.value }))}
                fullWidth
                InputProps={{
                  endAdornment: <Typography sx={{ ml: 1, color: 'text.secondary' }}>%</Typography>
                }}
                helperText="Enter percentage (e.g., 0.5 for 0.5%)"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransactionDialogOpen(false)}>Cancel</Button>
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
      <Dialog open={createLoanDialogOpen} onClose={() => setCreateLoanDialogOpen(false)} maxWidth="sm" fullWidth>
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
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>
                  👤 {selectedUser.firstName} {selectedUser.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
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
                    startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>
                  }}
                  helperText="Initial loan amount"
                />
                
                <TextField
                  label="Monthly Interest Rate"
                  type="number"
                  value={createLoanForm.monthlyRate}
                  onChange={(e) => setCreateLoanForm(prev => ({ ...prev, monthlyRate: e.target.value }))}
                  fullWidth
                  InputProps={{
                    endAdornment: <Typography sx={{ ml: 1, color: 'text.secondary' }}>%</Typography>
                  }}
                  helperText="Monthly interest rate (e.g., 1.0 for 1% per month)"
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateLoanDialogOpen(false)}>Cancel</Button>
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
      <Dialog open={transactionsModalOpen} onClose={() => setTransactionsModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Receipt />
          Loan Transactions
        </DialogTitle>
        <DialogContent>
          {selectedLoanForTransactionView && (
            <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                📋 Account: {selectedLoanForTransactionView.account_number}
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