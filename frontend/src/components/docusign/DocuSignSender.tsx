import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Description as DocumentIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { docuSignApi } from '../../services/api';

interface DocuSignSenderProps {
  open: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    category: string;
  };
  onEnvelopeSent?: (envelopeId: string) => void;
}

const DocuSignSender: React.FC<DocuSignSenderProps> = ({
  open,
  onClose,
  document,
  onEnvelopeSent,
}) => {
  const [formData, setFormData] = useState({
    signerName: '',
    signerEmail: '',
    subject: `Please sign: ${document.title}`,
    message: 'Please review and sign this document.',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Signer Details', 'Document Review', 'Send for Signature'];

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setError(null);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return formData.signerName.trim() !== '' && 
               formData.signerEmail.trim() !== '' && 
               /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.signerEmail);
      case 1:
        return formData.subject.trim() !== '';
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    } else {
      setError('Please fill in all required fields correctly');
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError(null);
  };

  const handleSendForSignature = async () => {
    try {
      setLoading(true);
      setError(null);

      // Here you would typically fetch the document content as base64
      // For this example, we'll create a placeholder base64 PDF
      const documentBase64 = 'JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL0xlbmd0aCA0IDAKL0ZpbHRlciBbL0ZsYXRlRGVjb2RlXQo+PgpzdHJlYW0KeJxLy8wpTVWyUvJIzcnJVypJLS4B8S1NjLTtFKyNDHQNdAx0zHQM9Qz19A0NDQw1DE0sTAw0TE3NzIw1jAwMTQwsDAwNDQyNLQz1DEy1rJKT8otyUnNTSzKTSxSSUosz8osUUvLzc1OLUouPyE5QKC0oyVzVFNyhNCS5VUhKyk5VUkpOzsFTzEjNydHQSc7IzMvLTMvLzE4FagmpGI=';

      const envelopeData = {
        documentBase64,
        documentName: document.title,
        signerEmail: formData.signerEmail,
        signerName: formData.signerName,
        subject: formData.subject,
      };

      const result = await docuSignApi.createEnvelope(envelopeData);

      setSuccess(`Document sent successfully! Envelope ID: ${result.envelopeId}`);
      
      if (onEnvelopeSent) {
        onEnvelopeSent(result.envelopeId);
      }

      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (error: any) {
      console.error('DocuSign send error:', error);
      setError(error.response?.data?.error || 'Failed to send document for signature');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      signerName: '',
      signerEmail: '',
      subject: `Please sign: ${document.title}`,
      message: 'Please review and sign this document.',
    });
    setActiveStep(0);
    setError(null);
    setSuccess(null);
    onClose();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Signer Name"
              value={formData.signerName}
              onChange={handleInputChange('signerName')}
              required
              fullWidth
              placeholder="Enter the full name of the person who will sign"
              InputProps={{
                startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
            <TextField
              label="Signer Email"
              type="email"
              value={formData.signerEmail}
              onChange={handleInputChange('signerEmail')}
              required
              fullWidth
              placeholder="Enter the email address of the signer"
              InputProps={{
                startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <DocumentIcon color="primary" />
                  <Typography variant="h6">{document.title}</Typography>
                  <Chip label={document.category} size="small" color="primary" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  This document will be sent to <strong>{formData.signerName}</strong> at{' '}
                  <strong>{formData.signerEmail}</strong> for digital signature.
                </Typography>
              </CardContent>
            </Card>

            <TextField
              label="Email Subject"
              value={formData.subject}
              onChange={handleInputChange('subject')}
              required
              fullWidth
              placeholder="Enter the email subject line"
            />

            <TextField
              label="Message to Signer"
              value={formData.message}
              onChange={handleInputChange('message')}
              fullWidth
              multiline
              rows={3}
              placeholder="Optional message to include in the signing email"
            />
          </Box>
        );

      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {success ? (
              <Box>
                <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" color="success.main" gutterBottom>
                  Document Sent Successfully!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.signerName} will receive an email with signing instructions.
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Ready to Send
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Review the details and click "Send for Signature" to proceed.
                </Typography>
                
                <Card variant="outlined" sx={{ textAlign: 'left', mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Summary:</Typography>
                    <Typography variant="body2"><strong>Document:</strong> {document.title}</Typography>
                    <Typography variant="body2"><strong>Signer:</strong> {formData.signerName}</Typography>
                    <Typography variant="body2"><strong>Email:</strong> {formData.signerEmail}</Typography>
                    <Typography variant="body2"><strong>Subject:</strong> {formData.subject}</Typography>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            background: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
            borderRadius: '12px',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <SendIcon sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Send for Digital Signature
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
        <Button 
          onClick={handleClose} 
          variant="outlined"
          disabled={loading}
        >
          Cancel
        </Button>
        
        {activeStep > 0 && !success && (
          <Button 
            onClick={handleBack}
            variant="outlined"
            disabled={loading}
          >
            Back
          </Button>
        )}
        
        {activeStep < steps.length - 1 ? (
          <Button 
            onClick={handleNext}
            variant="contained"
            disabled={!validateStep(activeStep)}
          >
            Next
          </Button>
        ) : !success ? (
          <Button 
            onClick={handleSendForSignature}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {loading ? 'Sending...' : 'Send for Signature'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};

export default DocuSignSender;