import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  Container,
  CircularProgress,
  Fade,
  Slide,
  IconButton,
  keyframes,
  styled,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LockOutlined, EmailOutlined, Visibility, VisibilityOff } from '@mui/icons-material';

// Styled components for enhanced animations
const FloatingOrb = styled(Box)(({ theme }) => ({
  position: 'absolute',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(107, 70, 193, 0.3), rgba(147, 51, 234, 0.3))',
  filter: 'blur(40px)',
  animation: `${keyframes`
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -30px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
  `} 8s ease-in-out infinite`,
}));

const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}));

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, complete2FALogin, isLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const result = await login(formData.email, formData.password);
      
      if (result.requires2FA) {
        // Show 2FA form
        setShow2FA(true);
        setSessionToken(result.sessionToken);
        setError('');
      } else {
        // Direct login success
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      await complete2FALogin(sessionToken, totpCode);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid 2FA code. Please try again.');
    }
  };

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 2,
      }}
    >
      {/* Floating Background Orbs */}
      <FloatingOrb
        sx={{
          width: 200,
          height: 200,
          top: '10%',
          left: '10%',
        }}
      />
      <FloatingOrb
        sx={{
          width: 300,
          height: 300,
          bottom: '10%',
          right: '10%',
          animationDelay: '-4s',
        }}
      />
      <FloatingOrb
        sx={{
          width: 150,
          height: 150,
          top: '60%',
          left: '80%',
          animationDelay: '-2s',
        }}
      />

      <Container maxWidth="sm">
        <Fade in={isVisible} timeout={1000}>
          <Card
            sx={{
              maxWidth: 480,
              mx: 'auto',
              backdropFilter: 'blur(30px)',
              background: 'rgba(31, 41, 55, 0.7)',
              border: '1px solid rgba(107, 70, 193, 0.3)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(107, 70, 193, 0.8), transparent)',
              },
            }}
          >
            <CardContent sx={{ p: 5 }}>
              {/* Logo and Title */}
              <Slide direction="down" in={isVisible} timeout={1200}>
                <Box textAlign="center" mb={5}>
                  <Box sx={{ mb: 3 }}>
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        mx: 'auto',
                        mb: 3,
                        background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 30px rgba(107, 70, 193, 0.4)',
                        animation: `${keyframes`
                          0%, 100% { transform: translateY(0); }
                          50% { transform: translateY(-5px); }
                        `} 3s ease-in-out infinite`,
                      }}
                    >
                      <LockOutlined sx={{ fontSize: 40, color: 'white' }} />
                    </Box>
                  </Box>
                  <GradientText variant="h3" sx={{ mb: 1 }}>
                    ESOTERIC
                  </GradientText>
                  <Typography 
                    variant="h6" 
                    color="text.secondary"
                    sx={{ fontWeight: 400, opacity: 0.8 }}
                  >
                    Venture Capital Management Platform
                  </Typography>
                </Box>
              </Slide>

              {/* Error Alert */}
              <Slide direction="up" in={!!error} timeout={500}>
                <Box>
                  {error && (
                    <Alert 
                      severity="error" 
                      sx={{ 
                        mb: 3,
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      {error}
                    </Alert>
                  )}
                </Box>
              </Slide>

              {/* Login Form */}
              <Slide direction="up" in={isVisible} timeout={1400}>
                <Box component="form" onSubmit={show2FA ? handle2FASubmit : handleSubmit} noValidate>
                  {show2FA ? (
                    /* 2FA Form */
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                        Two-Factor Authentication
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
                        Enter the 6-digit code from your authenticator app
                      </Typography>
                      <TextField
                        fullWidth
                        id="totpCode"
                        name="totpCode"
                        label="6-Digit Code"
                        type="text"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        autoComplete="one-time-code"
                        autoFocus
                        disabled={isLoading}
                        inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
                        InputProps={{
                          startAdornment: (
                            <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                            },
                          },
                        }}
                      />
                    </Box>
                  ) : (
                    /* Login Form */
                    <>
                      <Box sx={{ mb: 3 }}>
                        <TextField
                          fullWidth
                          id="email"
                          name="email"
                          label="Email Address"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          autoComplete="email"
                          autoFocus
                          disabled={isLoading}
                          InputProps={{
                            startAdornment: (
                              <EmailOutlined sx={{ mr: 1, color: 'text.secondary' }} />
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                              },
                            },
                          }}
                        />
                      </Box>
                  
                      <Box sx={{ mb: 4 }}>
                        <TextField
                          fullWidth
                          id="password"
                          name="password"
                          label="Password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={handleChange}
                          required
                          autoComplete="current-password"
                          disabled={isLoading}
                          InputProps={{
                            startAdornment: (
                              <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />
                            ),
                            endAdornment: (
                              <IconButton
                                aria-label="toggle password visibility"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                                size="small"
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                              },
                            },
                          }}
                        />
                      </Box>
                    </>
                  )}

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={{ 
                      py: 2, 
                      mb: 3,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                        transition: 'left 0.6s',
                      },
                      '&:hover::before': {
                        left: '100%',
                      },
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CircularProgress size={20} color="inherit" />
                        <Typography>Signing In...</Typography>
                      </Box>
                    ) : (
                      show2FA ? 'Verify 2FA Code' : 'Sign In to Dashboard'
                    )}
                  </Button>


                  {/* Links */}
                  <Box textAlign="center">
                    <Link
                      component={RouterLink}
                      to="/register"
                      variant="body2"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        fontWeight: 600,
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: 'rgba(107, 70, 193, 0.1)',
                        border: '1px solid rgba(107, 70, 193, 0.2)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          background: 'rgba(107, 70, 193, 0.2)',
                          transform: 'translateY(-2px)',
                          textDecoration: 'none',
                        },
                      }}
                    >
                      Don't have an account? Sign up
                    </Link>
                  </Box>
                </Box>
              </Slide>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    </Box>
  );
};

export default Login; 