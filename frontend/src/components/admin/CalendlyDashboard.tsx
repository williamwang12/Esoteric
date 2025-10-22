import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  VideoCall as VideoCallIcon
} from '@mui/icons-material';
import { calendlyApi } from '../../services/api';

interface CalendlyUser {
  name: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  avatar_url?: string;
}

interface EventType {
  uri: string;
  name: string;
  duration: number;
  scheduling_url: string;
  active: boolean;
  color: string;
  locations: Array<{ kind: string }>;
}

interface ScheduledEvent {
  uri: string;
  name: string;
  start_time: string;
  end_time: string;
  status: string;
  event_type: string;
  location?: {
    type: string;
    join_url?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
  };
}

interface Invitee {
  email: string;
  name: string;
  status: string;
  created_at: string;
  questions_and_answers?: Array<{
    question: string;
    answer: string;
  }>;
}

const CalendlyDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
    user: CalendlyUser | null;
    eventTypes: EventType[];
    recentEvents: ScheduledEvent[];
  }>({
    user: null,
    eventTypes: [],
    recentEvents: []
  });
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Event details dialog
  const [selectedEvent, setSelectedEvent] = useState<ScheduledEvent | null>(null);
  const [eventDetails, setEventDetails] = useState<{
    event: ScheduledEvent;
    invitees: Invitee[];
  } | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [loadingEventDetails, setLoadingEventDetails] = useState(false);
  
  // Cancel event dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  // Filter state
  const [eventsFilter, setEventsFilter] = useState<{
    status: string;
    count: number;
  }>({
    status: '',
    count: 20
  });

  useEffect(() => {
    fetchDashboardData();
  }, [eventsFilter]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await calendlyApi.getDashboard();
      setDashboardData({
        user: data.user,
        eventTypes: data.eventTypes,
        recentEvents: data.recentEvents
      });
    } catch (error: any) {
      console.error('Error fetching Calendly dashboard:', error);
      setAlert({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to fetch Calendly data' 
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEventDetails = async (eventUri: string) => {
    try {
      setLoadingEventDetails(true);
      const eventUuid = eventUri.split('/').pop();
      if (!eventUuid) return;
      
      const details = await calendlyApi.getEventDetails(eventUuid);
      setEventDetails(details);
    } catch (error: any) {
      console.error('Error fetching event details:', error);
      setAlert({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to fetch event details' 
      });
    } finally {
      setLoadingEventDetails(false);
    }
  };

  const handleViewEventDetails = async (event: ScheduledEvent) => {
    setSelectedEvent(event);
    setEventDialogOpen(true);
    await fetchEventDetails(event.uri);
  };

  const handleCancelEvent = async () => {
    if (!selectedEvent) return;
    
    try {
      setCancelling(true);
      const eventUuid = selectedEvent.uri.split('/').pop();
      if (!eventUuid) return;
      
      await calendlyApi.cancelEvent(eventUuid, cancelReason);
      setAlert({ 
        type: 'success', 
        message: 'Event cancelled successfully' 
      });
      setCancelDialogOpen(false);
      setEventDialogOpen(false);
      setCancelReason('');
      fetchDashboardData(); // Refresh data
    } catch (error: any) {
      console.error('Error cancelling event:', error);
      setAlert({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to cancel event' 
      });
    } finally {
      setCancelling(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'cancelled': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getLocationIcon = (locationType: string) => {
    switch (locationType) {
      case 'zoom_conference':
      case 'microsoft_teams':
      case 'google_meet':
        return <VideoCallIcon />;
      default:
        return <EventIcon />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {alert && (
        <Alert 
          severity={alert.type} 
          onClose={() => setAlert(null)}
          sx={{ mb: 2 }}
        >
          {alert.message}
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Calendly Scheduling
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardData}
        >
          Refresh
        </Button>
      </Box>

      {/* User Info Card */}
      {dashboardData.user && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <PersonIcon color="primary" sx={{ fontSize: 40 }} />
              <Box flex={1}>
                <Typography variant="h6">{dashboardData.user.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {dashboardData.user.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Timezone: {dashboardData.user.timezone}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                href={dashboardData.user.scheduling_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Public Page
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Event Types */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Event Types ({dashboardData.eventTypes.length})
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            {dashboardData.eventTypes.map((eventType) => (
              <Card key={eventType.uri} variant="outlined" sx={{ minWidth: 250 }}>
                <CardContent sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <ScheduleIcon style={{ color: eventType.color }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      {eventType.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Duration: {eventType.duration} minutes
                  </Typography>
                  <Box display="flex" gap={1} mb={2}>
                    <Chip 
                      label={eventType.active ? 'Active' : 'Inactive'}
                      color={eventType.active ? 'success' : 'default'}
                      size="small"
                    />
                    {eventType.locations.map((location, index) => (
                      <Chip
                        key={index}
                        icon={getLocationIcon(location.kind)}
                        label={location.kind.replace('_', ' ')}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNewIcon />}
                    href={eventType.scheduling_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    fullWidth
                  >
                    Book Meeting
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Recent Events ({dashboardData.recentEvents.length})
            </Typography>
            <Box display="flex" gap={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={eventsFilter.status}
                  label="Status"
                  onChange={(e) => setEventsFilter(prev => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Event</TableCell>
                  <TableCell>Date & Time</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Invitees</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dashboardData.recentEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboardData.recentEvents.map((event) => (
                    <TableRow key={event.uri}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {event.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateTime(event.start_time)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.status}
                          color={getStatusColor(event.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {event.invitees_counter?.active || 0} / {event.invitees_counter?.total || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewEventDetails(event)}
                            >
                              <EventIcon />
                            </IconButton>
                          </Tooltip>
                          {event.status === 'active' && (
                            <Tooltip title="Cancel Event">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setCancelDialogOpen(true);
                                }}
                              >
                                <CancelIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog 
        open={eventDialogOpen} 
        onClose={() => setEventDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Event Details</DialogTitle>
        <DialogContent>
          {loadingEventDetails ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : eventDetails ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                {eventDetails.event.name}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Time:</strong> {formatDateTime(eventDetails.event.start_time)} - {formatDateTime(eventDetails.event.end_time)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Status:</strong> <Chip label={eventDetails.event.status} color={getStatusColor(eventDetails.event.status) as any} size="small" />
              </Typography>
              
              {eventDetails.invitees.length > 0 && (
                <Box mt={2}>
                  <Typography variant="h6" gutterBottom>
                    Invitees ({eventDetails.invitees.length})
                  </Typography>
                  {eventDetails.invitees.map((invitee, index) => (
                    <Card key={index} variant="outlined" sx={{ mb: 1 }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography variant="subtitle2">{invitee.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{invitee.email}</Typography>
                        <Chip label={invitee.status} size="small" sx={{ mt: 1 }} />
                        {invitee.questions_and_answers && invitee.questions_and_answers.length > 0 && (
                          <Box mt={2}>
                            <Typography variant="subtitle2">Questions & Answers:</Typography>
                            {invitee.questions_and_answers.map((qa, qaIndex) => (
                              <Box key={qaIndex} mt={1}>
                                <Typography variant="body2" fontWeight="bold">
                                  {qa.question}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {qa.answer}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          ) : (
            <Typography>No event details available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Event Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Event</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to cancel this event?
          </Typography>
          {selectedEvent && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {selectedEvent.name} - {formatDateTime(selectedEvent.start_time)}
            </Typography>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Cancellation Reason (Optional)"
            fullWidth
            multiline
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Provide a reason for cancelling this event..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>
            Keep Event
          </Button>
          <Button 
            onClick={handleCancelEvent} 
            color="error" 
            variant="contained"
            disabled={cancelling}
          >
            {cancelling ? <CircularProgress size={20} /> : 'Cancel Event'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendlyDashboard;