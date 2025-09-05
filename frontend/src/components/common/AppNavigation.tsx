import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tab,
  Tabs,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Slide,
  useTheme,
  alpha,
  styled,
  keyframes,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  useMediaQuery,
} from '@mui/material';
import {
  ExitToApp,
  Person,
  AdminPanelSettings,
  AccountBalance,
  TrendingUp,
  History,
  Description,
  Menu as MenuIcon,
  Close,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';

const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(135deg, #F9FAFB 0%, #A855F7 50%, #EC4899 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}));

interface AppNavigationProps {
  onLogout?: () => void;
  currentTab?: number;
  onTabChange?: (tab: number) => void;
}

const AppNavigation: React.FC<AppNavigationProps> = ({ 
  onLogout, 
  currentTab = 0, 
  onTabChange 
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Handle main tab changes
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    if (newValue === 4 && user?.role === 'admin') {
      // Admin tab - navigate to admin page
      navigate('/admin');
    } else if (onTabChange) {
      // Dashboard tabs - handle with callback
      onTabChange(newValue);
    }
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    if (onLogout) {
      onLogout();
    } else {
      try {
        await logout();
        navigate('/login');
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  const handleProfileClick = () => {
    handleProfileMenuClose();
    navigate('/profile');
  };

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const handleMobileTabChange = (tabIndex: number) => {
    handleMobileMenuClose();
    if (tabIndex === 4 && user?.role === 'admin') {
      navigate('/admin');
    } else if (onTabChange) {
      onTabChange(tabIndex);
    }
  };

  const isAdminPage = location.pathname.includes('/admin');
  
  const navigationItems = [
    { icon: <AccountBalance />, label: 'Overview', index: 0 },
    { icon: <TrendingUp />, label: 'Analytics', index: 1 },
    { icon: <History />, label: 'Transactions', index: 2 },
    { icon: <Description />, label: 'Documents', index: 3 },
    ...(user?.role === 'admin' ? [{ icon: <AdminPanelSettings />, label: 'Admin', index: 4 }] : [])
  ];
  
  return (
    <Slide direction="down" in={true} mountOnEnter unmountOnExit>
      <AppBar 
        position="static" 
        elevation={0}
        sx={{
          background: 'rgba(31, 41, 55, 0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(107, 70, 193, 0.2)',
          position: 'relative',
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
        {/* Main Navigation Row */}
        <Toolbar sx={{ 
          py: 1, 
          minHeight: '64px !important', 
          px: { xs: 2, sm: 3 },
          pl: { xs: 2, md: 80 } // Restore original desktop left padding
        }}>
          {/* Mobile Menu Button */}
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleMobileMenuToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Company Logo/Name */}
          <GradientText 
            variant="h5" 
            sx={{ 
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
              mr: { xs: 'auto', md: 4 },
              flexGrow: { xs: 1, md: 0 },
              pl: { md: 44 } // Restore original desktop logo padding
            }}
          >
            ESOTERIC
          </GradientText>

          {/* Desktop Navigation Tabs */}
          {!isMobile && (
            <Box sx={{ flexGrow: 1 }}>
              <Tabs
                value={isAdminPage ? (user?.role === 'admin' ? 4 : 0) : currentTab}
                onChange={handleTabChange}
                sx={{
                  '& .MuiTab-root': {
                    color: alpha(theme.palette.common.white, 0.7),
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '1rem',
                    minWidth: 120, // Restore original desktop tab width
                    '&.Mui-selected': {
                      color: theme.palette.common.white,
                    },
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: theme.palette.common.white,
                    height: 3,
                    borderRadius: '3px 3px 0 0',
                  },
                }}
              >
                {navigationItems.map((item) => (
                  <Tab 
                    key={item.index}
                    icon={item.icon} 
                    label={item.label} 
                    iconPosition="start"
                    sx={{ 
                      '& .MuiTab-iconWrapper': { 
                        marginRight: '8px', 
                        marginBottom: '0px !important' 
                      } 
                    }}
                  />
                ))}
              </Tabs>
            </Box>
          )}

          {/* User Profile Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            {/* User Info - Hidden on mobile */}
            <Box sx={{ 
              display: { xs: 'none', sm: 'flex' }, 
              flexDirection: 'column',
              alignItems: 'flex-end',
              mr: 1
            }}>
              <Typography variant="body2" sx={{ 
                color: theme.palette.common.white,
                fontWeight: 600,
                lineHeight: 1.2
              }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" sx={{ 
                color: alpha(theme.palette.common.white, 0.7),
                lineHeight: 1.2
              }}>
                {user?.role === 'admin' ? 'Administrator' : 'Client'}
              </Typography>
            </Box>

            {/* Profile Avatar Button */}
            <IconButton
              onClick={handleProfileMenuOpen}
              sx={{
                p: 0,
                border: `2px solid ${alpha(theme.palette.common.white, 0.2)}`,
                '&:hover': {
                  border: `2px solid ${alpha(theme.palette.common.white, 0.4)}`,
                },
              }}
            >
              <Avatar
                sx={{
                  width: 40, // Keep original desktop size
                  height: 40,
                  background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                  fontSize: '1rem', // Keep original desktop size
                  fontWeight: 600,
                }}
              >
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Avatar>
            </IconButton>

            {/* Profile Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 180,
                  background: 'rgba(31, 41, 55, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(107, 70, 193, 0.3)',
                  borderRadius: '12px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                  '& .MuiMenuItem-root': {
                    px: 2,
                    py: 1.5,
                    borderRadius: '8px',
                    mx: 1,
                    '&:hover': {
                      background: 'rgba(107, 70, 193, 0.2)',
                    },
                  },
                },
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={handleProfileClick}>
                <Person sx={{ mr: 2 }} />
                View Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ExitToApp sx={{ mr: 2 }} />
                Sign Out
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>

        {/* Mobile Navigation Drawer */}
        <Drawer
          anchor="left"
          open={mobileMenuOpen}
          onClose={handleMobileMenuClose}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: 280,
              background: 'rgba(31, 41, 55, 0.98)',
              backdropFilter: 'blur(20px)',
              border: 'none',
              borderRight: '1px solid rgba(107, 70, 193, 0.3)',
              color: 'white',
            },
          }}
        >
          {/* Mobile Menu Header */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid rgba(107, 70, 193, 0.3)'
          }}>
            <GradientText variant="h6" sx={{ fontSize: '1.5rem' }}>
              ESOTERIC
            </GradientText>
            <IconButton onClick={handleMobileMenuClose} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>

          {/* User Info in Mobile Menu */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            p: 2,
            borderBottom: '1px solid rgba(107, 70, 193, 0.3)'
          }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
              }}
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Avatar>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="body2" sx={{ 
                color: alpha(theme.palette.common.white, 0.7)
              }}>
                {user?.role === 'admin' ? 'Administrator' : 'Client'}
              </Typography>
            </Box>
          </Box>

          {/* Navigation Items */}
          <List sx={{ flexGrow: 1 }}>
            {navigationItems.map((item) => (
              <ListItem key={item.index} disablePadding>
                <ListItemButton
                  selected={isAdminPage ? (item.index === 4) : (currentTab === item.index)}
                  onClick={() => handleMobileTabChange(item.index)}
                  sx={{
                    py: 1.5,
                    px: 2,
                    mx: 1,
                    borderRadius: '8px',
                    '&.Mui-selected': {
                      background: 'rgba(107, 70, 193, 0.3)',
                      '&:hover': {
                        background: 'rgba(107, 70, 193, 0.4)',
                      },
                    },
                    '&:hover': {
                      background: 'rgba(107, 70, 193, 0.1)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: 600,
                      fontSize: '1rem'
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          {/* Mobile Menu Footer Actions */}
          <Box sx={{ borderTop: '1px solid rgba(107, 70, 193, 0.3)' }}>
            <ListItem disablePadding>
              <ListItemButton onClick={handleProfileClick} sx={{ py: 1.5, px: 2 }}>
                <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                  <Person />
                </ListItemIcon>
                <ListItemText primary="View Profile" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout} sx={{ py: 1.5, px: 2 }}>
                <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                  <ExitToApp />
                </ListItemIcon>
                <ListItemText primary="Sign Out" />
              </ListItemButton>
            </ListItem>
          </Box>
        </Drawer>

      </AppBar>
    </Slide>
  );
};

export default AppNavigation;