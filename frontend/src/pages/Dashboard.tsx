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
  CreditCard
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
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
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loanData, setLoanData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardAnimations, setCardAnimations] = useState<boolean[]>([false, false, false, false]);

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
    const timeouts = [0, 1, 2, 3].map((index) => 
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

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative' }}>
      {/* Navigation Bar */}
      <AppNavigation 
        onLogout={handleLogout} 
        dashboardTab={tabValue}
        onDashboardTabChange={(tab) => setTabValue(tab)}
      />

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Welcome Section */}
        <Fade in={true} timeout={1000}>
          <Box mb={6}>
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
              Welcome back, {user?.firstName}!
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
              Here's an overview of your loan performance with Esoteric Enterprises. Track your growth, manage your investments, and explore your financial journey.
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

        {/* Error State - Special handling for new users */}
        {error && error === 'No loan accounts found' && (
          <Fade in={true} timeout={1000}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
                border: '2px solid rgba(107, 70, 193, 0.2)',
                borderRadius: '20px',
                overflow: 'hidden',
                position: 'relative',
                mb: 4,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(45deg, rgba(107, 70, 193, 0.05) 0%, transparent 50%, rgba(147, 51, 234, 0.05) 100%)',
                  pointerEvents: 'none'
                }
              }}
            >
              <CardContent sx={{ p: 6, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <Box sx={{ mb: 4 }}>
                  <AccountBalance 
                    sx={{ 
                      fontSize: 80, 
                      color: 'primary.main',
                      filter: 'drop-shadow(0 4px 8px rgba(107, 70, 193, 0.3))',
                      mb: 2
                    }} 
                  />
                </Box>
                <Typography 
                  variant="h3" 
                  component="h2" 
                  gutterBottom
                  sx={{
                    background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 800,
                    mb: 3
                  }}
                >
                  Welcome to Esoteric Enterprises!
                </Typography>
                <Typography 
                  variant="h6" 
                  color="text.secondary" 
                  sx={{ mb: 4, maxWidth: '600px', mx: 'auto', lineHeight: 1.6 }}
                >
                  Your account has been successfully created. To get started with your loan management experience, 
                  please contact our team to set up your loan account.
                </Typography>
                
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, 
                  gap: 3, 
                  mt: 4,
                  maxWidth: '600px',
                  mx: 'auto'
                }}>
                  <Card variant="outlined" sx={{ p: 3, background: 'rgba(255, 255, 255, 0.8)' }}>
                    <Typography variant="h6" gutterBottom color="primary.main" sx={{ fontWeight: 600 }}>
                      📞 Contact Our Team
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Reach out to our loan specialists to discuss your investment opportunities and set up your account.
                    </Typography>
                  </Card>
                  
                  <Card variant="outlined" sx={{ p: 3, background: 'rgba(255, 255, 255, 0.8)' }}>
                    <Typography variant="h6" gutterBottom color="secondary.main" sx={{ fontWeight: 600 }}>
                      📋 Prepare Documents
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Gather your financial documents and identification for a smooth onboarding process.
                    </Typography>
                  </Card>
                </Box>

                <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(107, 70, 193, 0.2)' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Once your loan account is activated, you'll have access to our comprehensive dashboard with 
                    real-time analytics, transaction history, and performance tracking.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* Other Error States */}
        {error && error !== 'No loan accounts found' && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Main Dashboard Content */}
        {!loading && !error && loanData && (
          <>
            {/* Tab Content */}
            <TabPanel value={tabValue} index={0}>
              {/* Overview Tab - Loan Summary Cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 4, mb: 6 }}>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <AccountBalanceWallet sx={{ fontSize: 32, mr: 2, opacity: 0.9 }} />
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, opacity: 0.9 }}>
                          Current Balance
                        </Typography>
                      </Box>
                      <Typography variant="h2" component="div" sx={{ fontWeight: 800, mb: 2, letterSpacing: '-0.02em' }}>
                        ${parseFloat(loanData.current_balance).toLocaleString()}
                      </Typography>
                      <Box sx={{ 
                        background: 'rgba(255,255,255,0.2)', 
                        borderRadius: '8px', 
                        p: 2,
                        backdropFilter: 'blur(10px)'
                      }}>
                        <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                          Principal: ${parseFloat(loanData.principal_amount).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Growth: +${(parseFloat(loanData.current_balance) - parseFloat(loanData.principal_amount)).toLocaleString()}
                        </Typography>
                      </Box>
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
                        <Typography variant="h6" gutterBottom color="text.primary" sx={{ fontWeight: 600 }}>
                          Total Bonuses
                        </Typography>
                      </Box>
                      <Typography variant="h3" component="div" color="secondary.main" sx={{ fontWeight: 800, mb: 2 }}>
                        ${parseFloat(loanData.total_bonuses).toLocaleString()}
                      </Typography>
                      <Box sx={{ 
                        background: alpha(theme.palette.secondary.main, 0.1), 
                        borderRadius: '8px', 
                        p: 2,
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Performance rewards
                        </Typography>
                      </Box>
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
                        <Typography variant="h6" gutterBottom color="text.primary" sx={{ fontWeight: 600 }}>
                          Monthly Rate
                        </Typography>
                      </Box>
                      <Typography variant="h3" component="div" color="success.main" sx={{ fontWeight: 800, mb: 2 }}>
                        {(parseFloat(loanData.monthly_rate) * 100).toFixed(1)}%
                      </Typography>
                      <Box sx={{ 
                        background: alpha(theme.palette.success.main, 0.1), 
                        borderRadius: '8px', 
                        p: 2,
                        border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Base rate + bonuses
                        </Typography>
                      </Box>
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
                        <Typography variant="h6" gutterBottom color="text.primary" sx={{ fontWeight: 600 }}>
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
                          mb: 2,
                          letterSpacing: '0.05em'
                        }}
                      >
                        {loanData.account_number}
                      </Typography>
                      <Box sx={{ 
                        background: alpha(theme.palette.info.main, 0.1), 
                        borderRadius: '8px', 
                        p: 2,
                        border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Loan identifier
                        </Typography>
                      </Box>
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