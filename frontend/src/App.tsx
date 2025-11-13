import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme/theme';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/common/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import PasswordChangePage from './pages/PasswordChangePage';
import Dashboard from './pages/dashboard/Dashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import Profile from './pages/dashboard/Profile';

function App() {
  // Add global debug log viewer - accessible in console
  React.useEffect(() => {
    (window as any).viewDebugLog = () => {
      const logs = JSON.parse(localStorage.getItem('debugLog') || '[]');
      console.log('=== DEBUG LOG ===');
      logs.forEach((log: string) => console.log(log));
      console.log('=== END DEBUG LOG ===');
      return logs;
    };
    
    (window as any).clearDebugLog = () => {
      localStorage.removeItem('debugLog');
      console.log('Debug log cleared');
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Password Change Route - Special Protected Route */}
            <Route
              path="/change-password"
              element={
                <ProtectedRoute allowPasswordChange={true}>
                  <PasswordChangePage />
                </ProtectedRoute>
              }
            />
            
            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            
            {/* Catch all route - redirect to landing page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 