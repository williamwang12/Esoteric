import React from 'react';
import { Box, CircularProgress, Typography, keyframes, styled } from '@mui/material';

// Styled components for enhanced loading animations
const PulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
`;

const FloatAnimation = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
`;

const LoaderContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  position: 'relative',
}));

const AnimatedProgress = styled(CircularProgress)(({ theme }) => ({
  animation: `${PulseAnimation} 2s ease-in-out infinite`,
  '& .MuiCircularProgress-circle': {
    strokeLinecap: 'round',
  },
}));

const LoadingText = styled(Typography)(({ theme }) => ({
  animation: `${FloatAnimation} 3s ease-in-out infinite`,
  background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 600,
  marginTop: theme.spacing(2),
}));

const LoadingDots = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
  '& > div': {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6B46C1, #9333EA)',
    animation: `${PulseAnimation} 1.4s ease-in-out infinite`,
    '&:nth-of-type(1)': { animationDelay: '0s' },
    '&:nth-of-type(2)': { animationDelay: '0.2s' },
    '&:nth-of-type(3)': { animationDelay: '0.4s' },
  },
}));

interface EnhancedLoaderProps {
  message?: string;
  size?: number;
  showDots?: boolean;
}

const EnhancedLoader: React.FC<EnhancedLoaderProps> = ({ 
  message = 'Loading...', 
  size = 60,
  showDots = true 
}) => {
  return (
    <LoaderContainer>
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Background glow effect */}
        <Box
          sx={{
            position: 'absolute',
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(107, 70, 193, 0.2) 0%, transparent 70%)',
            animation: `${PulseAnimation} 2s ease-in-out infinite`,
          }}
        />
        
        <AnimatedProgress 
          size={size} 
          thickness={4}
          sx={{
            color: 'primary.main',
            filter: 'drop-shadow(0 0 10px rgba(107, 70, 193, 0.3))',
          }}
        />
      </Box>
      
      <LoadingText variant="h6">
        {message}
      </LoadingText>
      
      {showDots && (
        <LoadingDots>
          <div />
          <div />
          <div />
        </LoadingDots>
      )}
    </LoaderContainer>
  );
};

export default EnhancedLoader;