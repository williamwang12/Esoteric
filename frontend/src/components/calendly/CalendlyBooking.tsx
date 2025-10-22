import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  Link,
} from '@mui/material';
import {
  CalendarMonth,
  Schedule,
  VideoCall,
  OpenInNew,
  AccessTime,
  Person,
} from '@mui/icons-material';

interface CalendlyBookingProps {
  showAsCard?: boolean;
  showHeader?: boolean;
  onBookingClick?: () => void;
}

const CalendlyBooking: React.FC<CalendlyBookingProps> = ({
  showAsCard = true,
  showHeader = true,
  onBookingClick,
}) => {
  const calendlyUrl = 'https://calendly.com/julia-esotericenterprises/30min';
  
  const handleBookMeeting = () => {
    if (onBookingClick) {
      onBookingClick();
    }
    // Open Calendly in a new tab
    window.open(calendlyUrl, '_blank', 'noopener,noreferrer');
  };

  const content = (
    <Box>
      {showHeader && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <CalendarMonth sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Schedule a Meeting
          </Typography>
        </Box>
      )}

      {/* Meeting Type Card */}
      <Card 
        variant="outlined" 
        sx={{ 
          mb: 3, 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(96, 165, 250, 0.02) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '12px',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <VideoCall sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              30 Minute Meeting
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                30 minutes via Zoom
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                With Julia Toti
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Schedule a consultation to discuss your account, investment questions, or portfolio planning.
            You'll receive a Zoom meeting link after booking.
          </Typography>

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<Schedule />}
            endIcon={<OpenInNew />}
            onClick={handleBookMeeting}
            sx={{
              py: 2,
              background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '1rem',
              textTransform: 'none',
              letterSpacing: '0.025em',
              '&:hover': {
                background: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
                boxShadow: '0 12px 24px rgba(59, 130, 246, 0.4)',
                transform: 'translateY(-2px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
              },
              boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)',
              transition: 'all 0.3s ease-in-out',
            }}
          >
            Book Meeting
          </Button>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert 
        severity="info" 
        sx={{ 
          borderRadius: '12px',
          background: 'rgba(29, 78, 216, 0.05)',
          border: '1px solid rgba(29, 78, 216, 0.2)',
        }}
      >
        <Typography variant="body2">
          <strong>Instant Booking:</strong> Select your preferred time slot and you'll automatically receive 
          a Zoom meeting link. No waiting for confirmation!
        </Typography>
      </Alert>

      {/* Direct Link */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Link
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            color: 'primary.main',
            textDecoration: 'none',
            fontSize: '0.875rem',
            '&:hover': {
              textDecoration: 'underline',
            }
          }}
        >
          Or visit our booking page directly
        </Link>
      </Box>
    </Box>
  );

  if (showAsCard) {
    return (
      <Card sx={{
        background: 'rgba(31, 41, 55, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(111, 92, 242, 0.3)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        height: 'fit-content'
      }}>
        <CardContent sx={{ p: 4 }}>
          {content}
        </CardContent>
      </Card>
    );
  }

  return content;
};

export default CalendlyBooking;