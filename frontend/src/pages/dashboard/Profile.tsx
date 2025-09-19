import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
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
  useTheme,
  alpha,
  keyframes,
  styled,
} from '@mui/material';
import {
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
  AccountBalanceWallet,
  ArrowBack,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { userApi, loansApi, twoFAApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const FloatingOrb = styled(Box)(({ theme }) => ({
  position: 'absolute',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(111, 92, 242, 0.15), rgba(111, 92, 242, 0.15))',
  filter: 'blur(80px)',
  animation: `${keyframes`
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
    33% { transform: translate(40px, -40px) scale(1.1); opacity: 0.4; }
    66% { transform: translate(-30px, 30px) scale(0.9); opacity: 0.8; }
  `} 18s ease-in-out infinite`,
  pointerEvents: 'none',
}));

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
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
  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [twoFASetupData, setTwoFASetupData] = useState<any>(null);
  const [twoFAToken, setTwoFAToken] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [verificationRequestLoading, setVerificationRequestLoading] = useState(false);
  const [verificationRequestSent, setVerificationRequestSent] = useState(false);

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
        createdAt: userData.created_at || userData.createdAt,
        accountVerified: userData.account_verified || userData.accountVerified || false
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

  const handleSetup2FA = async () => {
    try {
      setTwoFALoading(true);
      setTwoFAError(null);
      const setupData = await twoFAApi.setup();
      setTwoFASetupData(setupData);
      setTwoFADialogOpen(true);
    } catch (error) {
      console.error('2FA setup error:', error);
      setTwoFAError('Failed to setup 2FA. Please try again.');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    try {
      setTwoFALoading(true);
      setTwoFAError(null);
      await twoFAApi.verifySetup(twoFAToken);
      
      // Update 2FA status
      setTwoFAStatus({ isEnabled: true });
      setTwoFADialogOpen(false);
      setTwoFAToken('');
      setTwoFASetupData(null);
      
      // Refresh profile data to get updated 2FA status
      await fetchProfileData();
    } catch (error) {
      console.error('2FA verification error:', error);
      setTwoFAError('Invalid verification code. Please try again.');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    try {
      setTwoFALoading(true);
      setTwoFAError(null);
      await twoFAApi.disable(twoFAToken);
      
      // Update 2FA status
      setTwoFAStatus({ isEnabled: false });
      setTwoFADialogOpen(false);
      setTwoFAToken('');
      
      // Refresh profile data to get updated 2FA status
      await fetchProfileData();
    } catch (error) {
      console.error('2FA disable error:', error);
      setTwoFAError('Invalid verification code. Please try again.');
    } finally {
      setTwoFALoading(false);
    }
  };


  const handleRequestAccountVerification = async () => {
    try {
      setVerificationRequestLoading(true);
      await userApi.requestAccountVerification();
      setVerificationRequestSent(true);
      setError(null);
    } catch (error: any) {
      console.error('Account verification request error:', error);
      setError(error.response?.data?.error || 'Failed to request account verification. Please try again.');
    } finally {
      setVerificationRequestLoading(false);
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
    <Box sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Background Orbs */}
      <FloatingOrb sx={{ width: 250, height: 250, top: '10%', left: '5%' }} />
      <FloatingOrb sx={{ width: 180, height: 180, bottom: '15%', right: '10%', animationDelay: '-6s' }} />
      <FloatingOrb sx={{ width: 120, height: 120, top: '60%', left: '75%', animationDelay: '-3s' }} />

      {/* Header with Back Button */}
      <Box sx={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(31, 41, 55, 0.9)',
        backdropFilter: 'blur(20px)',
        color: 'white',
        py: 2,
        borderBottom: '1px solid rgba(111, 92, 242, 0.2)',
        zIndex: 1000
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <Button
              onClick={() => navigate('/dashboard')}
              sx={{ 
                color: 'white',
                minWidth: 'auto',
                padding: '8px',
                borderRadius: '8px',
                '&:hover': { 
                  backgroundColor: 'rgba(255,255,255,0.1)' 
                }
              }}
            >
              <ArrowBack />
            </Button>
            
            {/* Centered ESOTERIC Logo */}
            <Box sx={{ 
              position: 'absolute', 
              left: '50%', 
              transform: 'translateX(-50%)',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <Typography variant="h4" sx={{ 
                fontWeight: 700,
                background: 'linear-gradient(135deg, #F9FAFB 0%, #8f7cf6 50%, #EC4899 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                ESOTERIC
              </Typography>
            </Box>
            
            {/* Right spacer to balance the layout */}
            <Box sx={{ width: '140px' }} />
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: 12, mb: 3, position: 'relative', zIndex: 1 }}>
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
              <Card sx={{ 
                mb: 3,
                background: 'rgba(31, 41, 55, 0.8)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(111, 92, 242, 0.3)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 30px 60px rgba(111, 92, 242, 0.2)'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, rgba(111, 92, 242, 0.8), transparent)',
                }
              }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 800, 
                        background: 'linear-gradient(135deg, #F9FAFB 0%, #8f7cf6 50%, #EC4899 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-0.02em'
                      }}
                    >
                      {profileData.firstName} {profileData.lastName}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, alignItems: 'start' }}>
                {/* Personal Information */}
                <Fade in={true} timeout={1200}>
                  <Card sx={{ 
                    height: 'fit-content',
                    background: 'rgba(31, 41, 55, 0.8)',
                    backdropFilter: 'blur(30px)',
                    border: '1px solid rgba(111, 92, 242, 0.3)',
                    borderRadius: '20px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 25px 50px rgba(111, 92, 242, 0.2)'
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent, rgba(111, 92, 242, 0.6), transparent)',
                    }
                  }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #6f5cf2, #6f5cf2)', 
                          borderRadius: '12px', 
                          p: 1.5, 
                          mr: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Person sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                          Personal Information
                        </Typography>
                      </Box>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Email color="primary" sx={{ mr: 2 }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Email Address
                          </Typography>
                          <Typography variant="h6" sx={{ 
                            fontFamily: 'monospace', 
                            fontWeight: 600,
                            color: 'primary.main'
                          }}>
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
                          <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
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
                          <Typography variant="h5" sx={{ fontWeight: 600, color: 'info.main' }}>
                            {formatDate(profileData.createdAt)}
                          </Typography>
                        </Box>
                      </Box>


                    </Box>
                    </CardContent>
                  </Card>
                </Fade>

                <Fade in={true} timeout={1400}>
                  <Card sx={{ 
                    height: '100%',
                    background: 'rgba(31, 41, 55, 0.8)',
                    backdropFilter: 'blur(30px)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '20px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 25px 50px rgba(16, 185, 129, 0.2)'
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.6), transparent)',
                    }
                  }}>
                    <CardContent sx={{ p: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                        <Box sx={{ 
                          background: 'linear-gradient(135deg, #10B981, #34D399)', 
                          borderRadius: '12px', 
                          p: 1.5, 
                          mr: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <AccountBalanceWallet sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                          Account Summary
                        </Typography>
                      </Box>
                    
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
                </Fade>
              </Box>

              <Fade in={true} timeout={1600}>
                <Card sx={{ 
                  mt: 3,
                  background: 'rgba(31, 41, 55, 0.8)',
                  backdropFilter: 'blur(30px)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '20px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 25px 50px rgba(245, 158, 11, 0.2)'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.6), transparent)',
                  }
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                      <Box sx={{ 
                        background: 'linear-gradient(135deg, #6f5cf2, #6f5cf2)', 
                        borderRadius: '12px', 
                        p: 1.5, 
                        mr: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Security sx={{ fontSize: 28, color: 'white' }} />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                        Security & Authentication
                      </Typography>
                    </Box>
                  
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, 
                    gap: 3 
                  }}>
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <Chip
                        icon={<Verified />}
                        label={profileData.accountVerified ? "Account Verified" : "Account Pending"}
                        color={profileData.accountVerified ? "success" : "warning"}
                        sx={{ mb: 2, fontWeight: 600 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {profileData.accountVerified 
                          ? "Your account has been verified"
                          : "Account verification is pending approval"
                        }
                      </Typography>
                      {!profileData.accountVerified && (
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={handleRequestAccountVerification}
                          disabled={verificationRequestLoading || verificationRequestSent}
                          startIcon={verificationRequestLoading ? <CircularProgress size={16} /> : <Verified />}
                          sx={{ 
                            background: 'linear-gradient(135deg, #6f5cf2 0%, #6f5cf2 100%)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #5a4cd8 0%, #7C2D92 100%)',
                            }
                          }}
                        >
                          {verificationRequestLoading 
                            ? 'Requesting...' 
                            : verificationRequestSent 
                            ? 'Request Sent' 
                            : 'Request Verification'
                          }
                        </Button>
                      )}
                    </Box>
                    
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <Chip
                        icon={<Security />}
                        label={twoFAStatus?.isEnabled ? "2FA Enabled" : "2FA Disabled"}
                        color={twoFAStatus?.isEnabled ? "success" : "warning"}
                        sx={{ mb: 2, fontWeight: 600 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Two-factor authentication status
                      </Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={twoFAStatus?.isEnabled ? () => setTwoFADialogOpen(true) : handleSetup2FA}
                        disabled={twoFALoading}
                        startIcon={twoFALoading ? <CircularProgress size={16} /> : <Security />}
                        sx={{ 
                          background: 'linear-gradient(135deg, #6f5cf2 0%, #6f5cf2 100%)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5a4cd8 0%, #7C2D92 100%)',
                          }
                        }}
                      >
                        {twoFAStatus?.isEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                      </Button>
                    </Box>
                    
                  </Box>
                  </CardContent>
                </Card>
              </Fade>
            </Box>
          </Fade>
        )}

        {/* 2FA Setup Dialog */}
        <Dialog 
          open={twoFADialogOpen} 
          onClose={() => {
            setTwoFADialogOpen(false);
            setTwoFAToken('');
            setTwoFAError(null);
            setTwoFASetupData(null);
          }} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: {
              background: 'rgba(31, 41, 55, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(111, 92, 242, 0.3)',
              borderRadius: '20px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            }
          }}
        >
          <DialogTitle sx={{ 
            background: 'linear-gradient(135deg, #6f5cf2 0%, #6f5cf2 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Security />
            {twoFAStatus?.isEnabled ? 'Disable Two-Factor Authentication' : 'Setup Two-Factor Authentication'}
          </DialogTitle>
          <DialogContent>
            {twoFAError && (
              <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                {twoFAError}
              </Alert>
            )}
            
            {!twoFAStatus?.isEnabled && twoFASetupData ? (
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Scan QR Code with your Authenticator App
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Use Google Authenticator, Authy, or any compatible TOTP app
                </Typography>
                
                {/* QR Code Display */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  mb: 3,
                  p: 3,
                  background: 'white',
                  borderRadius: '12px',
                  border: '2px solid #E5E7EB'
                }}>
                  <img 
                    src={twoFASetupData.qrCode} 
                    alt="2FA QR Code"
                    style={{ maxWidth: '200px', height: 'auto' }}
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Can't scan? Enter this key manually:
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    background: 'rgba(111, 92, 242, 0.1)',
                    p: 2,
                    borderRadius: '8px',
                    mb: 3,
                    wordBreak: 'break-all'
                  }}
                >
                  {twoFASetupData.manualEntryKey}
                </Typography>
                
                <TextField
                  label="Enter 6-digit code from your app"
                  value={twoFAToken}
                  onChange={(e) => setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  fullWidth
                  placeholder="123456"
                  inputProps={{ 
                    style: { textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.5em' },
                    maxLength: 6
                  }}
                  sx={{ mb: 2 }}
                />
              </Box>
            ) : twoFAStatus?.isEnabled ? (
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Disable Two-Factor Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Enter a verification code from your authenticator app to disable 2FA
                </Typography>
                
                <TextField
                  label="Enter 6-digit verification code"
                  value={twoFAToken}
                  onChange={(e) => setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  fullWidth
                  placeholder="123456"
                  inputProps={{ 
                    style: { textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.5em' },
                    maxLength: 6
                  }}
                  sx={{ mb: 2 }}
                />
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => {
                setTwoFADialogOpen(false);
                setTwoFAToken('');
                setTwoFAError(null);
                setTwoFASetupData(null);
              }}
              startIcon={<Cancel />}
            >
              Cancel
            </Button>
            <Button 
              onClick={twoFAStatus?.isEnabled ? handleDisable2FA : handleVerify2FA}
              variant="contained"
              disabled={twoFALoading || twoFAToken.length !== 6}
              startIcon={twoFALoading ? <CircularProgress size={16} /> : <Security />}
              color={twoFAStatus?.isEnabled ? "error" : "primary"}
              sx={!twoFAStatus?.isEnabled ? { 
                background: 'linear-gradient(135deg, #6f5cf2 0%, #6f5cf2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a4cd8 0%, #7C2D92 100%)',
                }
              } : undefined}
            >
              {twoFALoading ? 'Processing...' : (twoFAStatus?.isEnabled ? 'Disable 2FA' : 'Verify & Enable')}
            </Button>
          </DialogActions>
        </Dialog>


        {/* Edit Profile Dialog */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => setEditDialogOpen(false)} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: {
              background: 'rgba(31, 41, 55, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(111, 92, 242, 0.3)',
              borderRadius: '20px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            }
          }}
        >
          <DialogTitle sx={{ 
            background: 'linear-gradient(135deg, #6f5cf2 0%, #6f5cf2 100%)',
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
                background: 'linear-gradient(135deg, #6f5cf2 0%, #6f5cf2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a4cd8 0%, #7C2D92 100%)',
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