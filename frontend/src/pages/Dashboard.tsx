import React from 'react';
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
} from '@mui/material';
import { ExitToApp, Person } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Top Navigation */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography
            variant="h5"
            component="div"
            sx={{
              flexGrow: 1,
              background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700,
            }}
          >
            ESOTERIC ENTERPRISES
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: 32,
                  height: 32,
                  fontSize: '0.875rem',
                }}
              >
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

        {/* Loan Overview Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 4 }}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Loan Balance
              </Typography>
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
                $125,450.00
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                Principal amount invested
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="text.primary">
                This Month's Earnings
              </Typography>
              <Typography variant="h3" component="div" color="success.main" sx={{ fontWeight: 'bold' }}>
                +$1,254.50
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                1% base rate + bonus
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="text.primary">
                Total Earned
              </Typography>
              <Typography variant="h3" component="div" color="success.main" sx={{ fontWeight: 'bold' }}>
                $15,320.75
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Since account opening
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Loan Growth Chart Placeholder */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loan Growth & Bonus Performance
            </Typography>
            <Box
              sx={{
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(107, 70, 193, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
                borderRadius: 2,
                border: '2px dashed rgba(107, 70, 193, 0.3)',
              }}
            >
              <Typography variant="h6" color="text.secondary">
                📈 Chart Component Coming in Phase 2
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Next Payment: $1,254.50 (Base) + $320.25 (Bonus) - Due Dec 15
              </Typography>
              
              <Box sx={{ mt: 2, space: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                    <Typography variant="body2">Monthly Payment</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="success.main">+$1,254.50</Typography>
                    <Typography variant="caption" color="text.secondary">Oct 15</Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
                    <Typography variant="body2">Bonus Payment</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="primary.main">+$320.25</Typography>
                    <Typography variant="caption" color="text.secondary">Oct 15</Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                    <Typography variant="body2">Withdrawal</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="warning.main">-$500.00</Typography>
                    <Typography variant="caption" color="text.secondary">Oct 10</Typography>
                  </Box>
                </Box>
              </Box>
              
              <Button variant="outlined" sx={{ mt: 2 }} fullWidth>
                View All Transactions
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Dashboard; 