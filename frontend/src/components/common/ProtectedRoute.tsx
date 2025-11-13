import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowPasswordChange?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowPasswordChange = false }) => {
  const { isAuthenticated, isLoading, user, token, requiresPasswordChange } = useAuth();
  const location = useLocation();

  const debugInfo = {
    path: location.pathname,
    isLoading,
    isAuthenticated,
    hasUser: !!user,
    hasToken: !!token,
    requiresPasswordChange,
    allowPasswordChange,
    userFromLS: !!localStorage.getItem('user'),
    tokenFromLS: !!localStorage.getItem('authToken')
  };

  console.log('[PROTECTED_ROUTE] Render check:', debugInfo);
  
  // Save to persistent debug log
  const debugLog = JSON.parse(localStorage.getItem('debugLog') || '[]');
  debugLog.push(`[${new Date().toISOString()}] [PROTECTED_ROUTE] ${location.pathname} - loading:${isLoading}, auth:${isAuthenticated}, user:${!!user}, token:${!!token}, pwdChange:${requiresPasswordChange}`);
  localStorage.setItem('debugLog', JSON.stringify(debugLog));

  if (isLoading) {
    console.log('[PROTECTED_ROUTE] Showing loading state');
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    console.log('[PROTECTED_ROUTE] Not authenticated, redirecting to login');
    debugLog.push(`[${new Date().toISOString()}] [PROTECTED_ROUTE] REDIRECT TO LOGIN - path:${location.pathname}`);
    localStorage.setItem('debugLog', JSON.stringify(debugLog));
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If password change is required and this route doesn't allow it,
  // redirect to password change page
  if (requiresPasswordChange && !allowPasswordChange && location.pathname !== '/change-password') {
    console.log('[PROTECTED_ROUTE] Password change required, redirecting to change-password');
    debugLog.push(`[${new Date().toISOString()}] [PROTECTED_ROUTE] REDIRECT TO PASSWORD CHANGE - path:${location.pathname}`);
    localStorage.setItem('debugLog', JSON.stringify(debugLog));
    return <Navigate to="/change-password" replace />;
  }

  // If no password change required but user is on password change page,
  // redirect to dashboard
  if (!requiresPasswordChange && location.pathname === '/change-password') {
    console.log('[PROTECTED_ROUTE] Password change not required, redirecting to dashboard');
    debugLog.push(`[${new Date().toISOString()}] [PROTECTED_ROUTE] REDIRECT TO DASHBOARD - password change not required`);
    localStorage.setItem('debugLog', JSON.stringify(debugLog));
    return <Navigate to="/dashboard" replace />;
  }

  console.log('[PROTECTED_ROUTE] Authenticated, rendering protected content');
  return <>{children}</>;
};

export default ProtectedRoute; 