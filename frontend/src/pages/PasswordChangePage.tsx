import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PasswordChange from '../components/auth/PasswordChange';
import { Alert, Container, Typography } from '@mui/material';

const PasswordChangePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, requiresPasswordChange } = useAuth();

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  // Redirect if no password change required
  if (!requiresPasswordChange) {
    navigate('/dashboard');
    return null;
  }

  const handlePasswordChangeSuccess = () => {
    // Navigate to dashboard after successful password change
    navigate('/dashboard');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Password Change Required
        </Typography>
        <Typography variant="body2">
          Your account is using a temporary password. You must change it to a secure password before you can continue using the application.
        </Typography>
      </Alert>
      
      <PasswordChange onSuccess={handlePasswordChangeSuccess} />
    </Container>
  );
};

export default PasswordChangePage;