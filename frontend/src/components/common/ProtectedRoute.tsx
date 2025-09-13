import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user, token } = useAuth();
  const location = useLocation();

  const debugInfo = {
    path: location.pathname,
    isLoading,
    isAuthenticated,
    hasUser: !!user,
    hasToken: !!token,
    userFromLS: !!localStorage.getItem('user'),
    tokenFromLS: !!localStorage.getItem('authToken')
  };

  console.log('[PROTECTED_ROUTE] Render check:', debugInfo);
  
  // Save to persistent debug log
  const debugLog = JSON.parse(localStorage.getItem('debugLog') || '[]');
  debugLog.push(`[${new Date().toISOString()}] [PROTECTED_ROUTE] ${location.pathname} - loading:${isLoading}, auth:${isAuthenticated}, user:${!!user}, token:${!!token}`);
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

  console.log('[PROTECTED_ROUTE] Authenticated, rendering protected content');
  return <>{children}</>;
};

export default ProtectedRoute; 