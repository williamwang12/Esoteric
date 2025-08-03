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
} from '@mui/material';
import { ExitToApp, Person, TrendingUp, AccountBalance, History } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import LoanGrowthChart from '../components/charts/LoanGrowthChart';
import TransactionHistory from '../components/TransactionHistory';

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
  const [tabValue, setTabValue] = useState(0);
  const [loanData, setLoanData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
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

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Navigation Bar */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h5" component="div" sx={{ flexGrow: 1, background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>
            ESOTERIC ENTERPRISES
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.875rem' }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Avatar>
              <Typography variant="body2" color="text.primary">
                {user?.firstName} {user?.lastName}
              </Typography>
            </Box>
            <IconButton color="inherit" size="small">
              <Person />
            </IconButton>
            <Button
              color="inherit"
              startIcon={<ExitToApp />}
              onClick={handleLogout}
              sx={{ color: 'text.primary' }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Welcome Section */}
        <Box mb={4}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome back, {user?.firstName}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's an overview of your loan performance with Esoteric Enterprises.
          </Typography>
        </Box>



        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
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
              </Tabs>
            </Box>

            {/* Tab Content */}
            <TabPanel value={tabValue} index={0}>
              {/* Overview Tab - Loan Summary Cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 4 }}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                    color: 'white',
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Current Balance
                    </Typography>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
                      ${parseFloat(loanData.current_balance).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                      Principal: ${parseFloat(loanData.principal_amount).toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="text.primary">
                      Total Bonuses
                    </Typography>
                    <Typography variant="h3" component="div" color="secondary.main" sx={{ fontWeight: 'bold' }}>
                      ${parseFloat(loanData.total_bonuses).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Performance rewards
                    </Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="text.primary">
                      Monthly Rate
                    </Typography>
                    <Typography variant="h3" component="div" color="success.main" sx={{ fontWeight: 'bold' }}>
                      {(parseFloat(loanData.monthly_rate) * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Base rate + bonuses
                    </Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="text.primary">
                      Account Number
                    </Typography>
                    <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {loanData.account_number}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loan identifier
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {/* Analytics Tab - Charts */}
              {analyticsData ? (
                <Card>
                  <CardContent>
                    <LoanGrowthChart analytics={analyticsData.analytics} height={500} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      📈 Loading Analytics...
                    </Typography>
                    <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.100', borderRadius: 2 }}>
                      <CircularProgress />
                    </Box>
                  </CardContent>
                </Card>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {/* Transactions Tab - Transaction History */}
              <TransactionHistory loanId={loanData.id.toString()} />
            </TabPanel>
          </>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard; 