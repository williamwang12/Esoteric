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
  Description
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import LoanGrowthChart from '../components/charts/LoanGrowthChart';
import PortfolioDashboard from '../components/charts/PortfolioDashboard';
import AdvancedMetrics from '../components/charts/AdvancedMetrics';
import TransactionHistory from '../components/TransactionHistory';
import AppNavigation from '../components/AppNavigation';
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardAnimations, setCardAnimations] = useState<boolean[]>([false, false, false, false, false, false]);

  const handleLogout = () => {
    logout();
    navigate('/login');
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
                          <Typography variant="h6" sx={{ color: '#EF4444', fontWeight: 600, mb: 1 }}>👥 User Management</Typography>
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
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800 }}>
                            {((analyticsData.analytics.currentBalance - analyticsData.analytics.totalPrincipal) / analyticsData.analytics.totalPrincipal * 100).toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Total Return
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Portfolio Dashboard */}
                    <PortfolioDashboard analytics={analyticsData.analytics} loanData={loanData} />
                    
                    {/* Advanced Metrics */}
                    <Box sx={{ mt: 6 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                        Advanced Analytics
                      </Typography>
                      <AdvancedMetrics analytics={analyticsData.analytics} loanData={loanData} />
                    </Box>

                    {/* Original Chart - Now as Historical Overview */}
                    <Box sx={{ mt: 6 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                        Historical Growth Overview
                      </Typography>
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
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Your Documents
                  </Typography>
                  {documents.length > 0 ? (
                    <Box sx={{ display: 'grid', gap: 2 }}>
                      {documents.map((doc) => (
                        <Card key={doc.id} variant="outlined">
                          <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="h6">{doc.title}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Category: {doc.category} • Uploaded: {new Date(doc.upload_date).toLocaleDateString()}
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleDocumentDownload(doc.id, doc.title)}
                            >
                              Download
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No documents available yet.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
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
    </Box>
  );
};

export default Dashboard; 