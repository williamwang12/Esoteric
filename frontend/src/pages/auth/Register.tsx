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
  InputAdornment,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  PersonOutlined,
  EmailOutlined,
  LockOutlined,
  PhoneOutlined,
  Visibility,
  VisibilityOff,
  ArrowBack,
} from '@mui/icons-material';

const FloatingOrb = styled(Box)(({ theme }) => ({
  position: 'absolute',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(107, 70, 193, 0.2), rgba(147, 51, 234, 0.2))',
  filter: 'blur(60px)',
  animation: `${keyframes`
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
    33% { transform: translate(30px, -30px) scale(1.1); opacity: 0.6; }
    66% { transform: translate(-20px, 20px) scale(0.9); opacity: 1; }
  `} 10s ease-in-out infinite`,
}));

const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(135deg, #F9FAFB 0%, #A855F7 50%, #EC4899 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}));

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Background Orbs */}
      <FloatingOrb sx={{ width: 300, height: 300, top: '10%', left: '5%' }} />
      <FloatingOrb sx={{ width: 200, height: 200, top: '70%', right: '10%', animationDelay: '-3s' }} />
      <FloatingOrb sx={{ width: 150, height: 150, bottom: '10%', left: '20%', animationDelay: '-1s' }} />

      {/* Navigation */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'rgba(31, 41, 55, 0.95)',
          backdropFilter: 'blur(30px)',
          borderBottom: '1px solid rgba(107, 70, 193, 0.2)',
          zIndex: 1000,
          py: 2.5,
          '&::before': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(107, 70, 193, 0.8), transparent)',
          }
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <GradientText variant="h4" sx={{ fontWeight: 800 }}>
              ESOTERIC
            </GradientText>
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <IconButton
                component={RouterLink}
                to="/"
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  '&:hover': { 
                    color: '#A855F7',
                    transform: 'scale(1.1)'
                  } 
                }}
              >
                <ArrowBack />
              </IconButton>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                sx={{
                  background: 'rgba(55, 65, 81, 0.6)',
                  backdropFilter: 'blur(10px)',
                  color: 'transparent',
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  letterSpacing: '-0.02em',
                  px: 4,
                  py: 1.5,
                  borderRadius: '12px',
                  borderColor: 'rgba(107, 70, 193, 0.3)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    background: 'rgba(75, 85, 99, 0.8)',
                    borderColor: 'rgba(107, 70, 193, 0.6)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(107, 70, 193, 0.3)',
                  },
                }}
              >
                <Box
                  sx={{
                    background: 'linear-gradient(135deg, #F9FAFB 0%, #A855F7 50%, #EC4899 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Sign In
                </Box>
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pt: 12,
          pb: 4,
          px: 2,
        }}
      >
        <Container maxWidth="md">
          <Fade in={isVisible} timeout={1000}>
            <Card
              sx={{
                maxWidth: 600,
                mx: 'auto',
                backdropFilter: 'blur(30px)',
                background: 'rgba(31, 41, 55, 0.8)',
                border: '1px solid rgba(107, 70, 193, 0.3)',
                borderRadius: '24px',
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
                {/* Header */}
                <Slide direction="down" in={isVisible} timeout={1200}>
                  <Box textAlign="center" mb={4}>
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
                      <PersonOutlined sx={{ fontSize: 40, color: 'white' }} />
                    </Box>
                    <GradientText variant="h3" sx={{ mb: 1 }}>
                      Join Esoteric
                    </GradientText>
                    <Typography 
                      variant="h6" 
                      color="text.secondary"
                      sx={{ fontWeight: 400, opacity: 0.8 }}
                    >
                      Create your account and start your investment journey
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

                {/* Registration Form */}
                <Slide direction="up" in={isVisible} timeout={1400}>
                  <Box component="form" onSubmit={handleSubmit} noValidate>
                    {/* Name Fields */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3, mb: 3 }}>
                      <TextField
                        fullWidth
                        id="firstName"
                        name="firstName"
                        label="First Name"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        autoComplete="given-name"
                        disabled={isLoading}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonOutlined sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
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
                      <TextField
                        fullWidth
                        id="lastName"
                        name="lastName"
                        label="Last Name"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        autoComplete="family-name"
                        disabled={isLoading}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonOutlined sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
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
                      disabled={isLoading}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailOutlined sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                          },
                        },
                      }}
                    />

                    <TextField
                      fullWidth
                      id="phone"
                      name="phone"
                      label="Phone Number (Optional)"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      autoComplete="tel"
                      disabled={isLoading}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneOutlined sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                          },
                        },
                      }}
                    />

                    {/* Password Fields */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3, mb: 4 }}>
                      <TextField
                        fullWidth
                        id="password"
                        name="password"
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        helperText="Minimum 8 characters"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockOutlined sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                                size="small"
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
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
                      <TextField
                        fullWidth
                        id="confirmPassword"
                        name="confirmPassword"
                        label="Confirm Password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockOutlined sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                edge="end"
                                size="small"
                              >
                                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
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
                          <Typography>Creating Account...</Typography>
                        </Box>
                      ) : (
                        'Create Your Account'
                      )}
                    </Button>

                    {/* Links */}
                    <Box textAlign="center">
                      <Link
                        component={RouterLink}
                        to="/login"
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
                        Already have an account? Sign in
                      </Link>
                    </Box>
                  </Box>
                </Slide>
              </CardContent>
            </Card>
          </Fade>
        </Container>
      </Box>
    </Box>
  );
};

export default Register;