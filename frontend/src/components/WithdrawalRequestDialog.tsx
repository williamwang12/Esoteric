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
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { AttachMoney, AccountBalanceWallet } from '@mui/icons-material';

interface WithdrawalRequestDialogProps {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
  onRequestSubmitted?: () => void;
}

const WithdrawalRequestDialog: React.FC<WithdrawalRequestDialogProps> = ({
  open,
  onClose,
  currentBalance,
  onRequestSubmitted,
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    reason: '',
    urgency: 'normal',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.reason) {
      setError('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (amount > currentBalance) {
      setError('Withdrawal amount cannot exceed current balance');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      
      const requestBody: {
        amount: number;
        reason: string;
        urgency: string;
        notes?: string;
      } = {
        amount: amount,
        reason: formData.reason,
        urgency: formData.urgency
      };
      
      // Only include notes if it's not empty
      if (formData.notes && formData.notes.trim()) {
        requestBody.notes = formData.notes.trim();
      }
      
      const response = await fetch('http://localhost:5002/api/withdrawal-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || errorData.errors?.[0]?.msg || 'Failed to submit withdrawal request');
      }

      // Reset form and close dialog
      setFormData({
        amount: '',
        reason: '',
        urgency: 'normal',
        notes: ''
      });
      
      if (onRequestSubmitted) {
        onRequestSubmitted();
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        amount: '',
        reason: '',
        urgency: 'normal',
        notes: ''
      });
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1f2937',
          border: '1px solid',
          borderColor: 'primary.main',
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ 
            background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', 
            borderRadius: '12px', 
            p: 1.5 
          }}>
            <AccountBalanceWallet sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Withdrawal Request
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Current Balance: ${currentBalance.toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Withdrawal Amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              required
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AttachMoney />
                  </InputAdornment>
                ),
              }}
              inputProps={{
                min: 0,
                max: currentBalance,
                step: 0.01
              }}
            />

            <TextField
              label="Reason for Withdrawal"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              required
              fullWidth
              multiline
              rows={2}
              placeholder="e.g., Emergency expenses, Investment opportunity, Personal use"
            />

            <FormControl fullWidth>
              <InputLabel>Request Priority</InputLabel>
              <Select
                value={formData.urgency}
                label="Request Priority"
                onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value }))}
              >
                <MenuItem value="low">Low - Standard processing (5-7 business days)</MenuItem>
                <MenuItem value="normal">Normal - Regular processing (3-5 business days)</MenuItem>
                <MenuItem value="high">High - Priority processing (1-3 business days)</MenuItem>
                <MenuItem value="urgent">Urgent - Emergency processing (24-48 hours)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Additional Notes (Optional)"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              placeholder="Any additional information or special instructions"
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
          <Button 
            onClick={handleClose} 
            variant="outlined"
            disabled={loading}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            variant="contained" 
            disabled={loading}
            sx={{ 
              minWidth: 150,
              background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
              '&:hover': {
                background: 'linear-gradient(135deg, #D97706, #F59E0B)',
              }
            }}
            startIcon={loading ? <CircularProgress size={16} /> : <AccountBalanceWallet />}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default WithdrawalRequestDialog;