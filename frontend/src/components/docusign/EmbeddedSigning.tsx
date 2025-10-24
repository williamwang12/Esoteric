import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Description,
  Launch,
  CheckCircle,
  Error as ErrorIcon,
  Close,
} from '@mui/icons-material';
import { docuSignApi } from '../../services/api';

interface EmbeddedSigningProps {
  open: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    docusign_envelope_id?: string;
  };
  onSigningComplete?: (envelopeId: string) => void;
}

const EmbeddedSigning: React.FC<EmbeddedSigningProps> = ({
  open,
  onClose,
  document,
  onSigningComplete,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'ready' | 'creating' | 'signing' | 'completed' | 'error'>('ready');
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);

  const handleStartSigning = async () => {
    try {
      setLoading(true);
      setError(null);
      setStatus('creating');

      let url: string;

      if (document.docusign_envelope_id) {
        // Get signing URL for existing envelope
        const response = await docuSignApi.getSigningUrl(document.docusign_envelope_id);
        url = response.signingUrl;
        setEnvelopeId(document.docusign_envelope_id);
      } else {
        // Create new embedded envelope
        const response = await docuSignApi.createEmbeddedEnvelope(document.id, document.title);
        url = response.signingUrl;
        setEnvelopeId(response.envelopeId);
      }

      setSigningUrl(url);
      setStatus('signing');

    } catch (error: any) {
      console.error('Failed to create signing session:', error);
      setError(error.response?.data?.details || error.message || 'Failed to create signing session');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSigningWindow = () => {
    if (signingUrl) {
      // Open signing URL in new window
      const signingWindow = window.open(
        signingUrl,
        'docusign-signing',
        'width=1024,height=768,scrollbars=yes,resizable=yes'
      );

      // Close the dialog immediately after opening the signing window
      onClose();
      
      // Call the onSigningComplete callback immediately to refresh status
      if (onSigningComplete && envelopeId) {
        onSigningComplete(envelopeId);
      }

      // Still monitor the window for actual completion (for logging purposes)
      const pollTimer = setInterval(() => {
        if (signingWindow?.closed) {
          clearInterval(pollTimer);
          console.log('Signing window closed - document signing likely completed');
          
          // Trigger another status refresh when the window actually closes
          if (onSigningComplete && envelopeId) {
            console.log('Triggering additional status refresh after window closure');
            onSigningComplete(envelopeId);
          }
        }
      }, 1000);
    }
  };

  const handleReset = () => {
    setStatus('ready');
    setSigningUrl(null);
    setError(null);
    setLoading(false);
    setEnvelopeId(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
        }
      }}
    >
      <DialogTitle sx={{ pb: 2, position: 'relative' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Description sx={{ fontSize: 24, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                Sign Document
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {document.title}
              </Typography>
            </Box>
          </Box>
          <Button
            onClick={handleClose}
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <Close />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Progress Indicator */}
          <Paper sx={{ 
            p: 2, 
            background: alpha(theme.palette.primary.main, 0.05),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Signing Progress
              </Typography>
              {status === 'completed' && (
                <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
              )}
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={
                status === 'ready' ? 0 :
                status === 'creating' ? 25 :
                status === 'signing' ? 75 :
                status === 'completed' ? 100 : 0
              }
              sx={{ 
                height: 8, 
                borderRadius: 4,
                mb: 1,
                '& .MuiLinearProgress-bar': {
                  background: status === 'error' ? theme.palette.error.main :
                    `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                }
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {status === 'ready' && 'Ready to start signing process'}
              {status === 'creating' && 'Preparing document for signing...'}
              {status === 'signing' && 'Document ready - complete signing in the popup window'}
              {status === 'completed' && 'Document signed successfully!'}
              {status === 'error' && 'Error occurred during signing process'}
            </Typography>
          </Paper>

          {/* Error Display */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ borderRadius: 2 }}
              action={
                <Button size="small" onClick={handleReset}>
                  Try Again
                </Button>
              }
            >
              <Typography variant="body2">
                <strong>Signing Error:</strong> {error}
              </Typography>
            </Alert>
          )}

          {/* Main Content */}
          {status === 'ready' && (
            <Paper sx={{ 
              p: 4, 
              textAlign: 'center',
              background: alpha(theme.palette.background.paper, 0.5),
              border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`
            }}>
              <Description sx={{ fontSize: 64, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Ready to Sign
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                Click the button below to prepare your document for signing. The signing interface will open in a new window where you can complete your digital signature.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleStartSigning}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <Launch />}
                sx={{
                  px: 4,
                  py: 1.5,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                  }
                }}
              >
                {loading ? 'Preparing Document...' : 'Start Signing Process'}
              </Button>
            </Paper>
          )}

          {status === 'creating' && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={64} sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Preparing Document
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Setting up your document for digital signing...
              </Typography>
            </Paper>
          )}

          {status === 'signing' && signingUrl && (
            <Paper sx={{ 
              p: 4, 
              textAlign: 'center',
              background: alpha(theme.palette.success.main, 0.05),
              border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
            }}>
              <Launch sx={{ fontSize: 64, color: theme.palette.success.main, mb: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ color: 'success.main', fontWeight: 600 }}>
                Document Ready for Signing
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Your document is ready! Click below to open the signing interface in a new window.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleOpenSigningWindow}
                startIcon={<Launch />}
                sx={{
                  px: 4,
                  py: 1.5,
                  background: theme.palette.success.main,
                  '&:hover': {
                    background: theme.palette.success.dark,
                  }
                }}
              >
                Open Signing Window
              </Button>
              <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
                A popup window will open with your document. Complete the signing process there.
              </Typography>
            </Paper>
          )}

          {status === 'completed' && (
            <Paper sx={{ 
              p: 4, 
              textAlign: 'center',
              background: alpha(theme.palette.success.main, 0.05),
              border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
            }}>
              <CheckCircle sx={{ fontSize: 64, color: theme.palette.success.main, mb: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ color: 'success.main', fontWeight: 600 }}>
                Document Signed Successfully!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Your document has been signed and submitted. You can now download the completed document from your document center.
              </Typography>
            </Paper>
          )}

          {status === 'error' && (
            <Paper sx={{ 
              p: 4, 
              textAlign: 'center',
              background: alpha(theme.palette.error.main, 0.05),
              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`
            }}>
              <ErrorIcon sx={{ fontSize: 64, color: theme.palette.error.main, mb: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ color: 'error.main', fontWeight: 600 }}>
                Signing Failed
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                There was an issue preparing your document for signing. Please try again.
              </Typography>
              <Button
                variant="contained"
                onClick={handleReset}
                sx={{ mr: 2 }}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                onClick={handleClose}
              >
                Cancel
              </Button>
            </Paper>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default EmbeddedSigning;