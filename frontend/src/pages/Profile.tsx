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
  Divider,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Fade,
  Paper,
} from '@mui/material';
import {
  ArrowBack,
  Person,
  Email,
  Phone,
  CalendarToday,
  AccountBalance,
  Edit,
  Save,
  Cancel,
  Verified,
  Security,
  TrendingUp,
  AttachMoney,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { userApi, loansApi, twoFAApi } from '../services/api';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loanSummary, setLoanSummary] = useState<any>(null);
  const [twoFAStatus, setTwoFAStatus] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      
      // Fetch user profile - API returns user data directly, not wrapped in 'user' property
      const profileResponse = await userApi.getProfile();
      console.log('Profile API response:', profileResponse);
      
      // Handle different response formats
      const userData = profileResponse.user || profileResponse;
      setProfileData({
        ...userData,
        firstName: userData.first_name || userData.firstName,
        lastName: userData.last_name || userData.lastName,
        email: userData.email,
        phone: userData.phone,
        createdAt: userData.created_at || userData.createdAt
      });
      
      // Update form with current data
      setEditForm({
        firstName: userData.first_name || userData.firstName || '',
        lastName: userData.last_name || userData.lastName || '',
        phone: userData.phone || ''
      });

      // Fetch loan summary
      try {
        const loans = await loansApi.getLoans();
        if (loans.length > 0) {
          setLoanSummary(loans[0]);
        }
      } catch (loanError) {
        console.error('Loan fetch error:', loanError);
      }

      // Fetch 2FA status
      try {
        const twoFAData = await twoFAApi.getStatus();
        console.log('2FA API response:', twoFAData);
        setTwoFAStatus({
          isEnabled: twoFAData.enabled || false
        });
      } catch (twoFAError) {
        console.error('2FA status fetch error:', twoFAError);
      }

    } catch (err) {
      console.error('Profile fetch error:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    setEditForm({
      firstName: profileData?.firstName || '',
      lastName: profileData?.lastName || '',
      phone: profileData?.phone || ''
    });
    setEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const updateResponse = await userApi.updateProfile(editForm);
      console.log('Profile update response:', updateResponse);
      
      // Update local state - handle different response formats
      const updatedUser = updateResponse.user || updateResponse;
      setProfileData((prev: any) => ({
        ...prev,
        firstName: updatedUser.first_name || updatedUser.firstName || editForm.firstName,
        lastName: updatedUser.last_name || updatedUser.lastName || editForm.lastName,
        phone: updatedUser.phone || editForm.phone
      }));
      
      // Update auth context
      updateUser({
        ...user,
        firstName: editForm.firstName,
        lastName: editForm.lastName
      });
      
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Profile update error:', error);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Navigation Bar */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <IconButton
            color="inherit"
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography 
            variant="h5" 
            component="div" 
            sx={{ 
              flexGrow: 1, 
              background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)', 
              backgroundClip: 'text', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              fontWeight: 700 
            }}
          >
            PROFILE
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={60} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!loading && profileData && (
          <Fade in={true} timeout={1000}>
            <Box>
              {/* Profile Header Card */}
              <Card sx={{ mb: 4, overflow: 'visible', position: 'relative' }}>
                <Box
                  sx={{
                    background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
                    height: 120,
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
                    }
                  }}
                />
                <CardContent sx={{ pt: 0, pb: 4, position: 'relative', zIndex: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'end', mt: -8 }}>
                    <Avatar
                      sx={{
                        width: 120,
                        height: 120,
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #374151 0%, #1F2937 100%)',
                        border: '4px solid white',
                        boxShadow: '0 8px 32px rgba(107, 70, 193, 0.3)',
                        mr: 3,
                        position: 'relative',
                        zIndex: 3
                      }}
                    >
                      {profileData.firstName?.[0]}{profileData.lastName?.[0]}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, mb: 2, position: 'relative', zIndex: 3 }}>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                        {profileData.firstName} {profileData.lastName}
                      </Typography>
                      <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                        Esoteric Enterprises Client
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Verified color="primary" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">
                          Verified Account
                        </Typography>
                        {twoFAStatus?.isEnabled && (
                          <>
                            <Security color="success" fontSize="small" sx={{ ml: 2 }} />
                            <Typography variant="body2" color="success.main">
                              2FA Enabled
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={handleEditProfile}
                      sx={{ mb: 2, position: 'relative', zIndex: 3 }}
                    >
                      Edit Profile
                    </Button>
                  </Box>
                </CardContent>
              </Card>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
                {/* Personal Information */}
                <Card sx={{ height: 'fit-content' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                      👤 Personal Information
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Email color="primary" sx={{ mr: 2 }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Email Address
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {profileData.email}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider />

                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Phone color="primary" sx={{ mr: 2 }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Phone Number
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {profileData.phone || 'Not provided'}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider />

                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarToday color="primary" sx={{ mr: 2 }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Member Since
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatDate(profileData.createdAt)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card sx={{ height: 'fit-content' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                      💼 Account Summary
                    </Typography>
                    
                    {loanSummary ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <AccountBalance color="primary" sx={{ mr: 2 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Account Number
                            </Typography>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontFamily: 'monospace', 
                                fontWeight: 600,
                                color: 'primary.main'
                              }}
                            >
                              {loanSummary.account_number}
                            </Typography>
                          </Box>
                        </Box>

                        <Divider />

                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <AttachMoney color="success" sx={{ mr: 2 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Current Balance
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                              {formatCurrency(loanSummary.current_balance)}
                            </Typography>
                          </Box>
                        </Box>

                        <Divider />

                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <TrendingUp color="info" sx={{ mr: 2 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Monthly Rate
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: 'info.main' }}>
                              {(parseFloat(loanSummary.monthly_rate) * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                        </Box>

                        <Paper sx={{ p: 3, backgroundColor: 'grey.50', mt: 2 }}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Principal Amount
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {formatCurrency(loanSummary.principal_amount)}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Total Growth
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                                +{formatCurrency(parseFloat(loanSummary.current_balance) - parseFloat(loanSummary.principal_amount))}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <AccountBalance sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No Active Loan Account
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Contact our team to set up your loan account.
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>

              <Card sx={{ mt: 4 }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                    🔐 Security & Authentication
                  </Typography>
                  
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, 
                    gap: 3 
                  }}>
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <Chip
                        icon={<Verified />}
                        label="Account Verified"
                        color="success"
                        sx={{ mb: 2, fontWeight: 600 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Your account has been verified
                      </Typography>
                    </Box>
                    
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <Chip
                        icon={<Security />}
                        label={twoFAStatus?.isEnabled ? "2FA Enabled" : "2FA Disabled"}
                        color={twoFAStatus?.isEnabled ? "success" : "warning"}
                        sx={{ mb: 2, fontWeight: 600 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Two-factor authentication status
                      </Typography>
                    </Box>
                    
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <Chip
                        icon={<Email />}
                        label="Email Confirmed"
                        color="info"
                        sx={{ mb: 2, fontWeight: 600 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Email address is confirmed
                      </Typography>
                    </Box>
                    
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <Chip
                        icon={<Person />}
                        label="KYC Complete"
                        color="primary"
                        sx={{ mb: 2, fontWeight: 600 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Identity verification complete
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Fade>
        )}

        {/* Edit Profile Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ 
            background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Edit />
            Edit Profile Information
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
              <TextField
                label="First Name"
                value={editForm.firstName}
                onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                fullWidth
                required
              />
              
              <TextField
                label="Last Name"
                value={editForm.lastName}
                onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                fullWidth
                required
              />
              
              <TextField
                label="Phone Number"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                fullWidth
                placeholder="+1 (555) 123-4567"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setEditDialogOpen(false)}
              startIcon={<Cancel />}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveProfile}
              variant="contained"
              disabled={saving || !editForm.firstName || !editForm.lastName}
              startIcon={saving ? <CircularProgress size={16} /> : <Save />}
              sx={{ 
                background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #553C9A 0%, #7C2D92 100%)',
                }
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default Profile;