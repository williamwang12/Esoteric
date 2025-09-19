import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  styled,
  alpha,
  useTheme,
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';

const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(135deg, #F9FAFB 0%, #6f5cf2 50%, #EC4899 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}));

const GradientButtonText = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #F9FAFB 0%, #6f5cf2 50%, #EC4899 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}));

const PublicNavigation: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  const navigationItems = [
    { 
      label: 'Sign In', 
      component: RouterLink,
      to: '/login'
    },
    { 
      label: 'Sign Up', 
      component: RouterLink,
      to: '/register'
    },
  ];

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(31, 41, 55, 0.95)',
        backdropFilter: 'blur(30px)',
        borderBottom: '1px solid rgba(111, 92, 242, 0.2)',
        zIndex: 1000,
        height: { xs: '70px', sm: '80px', md: '90px' },
        display: 'flex',
        alignItems: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(111, 92, 242, 0.8), transparent)',
        }
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box
            component={RouterLink}
            to="/"
            sx={{
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'scale(1.02)',
                opacity: 0.8,
              }
            }}
          >
            <GradientText 
              variant="h4" 
              sx={{ 
                fontSize: { xs: '24px', sm: '32px', md: '34px' },
                flexShrink: 0,
                width: { xs: '140px', sm: '180px', md: '200px' },
                textAlign: 'left',
              }}
            >
              ESOTERIC
            </GradientText>
          </Box>
          
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 1, sm: 2, md: 3 }, 
            alignItems: 'center',
            flexWrap: 'nowrap',
          }}>
            {navigationItems.map((item, index) => (
              <Button
                key={index}
                component={item.component}
                to={item.to}
                variant="outlined"
                sx={{
                  background: 'rgba(55, 65, 81, 0.6)',
                  backdropFilter: 'blur(10px)',
                  color: 'transparent',
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
                  letterSpacing: '-0.02em',
                  px: { xs: 2, sm: 3, md: 3 },
                  py: { xs: 0.8, sm: 1, md: 1.2 },
                  borderRadius: '8px',
                  borderColor: 'rgba(111, 92, 242, 0.3)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    background: 'rgba(75, 85, 99, 0.8)',
                    borderColor: 'rgba(111, 92, 242, 0.6)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(111, 92, 242, 0.3)',
                  },
                }}
              >
                <GradientButtonText>
                  {item.label}
                </GradientButtonText>
              </Button>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default PublicNavigation;