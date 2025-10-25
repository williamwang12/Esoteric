import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Fade,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  CalendarToday,
  Schedule,
  VideoCall,
  AccessTime,
  Person,
  CheckCircle,
  SupportAgent,
  EventAvailable,
} from '@mui/icons-material';
import CalendlyBooking from '../calendly/CalendlyBooking';
import { calendlyService, CalendlyAvailableTime } from '../../services/calendlyService';

const ScheduleMeeting: React.FC = () => {
  const theme = useTheme();
  const [availableSlots, setAvailableSlots] = useState<CalendlyAvailableTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvailableSlots = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if API token is configured
        if (!process.env.REACT_APP_CALENDLY_ACCESS_TOKEN) {
          setError('Calendly API is not configured. Contact administrator to set up the integration.');
          setLoading(false);
          return;
        }
        
        const slots = await calendlyService.getNextAvailableSlots(4, 14);
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Error fetching available slots:', err);
        setError('Unable to load available times. Please use the booking form below.');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableSlots();
  }, []);

  const handleSlotClick = (slot: CalendlyAvailableTime) => {
    // Format the date for Calendly URL parameter
    const slotDate = new Date(slot.start_time);
    const year = slotDate.getFullYear();
    const month = String(slotDate.getMonth() + 1).padStart(2, '0');
    const day = String(slotDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    // Open Calendly booking page with pre-selected date
    const calendlyUrl = `https://calendly.com/julia-esotericenterprises/30min?date=${dateString}`;
    window.open(calendlyUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Fade in={true} timeout={1000}>
      <Box>

        {/* Next Available Time Slots */}
        <Card sx={{
          mb: 4,
          background: 'linear-gradient(135deg, rgba(111, 92, 242, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%)',
          border: '1px solid rgba(111, 92, 242, 0.2)',
          borderRadius: '16px',
        }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <EventAvailable sx={{ color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Next Available Times
              </Typography>
            </Box>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                  Loading available times...
                </Typography>
              </Box>
            ) : error ? (
              <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                {error}
              </Alert>
            ) : availableSlots.length > 0 ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Click any time slot to book instantly
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 1.5,
                  mb: 2
                }}>
                  {availableSlots.map((slot, index) => {
                    const { date, time, dayOfWeek } = calendlyService.formatSlotTime(slot.start_time);
                    const slotDate = new Date(slot.start_time);
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    let dayLabel = dayOfWeek;
                    if (slotDate.toDateString() === today.toDateString()) {
                      dayLabel = 'Today';
                    } else if (slotDate.toDateString() === tomorrow.toDateString()) {
                      dayLabel = 'Tomorrow';
                    }
                    
                    return (
                      <Chip
                        key={index}
                        label={
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                              {dayLabel}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem' }}>
                              {slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block' }}>
                              {time}
                            </Typography>
                          </Box>
                        }
                        onClick={() => handleSlotClick(slot)}
                        clickable
                        sx={{
                          height: 'auto',
                          py: 1.5,
                          px: 2,
                          background: 'linear-gradient(135deg, rgba(111, 92, 242, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
                          border: '1px solid rgba(111, 92, 242, 0.3)',
                          color: 'text.primary',
                          '&:hover': {
                            background: 'linear-gradient(135deg, rgba(111, 92, 242, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
                            transform: 'translateY(-1px)',
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                      />
                    );
                  })}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Times shown in your local timezone
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No available times found in the next 4 days. Please check back later or use the booking form below.
              </Typography>
            )}
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
          {/* Main Booking Section */}
          <Box sx={{ flex: { md: '2' }, width: '100%' }}>
            <CalendlyBooking showAsCard={false} showHeader={false} />
          </Box>

          {/* Information Sidebar */}
          <Box sx={{ flex: { md: '1' }, width: '100%' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {/* Meeting Benefits */}
              <Card sx={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '16px',
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <CheckCircle sx={{ color: 'success.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Why Schedule?
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Portfolio Review
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Get personalized insights about your investment performance
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Strategy Planning
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Discuss your financial goals and investment strategy
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Account Support
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Get help with withdrawals, deposits, and account management
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>


              {/* What to Prepare */}
              <Card sx={{
                background: alpha(theme.palette.info.main, 0.05),
                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                borderRadius: '16px',
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'info.main' }}>
                    📋 Come Prepared
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      • Questions about your account or investments
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Specific goals you'd like to discuss
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Any documents you'd like to review together
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Details about planned withdrawals or deposits
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

export default ScheduleMeeting;