import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Fade,
  useTheme,
  alpha,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from '@mui/material';
import { 
  AccountBalance, 
  AdminPanelSettings,
  AttachMoney,
  Timeline,
  AccountBalanceWallet,
  CreditCard,
  Payment,
  TrendingUp,
  History,
  Description,
  Search,
  FilterList,
  GetApp,
  InsertDriveFile,
  PictureAsPdf,
  Article,
  Folder,
  CalendarMonth,
  RequestPage,
  CheckCircle,
  Schedule,
  Pending,
  Phone,
  Cancel
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import LoanGrowthChart from '../components/charts/LoanGrowthChart';
import PortfolioDashboard from '../components/charts/PortfolioDashboard';
import AdvancedMetrics from '../components/charts/AdvancedMetrics';
import TransactionHistory from '../components/TransactionHistory';
import AppNavigation from '../components/AppNavigation';
import WithdrawalRequestDialog from '../components/WithdrawalRequestDialog';
import MeetingRequestDialog from '../components/MeetingRequestDialog';
import { documentsApi, adminApi } from '../services/api';

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
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 1 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loanData, setLoanData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardAnimations, setCardAnimations] = useState<boolean[]>([false, false, false, false, false, false]);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingDetailsOpen, setMeetingDetailsOpen] = useState(false);
  const [meetingRequest, setMeetingRequest] = useState<any>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') return 'Date TBD';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date TBD';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Date TBD';
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    try {
      // Handle time format like "14:30:00" or "14:30"
      const [hours, minutes] = timeString.split(':');
      const time = new Date();
      time.setHours(parseInt(hours), parseInt(minutes));
      return time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return timeString;
    }
  };

  const handleCancelMeeting = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:5002/api/admin/meeting-requests/${meetingRequest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'cancelled',
          admin_notes: 'Cancelled by user request'
        }),
      });

      if (response.ok) {
        setMeetingDetailsOpen(false);
        fetchLoanData(); // Refresh to update the meeting status
      } else {
        console.error('Failed to cancel meeting');
      }
    } catch (error) {
      console.error('Error cancelling meeting:', error);
    }
  };

  const handleDocumentDownload = async (documentId: string, title: string) => {
    try {
      const blob = await documentsApi.downloadDocument(documentId);
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
      // You could show a toast notification here
    }
  };

  // Filter and search documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(documentSearch.toLowerCase()) ||
                          doc.category.toLowerCase().includes(documentSearch.toLowerCase());
    const matchesCategory = !documentCategoryFilter || doc.category === documentCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter dropdown
  const documentCategories = Array.from(new Set(documents.map(doc => doc.category))).sort();

  // Get file type icon
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <PictureAsPdf sx={{ color: '#f44336' }} />;
      case 'doc':
      case 'docx':
        return <Article sx={{ color: '#2196f3' }} />;
      default:
        return <InsertDriveFile sx={{ color: '#9e9e9e' }} />;
    }
  };

  const fetchLoanData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      // Fetch loans
      const loansResponse = await fetch('http://localhost:5002/api/loans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!loansResponse.ok) {
        if (loansResponse.status === 403 || loansResponse.status === 401) {
          // Invalid or expired token - redirect to login
          logout();
          navigate('/login');
          return;
        }
        throw new Error(`HTTP ${loansResponse.status}: ${loansResponse.statusText}`);
      }
      
      const loans = await loansResponse.json();
      
      if (loans.length > 0) {
        setLoanData(loans[0]);
        
        // Fetch analytics for the first loan
        const analyticsResponse = await fetch(`http://localhost:5002/api/loans/${loans[0].id}/analytics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!analyticsResponse.ok) {
          if (analyticsResponse.status === 403 || analyticsResponse.status === 401) {
            // Invalid or expired token - redirect to login
            logout();
            navigate('/login');
            return;
          }
          throw new Error(`Analytics HTTP ${analyticsResponse.status}: ${analyticsResponse.statusText}`);
        }
        
        const analytics = await analyticsResponse.json();
        setAnalyticsData(analytics);
      } else {
        setError('No loan accounts found');
      }

      // Fetch documents
      try {
        const userDocuments = await documentsApi.getDocuments();
        setDocuments(userDocuments);
      } catch (docError) {
        console.error('Documents fetch error:', docError);
        // Don't set error state for documents, just log it
      }

      // Check if user is admin
      try {
        await adminApi.getUsers();
        setIsAdmin(true);
      } catch (adminError) {
        setIsAdmin(false);
      }

      // Fetch meeting requests
      try {
        const meetingResponse = await fetch('http://localhost:5002/api/meeting-requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (meetingResponse.ok) {
          const meetingRequests = await meetingResponse.json();
          // Get the most recent meeting request
          if (meetingRequests.length > 0) {
            const latestRequest = meetingRequests.sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            setMeetingRequest(latestRequest);
          }
        }
      } catch (meetingError) {
        console.error('Meeting requests fetch error:', meetingError);
      }

    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch loan data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanData();
  }, []);

  useEffect(() => {
    // Animate cards sequentially when component mounts
    const timeouts = [0, 1, 2, 3, 4, 5].map((index) => 
      setTimeout(() => {
        setCardAnimations(prev => {
          const newAnimations = [...prev];
          newAnimations[index] = true;
          return newAnimations;
        });
      }, index * 150)
    );
    
    return () => timeouts.forEach(clearTimeout);
  }, []);

  // Handle navigation from admin page with selected tab
  useEffect(() => {
    if (location.state && (location.state as any).selectedTab !== undefined) {
      setTabValue((location.state as any).selectedTab);
      // Clear the state to prevent it from persisting on refresh
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative' }}>
      {/* Navigation Bar */}
      <AppNavigation 
        onLogout={handleLogout} 
        currentTab={tabValue}
        onTabChange={(tab) => setTabValue(tab)}
      />

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Dynamic Welcome Section Based on Tab */}
        <Fade in={true} timeout={1000}>
          <Box mb={3}>
            <Typography 
              variant="h2" 
              component="h1" 
              gutterBottom
              sx={{
                background: 'linear-gradient(135deg, #F9FAFB 0%, #D1D5DB 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                mb: 2
              }}
            >
              {tabValue === 0 && `Welcome back, ${user?.firstName}!`}
              {tabValue === 1 && `Analytics Dashboard`}
              {tabValue === 2 && `Transaction History`}
              {tabValue === 3 && `Document Center`}
              {tabValue === 4 && user?.role === 'admin' && `Admin Panel`}
            </Typography>
            <Typography 
              variant="h6" 
              color="text.secondary"
              sx={{ 
                fontSize: '1.1rem',
                fontWeight: 400,
                opacity: 0.9,
                maxWidth: '600px'
              }}
            >
              {tabValue === 0 && `Here's an overview of your loan performance with Esoteric Enterprises. Track your growth, manage your investments, and explore your financial journey.`}
              {tabValue === 1 && `Analyze your investment performance with comprehensive charts, metrics, and insights to track your loan growth and returns over time.`}
              {tabValue === 2 && `Review all your transaction history including loan disbursements, monthly payments, bonuses, and withdrawals with detailed records.`}
              {tabValue === 3 && `Access and manage all your important loan documents, contracts, statements, and reports in one secure location.`}
              {tabValue === 4 && user?.role === 'admin' && `Manage users, create loan accounts, verify customers, and oversee all administrative functions for the platform.`}
            </Typography>
          </Box>
        </Fade>



        {/* Enhanced Loading State */}
        {loading && (
          <Fade in={loading} timeout={800}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              py: 8,
              background: 'rgba(107, 70, 193, 0.02)',
              borderRadius: '20px',
              border: '1px solid rgba(107, 70, 193, 0.1)',
              backdropFilter: 'blur(10px)',
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Outer ring */}
                  <CircularProgress 
                    size={80} 
                    thickness={2}
                    sx={{ 
                      color: 'primary.main',
                      opacity: 0.3,
                      position: 'absolute',
                    }}
                  />
                  {/* Inner ring */}
                  <CircularProgress 
                    size={60} 
                    thickness={4}
                    sx={{ 
                      color: 'primary.main',
                      filter: 'drop-shadow(0 0 10px rgba(107, 70, 193, 0.4))',
                    }}
                  />
                </Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mt: 3,
                    background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 600
                  }}
                >
                  Loading your financial data...
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, opacity: 0.8 }}>
                  Just a moment while we prepare your dashboard
                </Typography>
              </Box>
            </Box>
          </Fade>
        )}

        {/* Enhanced New User Experience - Tab-specific content */}
        {!loading && !loanData && (
          <>
            {/* Overview Tab - Welcome Message */}
            <TabPanel value={tabValue} index={0}>
              <Fade in={true} timeout={1000}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                    border: '2px solid rgba(107, 70, 193, 0.3)',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    position: 'relative',
                    mb: 4,
                    color: 'white',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(45deg, rgba(107, 70, 193, 0.1) 0%, transparent 50%, rgba(147, 51, 234, 0.1) 100%)',
                      pointerEvents: 'none'
                    }
                  }}
                >
                  <CardContent sx={{ p: 6, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                    <Box sx={{ mb: 4 }}>
                      <AccountBalance 
                        sx={{ 
                          fontSize: 80, 
                          color: '#A855F7',
                          filter: 'drop-shadow(0 4px 12px rgba(168, 85, 247, 0.4))',
                          mb: 2
                        }} 
                      />
                    </Box>
                    <Typography 
                      variant="h3" 
                      component="h2" 
                      gutterBottom
                      sx={{
                        background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 800,
                        mb: 3
                      }}
                    >
                      Account Overview
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ mb: 4, maxWidth: '600px', mx: 'auto', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}
                    >
                      Your loan account dashboard will display your current balance, monthly earnings, growth metrics, and 
                      account summary once your loan account is activated.
                    </Typography>
                    
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, 
                      gap: 3, 
                      mt: 4,
                      maxWidth: '600px',
                      mx: 'auto'
                    }}>
                      <Card sx={{ 
                        p: 3, 
                        background: 'rgba(107, 70, 193, 0.2)', 
                        border: '1px solid rgba(107, 70, 193, 0.3)',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <Typography variant="h6" gutterBottom sx={{ color: '#A855F7', fontWeight: 600 }}>
                          💰 Account Balance
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          View your current loan balance, principal amount, and total growth in real-time.
                        </Typography>
                      </Card>
                      
                      <Card sx={{ 
                        p: 3, 
                        background: 'rgba(168, 85, 247, 0.2)', 
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <Typography variant="h6" gutterBottom sx={{ color: '#EC4899', fontWeight: 600 }}>
                          📊 Performance Metrics
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Monitor your monthly rate, bonuses earned, and account performance indicators.
                        </Typography>
                      </Card>
                    </Box>

                    <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(107, 70, 193, 0.3)' }}>
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>
                        Contact our team to activate your loan account and start monitoring your investment performance 
                        with detailed balance tracking and real-time updates.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Fade>
            </TabPanel>

            {/* Analytics Tab - Preview */}
            <TabPanel value={tabValue} index={1}>
              <Fade in={true} timeout={1000}>
                <Card sx={{
                  background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                  border: '2px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '24px',
                  color: 'white',
                  mb: 4
                }}>
                  <CardContent sx={{ p: 6, textAlign: 'center' }}>
                    <TrendingUp sx={{ fontSize: 80, color: '#22C55E', mb: 3 }} />
                    <Typography variant="h3" sx={{
                      background: 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontWeight: 800,
                      mb: 3
                    }}>
                      Advanced Analytics
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', mb: 4 }}>
                      Track your investment performance with powerful analytics tools that provide deep insights into 
                      your loan growth, returns, and financial trends:
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mt: 4 }}>
                      <Box sx={{ p: 3, background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#22C55E', fontWeight: 600, mb: 1 }}>📊 Performance Charts</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Real-time growth visualization</Typography>
                      </Box>
                      <Box sx={{ p: 3, background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#22C55E', fontWeight: 600, mb: 1 }}>📈 ROI Tracking</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Return on investment metrics</Typography>
                      </Box>
                      <Box sx={{ p: 3, background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#22C55E', fontWeight: 600, mb: 1 }}>🎯 Goal Progress</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Track your financial goals</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Fade>
            </TabPanel>

            {/* Transactions Tab - Preview */}
            <TabPanel value={tabValue} index={2}>
              <Fade in={true} timeout={1000}>
                <Card sx={{
                  background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '24px',
                  color: 'white',
                  mb: 4
                }}>
                  <CardContent sx={{ p: 6, textAlign: 'center' }}>
                    <History sx={{ fontSize: 80, color: '#3B82F6', mb: 3 }} />
                    <Typography variant="h3" sx={{
                      background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontWeight: 800,
                      mb: 3
                    }}>
                      Transaction History
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', mb: 4 }}>
                      Access complete transaction records including loan disbursements, monthly payments, bonuses, 
                      and withdrawals with detailed timestamps and descriptions:
                    </Typography>
                    <Box sx={{ maxWidth: '500px', mx: 'auto', mt: 4 }}>
                      {[
                        { type: 'Loan Disbursement', desc: 'Initial loan amount', amount: '+$XX,XXX', color: '#3B82F6' },
                        { type: 'Monthly Payment', desc: 'Interest earned', amount: '+$X,XXX', color: '#22C55E' },
                        { type: 'Performance Bonus', desc: 'Additional return', amount: '+$XXX', color: '#F59E0B' }
                      ].map((transaction, i) => (
                        <Box key={i} sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          p: 3, 
                          mb: 2,
                          background: 'rgba(59, 130, 246, 0.1)', 
                          borderRadius: '12px',
                          border: '1px solid rgba(59, 130, 246, 0.2)'
                        }}>
                          <Box>
                            <Typography variant="body1" sx={{ color: '#3B82F6', fontWeight: 600 }}>{transaction.type}</Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{transaction.desc}</Typography>
                          </Box>
                          <Typography variant="h6" sx={{ color: transaction.color }}>{transaction.amount}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Fade>
            </TabPanel>

            {/* Documents Tab - Preview */}
            <TabPanel value={tabValue} index={3}>
              <Fade in={true} timeout={1000}>
                <Card sx={{
                  background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                  border: '2px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '24px',
                  color: 'white',
                  mb: 4
                }}>
                  <CardContent sx={{ p: 6, textAlign: 'center' }}>
                    <Description sx={{ fontSize: 80, color: '#F59E0B', mb: 3 }} />
                    <Typography variant="h3" sx={{
                      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontWeight: 800,
                      mb: 3
                    }}>
                      Document Center
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', mb: 4 }}>
                      Access and download all your important loan documents including contracts, statements, 
                      and reports in a secure document management center:
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mt: 4, maxWidth: '600px', mx: 'auto' }}>
                      <Box sx={{ p: 3, background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#F59E0B', fontWeight: 600, mb: 1 }}>📄 Loan Agreements</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Download your loan contracts and terms</Typography>
                      </Box>
                      <Box sx={{ p: 3, background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#F59E0B', fontWeight: 600, mb: 1 }}>📊 Statements</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Monthly account statements and reports</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Fade>
            </TabPanel>

            {/* Admin Tab - Preview (only for admins) */}
            {isAdmin && (
              <TabPanel value={tabValue} index={4}>
                <Fade in={true} timeout={1000}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                    border: '2px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '24px',
                    color: 'white',
                    mb: 4
                  }}>
                    <CardContent sx={{ p: 6, textAlign: 'center' }}>
                      <AdminPanelSettings sx={{ fontSize: 80, color: '#EF4444', mb: 3 }} />
                      <Typography variant="h3" sx={{
                        background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 800,
                        mb: 3
                      }}>
                        Admin Dashboard
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', mb: 4 }}>
                        Administrative control panel for managing users, creating loan accounts, verifying customers, 
                        and overseeing system-wide operations:
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mt: 4 }}>
                        <Box sx={{ p: 3, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <Typography variant="h6" sx={{ color: '#EF4444', fontWeight: 600, mb: 1 }}>User Management</Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>View all users, verify accounts, and manage customer profiles</Typography>
                        </Box>
                        <Box sx={{ p: 3, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <Typography variant="h6" sx={{ color: '#EF4444', fontWeight: 600, mb: 1 }}>💼 Loan Creation</Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Create new loan accounts and set terms for clients</Typography>
                        </Box>
                        <Box sx={{ p: 3, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <Typography variant="h6" sx={{ color: '#EF4444', fontWeight: 600, mb: 1 }}>📊 System Analytics</Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Monitor platform performance and user activity</Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Fade>
              </TabPanel>
            )}
          </>
        )}

        {/* Other Error States */}
        {error && error !== 'No loan accounts found' && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Main Dashboard Content */}
        {!loading && loanData && (
          <>
            {/* Tab Content */}
            <TabPanel value={tabValue} index={0}>
              {/* Overview Tab - Loan Summary Cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 4, mb: 3 }}>
                {/* Current Balance Card - Featured */}
                <Fade in={cardAnimations[0]} timeout={800}>
                  <Card
                    sx={{
                      background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
                      color: 'white',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
                        pointerEvents: 'none'
                      }
                    }}
                  >
                    <CardContent sx={{ position: 'relative', zIndex: 1, p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <AccountBalanceWallet sx={{ fontSize: 32, mr: 2, opacity: 0.9 }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.9 }}>
                          Current Balance
                        </Typography>
                      </Box>
                      <Typography variant="h2" component="div" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                        ${parseFloat(loanData.current_balance).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Fade>

                <Fade in={cardAnimations[1]} timeout={1000}>
                  <Card sx={{ position: 'relative' }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #9333EA, #A855F7)', 
                          borderRadius: '12px', 
                          p: 1.5, 
                          mr: 2 
                        }}>
                          <AttachMoney sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
                          Total Bonuses
                        </Typography>
                      </Box>
                      <Typography variant="h3" component="div" color="secondary.main" sx={{ fontWeight: 800 }}>
                        ${parseFloat(loanData.total_bonuses).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Fade>

                <Fade in={cardAnimations[2]} timeout={1200}>
                  <Card sx={{ position: 'relative' }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #10B981, #34D399)', 
                          borderRadius: '12px', 
                          p: 1.5, 
                          mr: 2 
                        }}>
                          <Timeline sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
                          Monthly Rate
                        </Typography>
                      </Box>
                      <Typography variant="h3" component="div" color="success.main" sx={{ fontWeight: 800 }}>
                        {(parseFloat(loanData.monthly_rate) * 100).toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Fade>

                <Fade in={cardAnimations[3]} timeout={1400}>
                  <Card sx={{ position: 'relative' }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', 
                          borderRadius: '12px', 
                          p: 1.5, 
                          mr: 2 
                        }}>
                          <CreditCard sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
                          Account Number
                        </Typography>
                      </Box>
                      <Typography 
                        variant="h4" 
                        component="div" 
                        sx={{ 
                          fontWeight: 700, 
                          fontFamily: '"JetBrains Mono", monospace',
                          color: 'info.main',
                          letterSpacing: '0.05em'
                        }}
                      >
                        {loanData.account_number}
                      </Typography>
                    </CardContent>
                  </Card>
                </Fade>

                <Fade in={cardAnimations[4]} timeout={1600}>
                  <Card sx={{ position: 'relative' }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #EF4444, #F87171)', 
                          borderRadius: '12px', 
                          p: 1.5, 
                          mr: 2 
                        }}>
                          <Payment sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
                          Monthly Payment
                        </Typography>
                      </Box>
                      <Typography variant="h3" component="div" color="error.main" sx={{ fontWeight: 800 }}>
                        ${(parseFloat(loanData.current_balance) * parseFloat(loanData.monthly_rate)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </Typography>
                    </CardContent>
                  </Card>
                </Fade>

                <Fade in={cardAnimations[5]} timeout={1800}>
                  <Card sx={{ position: 'relative' }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', 
                          borderRadius: '12px', 
                          p: 1.5, 
                          mr: 2 
                        }}>
                          <TrendingUp sx={{ fontSize: 28, color: 'white', transform: 'rotate(180deg)' }} />
                        </Box>
                        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
                          Total Withdrawals
                        </Typography>
                      </Box>
                      <Typography variant="h3" component="div" color="warning.main" sx={{ fontWeight: 800 }}>
                        ${parseFloat(loanData.total_withdrawals || '0').toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Fade>
              </Box>

              {/* Quick Actions Section */}
              <Fade in={true} timeout={2000}>
                <Card sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  borderRadius: 3,
                  mt: 4
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                      <RequestPage sx={{ fontSize: 28, color: 'primary.main' }} />
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        Account Actions
                      </Typography>
                    </Box>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                      Manage your account with quick actions for withdrawals and consultations
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 3 }}>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<AccountBalanceWallet />}
                        onClick={() => setWithdrawalDialogOpen(true)}
                        sx={{
                          py: 2,
                          background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                          color: 'white',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #D97706, #F59E0B)',
                          },
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        Request Withdrawal
                      </Button>
                      {!meetingRequest ? (
                        <Button
                          variant="contained"
                          size="large"
                          startIcon={<CalendarMonth sx={{ color: '#3B82F6' }} />}
                          onClick={() => setMeetingDialogOpen(true)}
                          sx={{
                            py: 2,
                            background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                            color: '#3B82F6',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            fontWeight: 600,
                            '&:hover': {
                              background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                              boxShadow: '0 8px 16px rgba(59, 130, 246, 0.4)',
                              border: '1px solid rgba(59, 130, 246, 0.5)',
                              transform: 'translateY(-2px)',
                            },
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                            transition: 'all 0.2s ease-in-out',
                          }}
                        >
                          Schedule Meeting
                        </Button>
                      ) : meetingRequest.status === 'pending' ? (
                        <Card sx={{
                          py: 2,
                          px: 3,
                          background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                          color: 'white',
                          textAlign: 'center',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <Pending sx={{ fontSize: 24, color: '#F59E0B' }} />
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 600, color: '#F59E0B' }}>
                                Meeting Request Pending
                              </Typography>
                              <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                                Requested for {formatDate(meetingRequest.preferred_date)}
                              </Typography>
                            </Box>
                          </Box>
                        </Card>
                      ) : meetingRequest.status === 'scheduled' ? (
                        <Card 
                          variant="outlined"
                          sx={{
                            py: 2,
                            px: 3,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: 2,
                            }
                          }}
                          onClick={() => setMeetingDetailsOpen(true)}
                        >
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
                              Meeting Scheduled
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                              {formatDate(meetingRequest.scheduled_date || meetingRequest.preferred_date)}
                              {meetingRequest.scheduled_time && ` at ${formatTime(meetingRequest.scheduled_time)}`}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Click for details
                            </Typography>
                          </Box>
                        </Card>
                      ) : (
                        <Card sx={{
                          py: 2,
                          px: 3,
                          background: 'linear-gradient(135deg, #6B7280, #4B5563)',
                          color: 'white',
                          textAlign: 'center',
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <Schedule sx={{ fontSize: 24 }} />
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                Meeting {meetingRequest.status.charAt(0).toUpperCase() + meetingRequest.status.slice(1)}
                              </Typography>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => setMeetingDialogOpen(true)}
                                sx={{ 
                                  color: 'white', 
                                  textDecoration: 'underline',
                                  mt: 0.5,
                                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                                }}
                              >
                                Schedule New Meeting
                              </Button>
                            </Box>
                          </Box>
                        </Card>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Fade>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {/* Enhanced Analytics Tab */}
              {analyticsData ? (
                <Fade in={!!analyticsData} timeout={1000}>
                  <Box>
                    {/* Analytics Navigation */}
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      mb: 4,
                      p: 3,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                      borderRadius: '16px',
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                          Portfolio Analytics
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          Comprehensive performance insights and advanced metrics
                        </Typography>
                      </Box>
                    </Box>

                    {/* Portfolio Dashboard */}
                    <PortfolioDashboard analytics={analyticsData.analytics} loanData={loanData} />
                    
                    {/* Advanced Metrics */}
                    <Box sx={{ mt: 6 }}>
                      <AdvancedMetrics analytics={analyticsData.analytics} loanData={loanData} />
                    </Box>

                    {/* Original Chart - Now as Historical Overview */}
                    <Box sx={{ mt: 6 }}>
                      <Card>
                        <CardContent sx={{ p: 4 }}>
                          <LoanGrowthChart analytics={analyticsData.analytics} height={500} />
                        </CardContent>
                      </Card>
                    </Box>
                  </Box>
                </Fade>
              ) : (
                <Card>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ 
                      textAlign: 'center', 
                      py: 6,
                      background: 'rgba(107, 70, 193, 0.02)',
                      borderRadius: '16px',
                      border: '1px solid rgba(107, 70, 193, 0.1)',
                    }}>
                      <Box
                        sx={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 3,
                        }}
                      >
                        <CircularProgress 
                          size={60} 
                          thickness={4}
                          sx={{ 
                            color: 'primary.main',
                            filter: 'drop-shadow(0 0 10px rgba(107, 70, 193, 0.4))',
                          }}
                        />
                      </Box>
                      <Typography 
                        variant="h6" 
                        gutterBottom
                        sx={{
                          background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          fontWeight: 600
                        }}
                      >
                        Loading Advanced Analytics...
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
                        Preparing comprehensive performance insights
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {/* Transactions Tab - Transaction History */}
              <TransactionHistory loanId={loanData.id.toString()} />
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              {/* Documents Tab */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Folder sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      Document Center
                    </Typography>
                  </Box>
                  <Chip 
                    label={`${filteredDocuments.length} documents`}
                    color="primary"
                    variant="outlined"
                  />
                </Box>

                {/* Search and Filter Controls */}
                <Card sx={{ 
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                      <TextField
                        placeholder="Search documents..."
                        value={documentSearch}
                        onChange={(e) => setDocumentSearch(e.target.value)}
                        size="small"
                        sx={{ minWidth: 300, flex: 1 }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Category</InputLabel>
                        <Select
                          value={documentCategoryFilter}
                          label="Category"
                          onChange={(e) => setDocumentCategoryFilter(e.target.value)}
                          startAdornment={<FilterList sx={{ color: 'text.secondary', mr: 1 }} />}
                        >
                          <MenuItem value="">All Categories</MenuItem>
                          {documentCategories.map((category) => (
                            <MenuItem key={category} value={category}>
                              {category}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {(documentSearch || documentCategoryFilter) && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setDocumentSearch('');
                            setDocumentCategoryFilter('');
                          }}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* Documents Grid */}
                {filteredDocuments.length > 0 ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 3 }}>
                    {filteredDocuments.map((doc, index) => (
                      <Fade in={true} timeout={800 + index * 100} key={doc.id}>
                        <Card sx={{
                          position: 'relative',
                          overflow: 'hidden',
                          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                          borderRadius: 3,
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                          }
                        }}>
                          <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                              <Box sx={{ 
                                p: 1.5, 
                                borderRadius: 2, 
                                background: alpha(theme.palette.primary.main, 0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {getFileIcon(doc.title)}
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography 
                                  variant="h6" 
                                  sx={{ 
                                    fontWeight: 600, 
                                    mb: 0.5,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={doc.title}
                                >
                                  {doc.title}
                                </Typography>
                                <Chip
                                  label={doc.category}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ mb: 1 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                  Uploaded: {new Date(doc.upload_date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </Typography>
                              </Box>
                            </Box>
                            <Button
                              variant="contained"
                              fullWidth
                              startIcon={<GetApp />}
                              onClick={() => handleDocumentDownload(doc.id, doc.title)}
                              sx={{
                                mt: 2,
                                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                '&:hover': {
                                  background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                                }
                              }}
                            >
                              Download
                            </Button>
                          </CardContent>
                        </Card>
                      </Fade>
                    ))}
                  </Box>
                ) : (
                  <Card sx={{ 
                    textAlign: 'center', 
                    py: 8,
                    background: alpha(theme.palette.background.paper, 0.5),
                    border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`
                  }}>
                    <CardContent>
                      <Description sx={{ fontSize: 64, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                        {documents.length === 0 ? 'No documents available yet' : 'No documents match your search'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {documents.length === 0 
                          ? 'Documents will appear here once they are uploaded to your account'
                          : 'Try adjusting your search terms or filters'
                        }
                      </Typography>
                      {(documentSearch || documentCategoryFilter) && (
                        <Button
                          variant="outlined"
                          sx={{ mt: 2 }}
                          onClick={() => {
                            setDocumentSearch('');
                            setDocumentCategoryFilter('');
                          }}
                        >
                          Clear All Filters
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Box>
            </TabPanel>

            {isAdmin && (
              <TabPanel value={tabValue} index={4}>
                {/* Admin Tab */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Admin Panel
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                      Administrative tools and customer management features.
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 2 }}>
                      <Button 
                        variant="outlined" 
                        onClick={() => window.open('/admin', '_blank')}
                        startIcon={<AdminPanelSettings />}
                      >
                        Open Full Admin Dashboard
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </TabPanel>
            )}
          </>
        )}
      </Container>

      {/* Dialog Components */}
      {loanData && (
        <>
          <WithdrawalRequestDialog
            open={withdrawalDialogOpen}
            onClose={() => setWithdrawalDialogOpen(false)}
            currentBalance={parseFloat(loanData.current_balance)}
            onRequestSubmitted={() => {
              // Optionally refresh data or show success message
              console.log('Withdrawal request submitted successfully');
            }}
          />
          <MeetingRequestDialog
            open={meetingDialogOpen}
            onClose={() => setMeetingDialogOpen(false)}
            onRequestSubmitted={() => {
              // Refresh meeting data after submission
              fetchLoanData();
              console.log('Meeting request submitted successfully');
            }}
          />

          {/* Meeting Details Dialog */}
          {meetingRequest && meetingRequest.status === 'scheduled' && (
            <Dialog
              open={meetingDetailsOpen}
              onClose={() => setMeetingDetailsOpen(false)}
              maxWidth="sm"
              fullWidth
              PaperProps={{
                sx: {
                  backgroundColor: '#1f2937',
                  borderRadius: 3,
                }
              }}
            >
              <DialogTitle sx={{ pb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  Meeting Details
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your scheduled consultation information
                </Typography>
              </DialogTitle>

              <DialogContent sx={{ pt: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Date and Time */}
                  <Paper variant="outlined" sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
                      Meeting Schedule
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1, color: 'text.primary' }}>
                      <strong>Date:</strong> {formatDate(meetingRequest.scheduled_date || meetingRequest.preferred_date)}
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.primary' }}>
                      <strong>Time:</strong> {meetingRequest.scheduled_time ? formatTime(meetingRequest.scheduled_time) : 'Time TBD'}
                    </Typography>
                  </Paper>

                  {/* Meeting Purpose */}
                  {meetingRequest.purpose && (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
                        Meeting Purpose
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'text.primary' }}>
                        {meetingRequest.purpose}
                      </Typography>
                    </Paper>
                  )}

                  {/* Meeting Link for Video Calls */}
                  {meetingRequest.meeting_type === 'video' && meetingRequest.meeting_link && (
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      href={meetingRequest.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 600,
                      }}
                    >
                      Join Meeting
                    </Button>
                  )}

                  {/* Phone Call Information */}
                  {meetingRequest.meeting_type === 'phone' && (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
                        Phone Call Details
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'text.primary' }}>
                        We will call you at your registered phone number at the scheduled time.
                      </Typography>
                    </Paper>
                  )}
                </Box>
              </DialogContent>

              <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
                <Button 
                  onClick={() => setMeetingDetailsOpen(false)} 
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
                  Close
                </Button>
                <Button 
                  onClick={handleCancelMeeting}
                  variant="contained"
                  startIcon={<Cancel />}
                  sx={{ 
                    minWidth: 150,
                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                    color: 'white',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                      boxShadow: '0 8px 16px rgba(239, 68, 68, 0.4)',
                    },
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  }}
                >
                  Cancel Meeting
                </Button>
              </DialogActions>
            </Dialog>
          )}
        </>
      )}
    </Box>
  );
};

export default Dashboard; 