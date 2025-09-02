import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Fade,
  Slide,
  Grow,
  keyframes,
  styled,
} from '@mui/material';
import {
  TrendingUp,
  Security,
  Analytics,
  Timeline,
  AccountBalance,
  AttachMoney,
  ArrowForward,
  CheckCircle,
  Star,
  BarChart,
  CurrencyExchange,
  Shield,
  Speed,
  Support,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const FloatingOrb = styled(Box)(({ theme }) => ({
  position: 'absolute',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(107, 70, 193, 0.2), rgba(147, 51, 234, 0.2))',
  filter: 'blur(60px)',
  animation: `${keyframes`
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
    33% { transform: translate(50px, -50px) scale(1.2); opacity: 0.6; }
    66% { transform: translate(-30px, 30px) scale(0.8); opacity: 1; }
  `} 12s ease-in-out infinite`,
}));

const HeroGradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(135deg, #F9FAFB 0%, #A855F7 50%, #EC4899 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  background: 'rgba(31, 41, 55, 0.8)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(107, 70, 193, 0.2)',
  borderRadius: '24px',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent, rgba(107, 70, 193, 0.6), transparent)',
  },
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 25px 50px rgba(107, 70, 193, 0.3), 0 0 0 1px rgba(107, 70, 193, 0.4)',
    border: '1px solid rgba(107, 70, 193, 0.4)',
  },
}));

const StatsCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.9), rgba(107, 70, 193, 0.1))',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(107, 70, 193, 0.3)',
  borderRadius: '20px',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 20px 40px rgba(107, 70, 193, 0.2)',
  },
}));

const LandingPage: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const featuresTimer = setTimeout(() => setFeaturesVisible(true), 1000);
    const statsTimer = setTimeout(() => setStatsVisible(true), 800);
    return () => {
      clearTimeout(featuresTimer);
      clearTimeout(statsTimer);
    };
  }, []);

  const features = [
    {
      icon: <TrendingUp sx={{ fontSize: 48 }} />,
      title: 'Portfolio Growth',
      description: 'Track your investment performance with real-time analytics and comprehensive growth metrics.',
      color: '#22C55E',
    },
    {
      icon: <Security sx={{ fontSize: 48 }} />,
      title: 'Secure Platform',
      description: 'Enterprise-grade security with 2FA authentication and encrypted data protection.',
      color: '#3B82F6',
    },
    {
      icon: <Analytics sx={{ fontSize: 48 }} />,
      title: 'Advanced Analytics',
      description: 'Powerful insights into your loan performance, returns, and financial trends.',
      color: '#F59E0B',
    },
    {
      icon: <Support sx={{ fontSize: 48 }} />,
      title: '24/7 Support',
      description: 'Dedicated customer support team available around the clock for all your needs.',
      color: '#EF4444',
    },
  ];

  const stats = [
    { value: '$50M+', label: 'Assets Under Management', icon: <AccountBalance /> },
    { value: '500+', label: 'Active Investors', icon: <Timeline /> },
    { value: '12.5%', label: 'Average Annual Return', icon: <AttachMoney /> },
    { value: '99.9%', label: 'Platform Uptime', icon: <Speed /> },
  ];

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Background Orbs */}
      <FloatingOrb sx={{ width: 400, height: 400, top: '5%', left: '5%' }} />
      <FloatingOrb sx={{ width: 300, height: 300, top: '60%', right: '10%', animationDelay: '-4s' }} />
      <FloatingOrb sx={{ width: 200, height: 200, bottom: '20%', left: '15%', animationDelay: '-2s' }} />

      {/* Navigation */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'rgba(31, 41, 55, 0.95)',
          backdropFilter: 'blur(30px)',
          borderBottom: '1px solid rgba(107, 70, 193, 0.2)',
          zIndex: 1000,
          py: 2.5,
          '&::before': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(107, 70, 193, 0.8), transparent)',
          }
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <HeroGradientText variant="h4" sx={{ fontWeight: 800 }}>
              ESOTERIC
            </HeroGradientText>
            
            {/* All buttons on the right */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                  });
                }}
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  px: 3,
                  py: 1.5,
                  borderRadius: '12px',
                  background: 'rgba(107, 70, 193, 0.1)',
                  border: '1px solid rgba(107, 70, 193, 0.2)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    background: 'rgba(107, 70, 193, 0.2)',
                    border: '1px solid rgba(107, 70, 193, 0.4)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(107, 70, 193, 0.3)',
                  },
                }}
              >
                Features
              </Button>
              <Button
                onClick={() => {
                  document.getElementById('about')?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                  });
                }}
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  px: 3,
                  py: 1.5,
                  borderRadius: '12px',
                  background: 'rgba(107, 70, 193, 0.1)',
                  border: '1px solid rgba(107, 70, 193, 0.2)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    background: 'rgba(107, 70, 193, 0.2)',
                    border: '1px solid rgba(107, 70, 193, 0.4)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(107, 70, 193, 0.3)',
                  },
                }}
              >
                Who We Are
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  px: 3,
                  py: 1.5,
                  borderRadius: '12px',
                  background: 'rgba(107, 70, 193, 0.1)',
                  border: '1px solid rgba(107, 70, 193, 0.2)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    background: 'rgba(107, 70, 193, 0.2)',
                    border: '1px solid rgba(107, 70, 193, 0.4)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(107, 70, 193, 0.3)',
                  },
                }}
              >
                Sign In
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  px: 3,
                  py: 1.5,
                  borderRadius: '12px',
                  background: 'rgba(107, 70, 193, 0.1)',
                  border: '1px solid rgba(107, 70, 193, 0.2)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    background: 'rgba(107, 70, 193, 0.2)',
                    border: '1px solid rgba(107, 70, 193, 0.4)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(107, 70, 193, 0.3)',
                  },
                }}
              >
                Get Started
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: 20, pb: 8 }}>
        <Fade in={isVisible} timeout={1000}>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Slide direction="down" in={isVisible} timeout={1200}>
              <Box>
                <HeroGradientText variant="h1" sx={{ mb: 3, fontSize: { xs: '3rem', md: '4rem' } }}>
                  Venture Capital
                  <br />
                  Redefined
                </HeroGradientText>
                <Typography
                  variant="h4"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 400,
                    mb: 4,
                    maxWidth: '800px',
                    mx: 'auto',
                    lineHeight: 1.4,
                  }}
                >
                  Experience next-generation investment management with advanced analytics, 
                  secure portfolio tracking, and exceptional returns.
                </Typography>
              </Box>
            </Slide>
            
            <Slide direction="up" in={isVisible} timeout={1400}>
              <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForward />}
                  sx={{
                    py: 2,
                    px: 4,
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
                    boxShadow: '0 8px 24px rgba(107, 70, 193, 0.4)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #553C9A 0%, #7C3AED 50%, #8B5CF6 100%)',
                      boxShadow: '0 12px 32px rgba(107, 70, 193, 0.6)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Start Investing Today
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ 
                      behavior: 'smooth',
                      block: 'start'
                    });
                  }}
                  sx={{
                    py: 2,
                    px: 4,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderColor: 'rgba(107, 70, 193, 0.5)',
                    color: '#6B46C1',
                    background: 'rgba(107, 70, 193, 0.05)',
                    '&:hover': {
                      borderColor: '#6B46C1',
                      backgroundColor: 'rgba(107, 70, 193, 0.15)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Learn More
                </Button>
              </Box>
            </Slide>
          </Box>
        </Fade>

        {/* Stats Section */}
        <Fade in={statsVisible} timeout={1000}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, 
            gap: 3, 
            mb: 12 
          }}>
            {stats.map((stat, index) => (
              <Grow in={statsVisible} timeout={1000 + index * 200} key={index}>
                <StatsCard>
                  <CardContent sx={{ textAlign: 'center', p: 4 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                        color: 'white',
                        mb: 2,
                      }}
                    >
                      {stat.icon}
                    </Box>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 800,
                        mb: 1,
                        background: 'linear-gradient(135deg, #F9FAFB 0%, #A855F7 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </CardContent>
                </StatsCard>
              </Grow>
            ))}
          </Box>
        </Fade>
      </Container>

      {/* Features Section */}
      <Box id="features" sx={{ pt: 16, pb: 8, background: 'rgba(0, 0, 0, 0.2)' }}>
        <Container maxWidth="lg">
          <Fade in={featuresVisible} timeout={1000}>
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  mb: 3,
                  background: 'linear-gradient(135deg, #F9FAFB 0%, #A855F7 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Why Choose Esoteric?
              </Typography>
              <Typography
                variant="h5"
                color="text.secondary"
                sx={{ maxWidth: '600px', mx: 'auto' }}
              >
                Advanced features designed for sophisticated investors seeking superior returns
              </Typography>
            </Box>
          </Fade>

          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, 
            gap: 4 
          }}>
            {features.map((feature, index) => (
              <Grow in={featuresVisible} timeout={1200 + index * 200} key={index}>
                <FeatureCard>
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${feature.color}20, ${feature.color}40)`,
                        color: feature.color,
                        mb: 3,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 700, mb: 2, color: 'white' }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </FeatureCard>
              </Grow>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Who We Are Section */}
      <Box id="about" sx={{ pt: 16, pb: 8, background: 'rgba(0, 0, 0, 0.2)' }}>
        <Container maxWidth="lg">
          <Fade in={true} timeout={2000}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
              gap: 8, 
              alignItems: 'center' 
            }}>
              <Box>
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 800,
                    mb: 4,
                    background: 'linear-gradient(135deg, #F9FAFB 0%, #A855F7 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Who We Are
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8 }}>
                  Esoteric is a next-generation investment platform founded by industry veterans 
                  with decades of experience in private equity, venture capital, and quantitative finance. 
                  We bridge the gap between traditional investment management and modern technology.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
                  {[
                    'Founded by former Goldman Sachs and Blackstone executives',
                    'Proprietary algorithms developed over 15+ years',
                    'Regulatory compliance with SEC and FINRA standards',
                    'Trusted by high-net-worth individuals and institutions'
                  ].map((item, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CheckCircle sx={{ color: '#22C55E', fontSize: 24 }} />
                      <Typography variant="body1" color="text.primary">
                        {item}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForward />}
                  sx={{
                    py: 2,
                    px: 4,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #553C9A 0%, #7C3AED 50%, #8B5CF6 100%)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Join Our Platform
                </Button>
              </Box>
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                  border: '2px solid rgba(107, 70, 193, 0.3)',
                  p: 4,
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 3, color: 'white' }}>
                  Our Leadership
                </Typography>
                <Box sx={{ display: 'grid', gap: 3 }}>
                  {[
                    { title: 'Investment Expertise', value: '25+ years combined experience', icon: <BarChart /> },
                    { title: 'Technology Innovation', value: 'AI-powered portfolio optimization', icon: <Analytics /> },
                    { title: 'Risk Management', value: 'Institutional-grade controls', icon: <Shield /> },
                    { title: 'Client Focus', value: 'Personalized investment strategies', icon: <Star /> },
                  ].map((highlight, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          background: 'rgba(107, 70, 193, 0.2)',
                          color: '#A855F7',
                        }}
                      >
                        {highlight.icon}
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                          {highlight.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {highlight.value}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Fade>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: 8,
          background: 'linear-gradient(135deg, rgba(107, 70, 193, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
          borderTop: '1px solid rgba(107, 70, 193, 0.2)',
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                mb: 3,
                background: 'linear-gradient(135deg, #F9FAFB 0%, #A855F7 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Ready to Transform Your Portfolio?
            </Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 4 }}>
              Join hundreds of sophisticated investors who trust Esoteric with their financial future.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                sx={{
                  py: 2.5,
                  px: 5,
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
                  boxShadow: '0 8px 24px rgba(107, 70, 193, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #553C9A 0%, #7C3AED 50%, #8B5CF6 100%)',
                    boxShadow: '0 12px 32px rgba(107, 70, 193, 0.6)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                Start Your Journey
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                size="large"
                sx={{
                  py: 2.5,
                  px: 5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderColor: 'rgba(107, 70, 193, 0.5)',
                  color: '#6B46C1',
                  background: 'rgba(107, 70, 193, 0.05)',
                  '&:hover': {
                    borderColor: '#6B46C1',
                    backgroundColor: 'rgba(107, 70, 193, 0.15)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                Sign In
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          py: 4,
          borderTop: '1px solid rgba(107, 70, 193, 0.2)',
          background: 'rgba(31, 41, 55, 0.9)',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center' }}>
            <HeroGradientText variant="h5" sx={{ mb: 2 }}>
              ESOTERIC
            </HeroGradientText>
            <Typography variant="body2" color="text.secondary">
              © 2024 Esoteric. Professional investment management redefined.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;