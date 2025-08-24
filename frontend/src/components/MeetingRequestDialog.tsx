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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { CalendarMonth, VideoCall, PersonOutline } from '@mui/icons-material';

interface MeetingRequestDialogProps {
  open: boolean;
  onClose: () => void;
  onRequestSubmitted?: () => void;
}

const MeetingRequestDialog: React.FC<MeetingRequestDialogProps> = ({
  open,
  onClose,
  onRequestSubmitted,
}) => {
  const [formData, setFormData] = useState({
    purpose: '',
    preferredDate: '',
    preferredTime: '',
    meetingType: 'video',
    urgency: 'normal',
    topics: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.purpose || !formData.preferredDate || !formData.preferredTime) {
      setError('Please fill in all required fields');
      return;
    }

    // No additional validation needed - only video meetings now

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      
      // Build request body - only video meetings now
      const requestBody = {
        purpose: formData.purpose,
        preferred_date: formData.preferredDate,
        preferred_time: formData.preferredTime,
        meeting_type: formData.meetingType, // Will always be 'video'
        urgency: formData.urgency,
        ...(formData.topics && { topics: formData.topics }),
        ...(formData.notes && { notes: formData.notes })
      };
      
      console.log('Sending request:', requestBody);
      console.log('Form data:', formData);
      
      const response = await fetch('http://localhost:5002/api/meeting-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit meeting request');
      }

      // Reset form and close dialog
      setFormData({
        purpose: '',
        preferredDate: '',
        preferredTime: '',
        meetingType: 'video',
        urgency: 'normal',
        topics: '',
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
        purpose: '',
        preferredDate: '',
        preferredTime: '',
        meetingType: 'video',
        urgency: 'normal',
        topics: '',
        notes: ''
      });
      setError(null);
      onClose();
    }
  };

  const meetingTypeOptions = [
    { value: 'video', label: 'Google Meet Video Call', icon: <VideoCall /> }
  ];

  const timeSlots = [
    { value: '09:00', label: '9:00 AM' },
    { value: '09:30', label: '9:30 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '10:30', label: '10:30 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '11:30', label: '11:30 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '12:30', label: '12:30 PM' },
    { value: '13:00', label: '1:00 PM' },
    { value: '13:30', label: '1:30 PM' },
    { value: '14:00', label: '2:00 PM' },
    { value: '14:30', label: '2:30 PM' },
    { value: '15:00', label: '3:00 PM' },
    { value: '15:30', label: '3:30 PM' },
    { value: '16:00', label: '4:00 PM' },
    { value: '16:30', label: '4:30 PM' },
    { value: '17:00', label: '5:00 PM' }
  ];

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
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
            background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', 
            borderRadius: '12px', 
            p: 1.5 
          }}>
            <CalendarMonth sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Schedule a Meeting
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Request a consultation with our team
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

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Meeting Purpose"
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                required
                fullWidth
                multiline
                rows={2}
                placeholder="e.g., Account review, Investment questions, Portfolio planning"
              />

              <TextField
                label="Preferred Date"
                type="date"
                value={formData.preferredDate}
                onChange={(e) => setFormData(prev => ({ ...prev, preferredDate: e.target.value }))}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: getMinDate()
                }}
              />

              <FormControl fullWidth required>
                <InputLabel>Preferred Time</InputLabel>
                <Select
                  value={formData.preferredTime}
                  label="Preferred Time"
                  onChange={(e) => setFormData(prev => ({ ...prev, preferredTime: e.target.value }))}
                >
                  {timeSlots.map((timeSlot) => (
                    <MenuItem key={timeSlot.value} value={timeSlot.value}>
                      {timeSlot.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Meeting Type</InputLabel>
                <Select
                  value={formData.meetingType}
                  label="Meeting Type"
                  onChange={(e) => setFormData(prev => ({ ...prev, meetingType: e.target.value }))}
                >
                  {meetingTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {option.icon}
                        {option.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Request Priority</InputLabel>
                <Select
                  value={formData.urgency}
                  label="Request Priority"
                  onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value }))}
                >
                  <MenuItem value="low">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Low</Typography>
                      <Typography variant="caption" color="text.secondary">Flexible scheduling</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="normal">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Normal</Typography>
                      <Typography variant="caption" color="text.secondary">Standard priority</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="high">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>High</Typography>
                      <Typography variant="caption" color="text.secondary">Priority scheduling</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="urgent">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Urgent</Typography>
                      <Typography variant="caption" color="text.secondary">ASAP scheduling</Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Discussion Topics"
                value={formData.topics}
                onChange={(e) => setFormData(prev => ({ ...prev, topics: e.target.value }))}
                fullWidth
                multiline
                rows={2}
                placeholder="Specific topics you'd like to discuss"
              />

              <TextField
                label="Additional Notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                fullWidth
                multiline
                rows={3}
                placeholder="Any special requirements or additional information"
              />
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
          <Button 
            onClick={handleClose} 
            variant="contained"
            disabled={loading}
            sx={{ 
              minWidth: 100,
              background: 'linear-gradient(135deg, #6B7280, #4B5563)',
              color: 'white',
              fontWeight: 'bold',
              '&:hover': {
                background: 'linear-gradient(135deg, #4B5563, #374151)',
                boxShadow: '0 6px 12px rgba(107, 114, 128, 0.4)',
              },
              boxShadow: '0 3px 8px rgba(107, 114, 128, 0.3)',
            }}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            variant="contained" 
            disabled={loading}
            sx={{ 
              minWidth: 150,
              background: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
              }
            }}
            startIcon={loading ? <CircularProgress size={16} /> : <CalendarMonth />}
          >
            {loading ? 'Submitting...' : 'Schedule Meeting'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default MeetingRequestDialog;