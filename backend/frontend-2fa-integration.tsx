// Frontend 2FA Integration Components for React + TypeScript
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip
} from '@mui/material';
import {
  Security,
  QrCode,
  Backup,
  ContentCopy,
  Refresh,
  Close
} from '@mui/icons-material';

// Types
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

interface TwoFAStatus {
  enabled: boolean;
  setup_initiated: boolean;
  last_used: string | null;
  backup_codes_remaining: number;
}

interface AuthResponse {
  message: string;
  requires_2fa?: boolean;
  session_token?: string;
  token?: string;
  user?: User;
}

// 2FA Login Modal Component
export const TwoFALoginModal: React.FC<{
  open: boolean;
  sessionToken: string;
  onSuccess: (token: string, user: User) => void;
  onCancel: () => void;
}> = ({ open, sessionToken, onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Please enter your verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/complete-2fa-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_token: sessionToken,
          totp_token: code
        })
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.token, data.user);
        setCode('');
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Security color="primary" />
          Two-Factor Authentication
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Enter the 6-digit code from your authenticator app
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label={isBackupCode ? "Backup Code" : "Verification Code"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          autoFocus
          inputProps={{
            maxLength: isBackupCode ? 8 : 6,
            style: { 
              textAlign: 'center', 
              fontSize: '1.5rem',
              letterSpacing: '0.5rem'
            }
          }}
          sx={{ mb: 2 }}
        />

        <Box textAlign="center">
          <Button
            variant="text"
            size="small"
            onClick={() => setIsBackupCode(!isBackupCode)}
          >
            {isBackupCode ? 'Use Authenticator App' : 'Use Backup Code'}
          </Button>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit} 
          disabled={loading || !code.trim()}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 2FA Setup Component
export const TwoFASetup: React.FC<{
  token: string;
  onComplete: () => void;
}> = ({ token, onComplete }) => {
  const [step, setStep] = useState<'init' | 'qr' | 'verify' | 'backup'>('init');
  const [qrCode, setQrCode] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const initiate2FA = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setQrCode(data.qrCode);
        setManualKey(data.manualEntryKey);
        setStep('qr');
      } else {
        setError(data.error || 'Failed to setup 2FA');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/2fa/verify-setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: verificationCode })
      });

      const data = await response.json();

      if (response.ok) {
        setBackupCodes(data.backupCodes);
        setStep('backup');
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadBackupCodes = () => {
    const content = `Esoteric Enterprises - 2FA Backup Codes\n\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join('\n')}\n\nIMPORTANT:\n- Store these codes safely\n- Each code can only be used once\n- These codes can be used instead of your authenticator app\n- Generate new codes if you lose these`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'esoteric-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardContent>
        {step === 'init' && (
          <Box textAlign="center">
            <Security sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Enable Two-Factor Authentication
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Add an extra layer of security to your account
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Button
              variant="contained"
              size="large"
              onClick={initiate2FA}
              disabled={loading}
            >
              {loading ? 'Setting up...' : 'Get Started'}
            </Button>
          </Box>
        )}

        {step === 'qr' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Scan QR Code
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Use an authenticator app like Google Authenticator or Authy
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box textAlign="center" sx={{ mb: 2 }}>
                  <img 
                    src={qrCode} 
                    alt="2FA QR Code" 
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Manual Entry Key:
                </Typography>
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.100', 
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    mb: 2
                  }}
                >
                  {manualKey}
                  <IconButton 
                    size="small" 
                    onClick={() => copyToClipboard(manualKey)}
                    sx={{ ml: 1 }}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Box>

                <TextField
                  fullWidth
                  label="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  inputProps={{ maxLength: 6 }}
                  sx={{ mb: 2 }}
                />

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Button
                  variant="contained"
                  fullWidth
                  onClick={verify2FA}
                  disabled={loading || verificationCode.length !== 6}
                >
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}

        {step === 'backup' && (
          <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Save Your Backup Codes
              </Typography>
              <Typography variant="body2">
                Store these codes safely. Each can only be used once and will allow you to access your account if you lose your authenticator device.
              </Typography>
            </Alert>

            <Grid container spacing={1} sx={{ mb: 3 }}>
              {backupCodes.map((code, index) => (
                <Grid item xs={6} sm={4} key={index}>
                  <Chip
                    label={code}
                    variant="outlined"
                    sx={{ fontFamily: 'monospace', width: '100%' }}
                  />
                </Grid>
              ))}
            </Grid>

            <Box display="flex" gap={2} justifyContent="center">
              <Button
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={() => copyToClipboard(backupCodes.join('\n'))}
              >
                Copy Codes
              </Button>
              <Button
                variant="outlined"
                startIcon={<Backup />}
                onClick={downloadBackupCodes}
              >
                Download
              </Button>
              <Button
                variant="contained"
                onClick={onComplete}
              >
                I've Saved My Codes
              </Button>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// 2FA Management Component
export const TwoFAManagement: React.FC<{
  token: string;
}> = ({ token }) => {
  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/2fa/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch 2FA status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Typography>Loading 2FA status...</Typography>;
  }

  if (!status?.enabled && !showSetup) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">Two-Factor Authentication</Typography>
              <Typography color="text.secondary">
                Add an extra layer of security to your account
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowSetup(true)}
            >
              Enable 2FA
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (showSetup) {
    return (
      <TwoFASetup
        token={token}
        onComplete={() => {
          setShowSetup(false);
          fetchStatus();
        }}
      />
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">Two-Factor Authentication</Typography>
          <Chip 
            label="Enabled" 
            color="success" 
            icon={<Security />}
          />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Last Used: {status?.last_used ? new Date(status.last_used).toLocaleDateString() : 'Never'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Backup Codes: {status?.backup_codes_remaining} remaining
            </Typography>
          </Grid>
        </Grid>

        <Box mt={2} display="flex" gap={1}>
          <Button variant="outlined" size="small">
            Generate New Backup Codes
          </Button>
          <Button variant="outlined" size="small" color="error">
            Disable 2FA
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

// Hook for 2FA-enhanced authentication
export const useAuth2FA = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [sessionToken, setSessionToken] = useState('');

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data: AuthResponse = await response.json();

      if (response.ok) {
        if (data.requires_2fa && data.session_token) {
          setSessionToken(data.session_token);
          setShow2FAModal(true);
          return false; // 2FA required
        } else if (data.token && data.user) {
          localStorage.setItem('token', data.token);
          setUser(data.user);
          return true; // Login complete
        }
      }
      
      throw new Error(data.message || 'Login failed');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const complete2FA = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setUser(userData);
    setShow2FAModal(false);
    setSessionToken('');
  };

  const cancel2FA = () => {
    setShow2FAModal(false);
    setSessionToken('');
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  return {
    user,
    loading,
    login,
    logout,
    show2FAModal,
    sessionToken,
    complete2FA,
    cancel2FA
  };
};