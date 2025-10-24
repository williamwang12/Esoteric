import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Avatar,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  GetApp as DownloadIcon,
} from '@mui/icons-material';
import { docuSignApi } from '../../services/api';

interface DocuSignStatusProps {
  open: boolean;
  onClose: () => void;
  envelopeId: string;
  documentTitle?: string;
}

interface EnvelopeStatus {
  envelopeId: string;
  status: string;
  statusDateTime: string;
  subject: string;
  recipients: Array<{
    email: string;
    name: string;
    status: string;
    signedDateTime?: string;
  }>;
}

const DocuSignStatus: React.FC<DocuSignStatusProps> = ({
  open,
  onClose,
  envelopeId,
  documentTitle,
}) => {
  const [envelopeStatus, setEnvelopeStatus] = useState<EnvelopeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchEnvelopeStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const status = await docuSignApi.getEnvelopeStatus(envelopeId);
      setEnvelopeStatus(status);
    } catch (error: any) {
      console.error('Failed to fetch envelope status:', error);
      setError(error.response?.data?.error || 'Failed to fetch envelope status');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async () => {
    try {
      setDownloading(true);
      
      const blob = await docuSignApi.downloadSignedDocument(envelopeId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `signed-${documentTitle || 'document'}-${envelopeId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to download document:', error);
      setError(error.response?.data?.error || 'Failed to download document');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (open && envelopeId) {
      fetchEnvelopeStatus();
    }
  }, [open, envelopeId]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'sent':
      case 'delivered':
        return 'warning';
      case 'declined':
      case 'voided':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckIcon />;
      case 'sent':
      case 'delivered':
        return <ScheduleIcon />;
      case 'declined':
      case 'voided':
        return <CancelIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getCompletionPercentage = () => {
    if (!envelopeStatus?.recipients) return 0;
    
    const completed = envelopeStatus.recipients.filter(
      recipient => recipient.status.toLowerCase() === 'completed'
    ).length;
    
    return (completed / envelopeStatus.recipients.length) * 100;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '20px',
        }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              background: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
              borderRadius: '12px',
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DocumentIcon sx={{ fontSize: 24, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Signature Status
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Envelope ID: {envelopeId}
              </Typography>
            </Box>
          </Box>
          
          <IconButton 
            onClick={fetchEnvelopeStatus} 
            disabled={loading}
            sx={{ color: 'primary.main' }}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading && !envelopeStatus ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : envelopeStatus ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Envelope Status Card */}
            <Card sx={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(96, 165, 250, 0.05) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '16px',
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {envelopeStatus.subject}
                    </Typography>
                  </Box>
                  
                  <Chip
                    icon={getStatusIcon(envelopeStatus.status)}
                    label={envelopeStatus.status.toUpperCase()}
                    color={getStatusColor(envelopeStatus.status) as any}
                    sx={{ fontWeight: 600 }}
                  />
                </Box>

                {/* Progress Bar */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Completion Progress</Typography>
                    <Typography variant="body2">
                      {Math.round(getCompletionPercentage())}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={getCompletionPercentage()}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                {/* Download Button */}
                {envelopeStatus.status.toLowerCase() === 'completed' && (
                  <Button
                    variant="contained"
                    startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
                    onClick={handleDownloadDocument}
                    disabled={downloading}
                    sx={{
                      background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
                      }
                    }}
                  >
                    {downloading ? 'Downloading...' : 'Download Signed Document'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Recipients Status */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Signers ({envelopeStatus.recipients.length})
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {envelopeStatus.recipients.map((recipient, index) => (
                    <Card key={index} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {recipient.name.charAt(0).toUpperCase()}
                        </Avatar>
                        
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {recipient.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {recipient.email}
                            </Typography>
                          </Box>
                          {recipient.signedDateTime && (
                            <Typography variant="caption" color="text.secondary">
                              Signed: {formatDateTime(recipient.signedDateTime)}
                            </Typography>
                          )}
                        </Box>
                        
                        <Chip
                          icon={getStatusIcon(recipient.status)}
                          label={recipient.status.charAt(0).toUpperCase() + recipient.status.slice(1)}
                          color={getStatusColor(recipient.status) as any}
                          size="small"
                        />
                      </Box>
                    </Card>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocuSignStatus;