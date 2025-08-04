import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
  Avatar,
  IconButton,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Fade,
  Slide,
  useTheme,
  alpha,
} from '@mui/material';
import { 
  ExitToApp, 
  Person, 
  TrendingUp, 
  AccountBalance, 
  History, 
  Description, 
  AdminPanelSettings,
  AttachMoney,
  Timeline,
  AccountBalanceWallet,
  CreditCard
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import LoanGrowthChart from '../components/charts/LoanGrowthChart';
import TransactionHistory from '../components/TransactionHistory';
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
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
      const loansResponse = await fetch('http://localhost:5001/api/loans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!loansResponse.ok) {
        throw new Error(`HTTP ${loansResponse.status}: ${loansResponse.statusText}`);
      }
      
      const loans = await loansResponse.json();
      
      if (loans.length > 0) {
        setLoanData(loans[0]);
        
        // Fetch analytics for the first loan
        const analyticsResponse = await fetch(`http://localhost:5001/api/loans/${loans[0].id}/analytics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!analyticsResponse.ok) {
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
      <Slide direction="down" in={true} timeout={800}>
        <AppBar position="static" elevation={0}>
          <Toolbar sx={{ py: 1 }}>
            <Typography 
              variant="h5" 
              component="div" 
              sx={{ 
                flexGrow: 1, 
                background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)', 
                backgroundClip: 'text', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent', 
                fontWeight: 800,
                letterSpacing: '-0.01em',
                fontSize: '1.75rem'
              }}
            >
              ESOTERIC ENTERPRISES
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                background: 'rgba(107, 70, 193, 0.1)',
                padding: '8px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(107, 70, 193, 0.2)'
              }}>
                <Avatar sx={{ 
                  background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)', 
                  width: 36, 
                  height: 36, 
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Account Holder
                  </Typography>
                </Box>
              </Box>
              <IconButton 
                color="inherit" 
                size="medium"
                sx={{ 
                  background: 'rgba(107, 70, 193, 0.1)',
                  '&:hover': { 
                    background: 'rgba(107, 70, 193, 0.2)',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <Person />
              </IconButton>
              <Button
                color="inherit"
                startIcon={<ExitToApp />}
                onClick={handleLogout}
                sx={{ 
                  color: 'text.primary',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '10px',
                  '&:hover': {
                    background: 'rgba(239, 68, 68, 0.2)',
                    transform: 'translateY(-1px)'
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                Logout
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
      </Slide>

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
              Welcome back, {user?.firstName}! 👋
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

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Main Dashboard Content */}
        {!loading && !error && loanData && (
          <>
            {/* Tab Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange} 
                aria-label="dashboard tabs"
                textColor="primary"
                indicatorColor="primary"
              >
                <Tab 
                  icon={<AccountBalance />} 
                  label="Overview" 
                  id="dashboard-tab-0"
                  aria-controls="dashboard-tabpanel-0"
                />
                <Tab 
                  icon={<TrendingUp />} 
                  label="Analytics" 
                  id="dashboard-tab-1"
                  aria-controls="dashboard-tabpanel-1"
                />
                <Tab 
                  icon={<History />} 
                  label="Transactions" 
                  id="dashboard-tab-2"
                  aria-controls="dashboard-tabpanel-2"
                />
                <Tab 
                  icon={<Description />} 
                  label="Documents" 
                  id="dashboard-tab-3"
                  aria-controls="dashboard-tabpanel-3"
                />
                {isAdmin && (
                  <Tab 
                    icon={<AdminPanelSettings />} 
                    label="Admin" 
                    id="dashboard-tab-4"
                    aria-controls="dashboard-tabpanel-4"
                  />
                )}
              </Tabs>
            </Box>

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
                          🎯 Performance rewards
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
                          📈 Base rate + bonuses
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
                          🆔 Loan identifier
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Fade>
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {/* Analytics Tab - Charts */}
              {analyticsData ? (
                <Fade in={!!analyticsData} timeout={1000}>
                  <Card>
                    <CardContent sx={{ p: 4 }}>
                      <LoanGrowthChart analytics={analyticsData.analytics} height={500} />
                    </CardContent>
                  </Card>
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
                        📈 Loading Analytics...
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
                        Preparing your loan performance charts
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
                    📄 Your Documents
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
                      🔧 Admin Panel
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