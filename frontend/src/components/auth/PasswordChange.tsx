import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock,
  CheckCircle,
  Error,
  Info
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

interface PasswordChangeProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

interface PasswordStrength {
  score: number;
  hasLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

const PasswordChange: React.FC<PasswordChangeProps> = ({ onSuccess, onCancel }) => {
  const { changePassword } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    hasLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false
  });

  const validatePasswordStrength = (password: string): PasswordStrength => {
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[@$!%*?&]/.test(password);

    const score = [hasLength, hasUppercase, hasLowercase, hasNumber, hasSpecial]
      .filter(Boolean).length;

    return {
      score,
      hasLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial
    };
  };

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);

    // Update password strength for new password
    if (field === 'newPassword') {
      setPasswordStrength(validatePasswordStrength(value));
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const getPasswordStrengthColor = (score: number) => {
    if (score < 2) return 'error';
    if (score < 4) return 'warning';
    return 'success';
  };

  const getPasswordStrengthText = (score: number) => {
    if (score < 2) return 'Weak';
    if (score < 4) return 'Medium';
    return 'Strong';
  };

  const isFormValid = () => {
    return (
      formData.currentPassword.trim() !== '' &&
      formData.newPassword.trim() !== '' &&
      formData.confirmPassword.trim() !== '' &&
      formData.newPassword === formData.confirmPassword &&
      passwordStrength.score === 5
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!isFormValid()) return;
    
    setLoading(true);
    setError(null);

    try {
      await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword
      });

      onSuccess();
    } catch (err: any) {
      console.error('Password change error:', err);
      if (err.response?.data?.errors) {
        setError(err.response.data.errors.map((e: any) => e.msg || e.message).join(', '));
      } else {
        setError(err.response?.data?.error || 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', mt: 4, p: 2 }}>
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={3}>
            <Lock sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h5" component="h1">
              Change Your Password
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              You are using a temporary password. Please create a secure new password to continue.
            </Typography>
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Current Temporary Password"
              type={showPasswords.current ? 'text' : 'password'}
              value={formData.currentPassword}
              onChange={handleInputChange('currentPassword')}
              margin="normal"
              required
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('current')}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <TextField
              fullWidth
              label="New Password"
              type={showPasswords.new ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={handleInputChange('newPassword')}
              margin="normal"
              required
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('new')}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {formData.newPassword && (
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Password Strength: {getPasswordStrengthText(passwordStrength.score)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(passwordStrength.score / 5) * 100}
                  color={getPasswordStrengthColor(passwordStrength.score)}
                  sx={{ mb: 2 }}
                />
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Password Requirements:
                </Typography>
                <List dense>
                  <ListItem disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {passwordStrength.hasLength ? 
                        <CheckCircle fontSize="small" color="success" /> : 
                        <Error fontSize="small" color="error" />}
                    </ListItemIcon>
                    <ListItemText 
                      primary="At least 8 characters"
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        color: passwordStrength.hasLength ? 'success.main' : 'error.main'
                      }}
                    />
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {passwordStrength.hasUppercase ? 
                        <CheckCircle fontSize="small" color="success" /> : 
                        <Error fontSize="small" color="error" />}
                    </ListItemIcon>
                    <ListItemText 
                      primary="One uppercase letter"
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        color: passwordStrength.hasUppercase ? 'success.main' : 'error.main'
                      }}
                    />
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {passwordStrength.hasLowercase ? 
                        <CheckCircle fontSize="small" color="success" /> : 
                        <Error fontSize="small" color="error" />}
                    </ListItemIcon>
                    <ListItemText 
                      primary="One lowercase letter"
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        color: passwordStrength.hasLowercase ? 'success.main' : 'error.main'
                      }}
                    />
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {passwordStrength.hasNumber ? 
                        <CheckCircle fontSize="small" color="success" /> : 
                        <Error fontSize="small" color="error" />}
                    </ListItemIcon>
                    <ListItemText 
                      primary="One number"
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        color: passwordStrength.hasNumber ? 'success.main' : 'error.main'
                      }}
                    />
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {passwordStrength.hasSpecial ? 
                        <CheckCircle fontSize="small" color="success" /> : 
                        <Error fontSize="small" color="error" />}
                    </ListItemIcon>
                    <ListItemText 
                      primary="One special character (@$!%*?&)"
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        color: passwordStrength.hasSpecial ? 'success.main' : 'error.main'
                      }}
                    />
                  </ListItem>
                </List>
              </Box>
            )}

            <TextField
              fullWidth
              label="Confirm New Password"
              type={showPasswords.confirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleInputChange('confirmPassword')}
              margin="normal"
              required
              disabled={loading}
              error={formData.confirmPassword !== '' && formData.newPassword !== formData.confirmPassword}
              helperText={
                formData.confirmPassword !== '' && formData.newPassword !== formData.confirmPassword
                  ? 'Passwords do not match'
                  : ''
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('confirm')}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {loading && <LinearProgress sx={{ mt: 2 }} />}

            <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={!isFormValid() || loading}
                size="large"
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </Button>
              
              {onCancel && (
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  disabled={loading}
                  size="large"
                >
                  Cancel
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PasswordChange;