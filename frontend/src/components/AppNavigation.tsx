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
} from '@mui/material';
import {
  ExitToApp,
  Person,
  Dashboard,
  AdminPanelSettings,
  AccountBalance,
  TrendingUp,
  History,
  Description,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';

interface AppNavigationProps {
  onLogout?: () => void;
  dashboardTab?: number;
  onDashboardTabChange?: (tab: number) => void;
}

const AppNavigation: React.FC<AppNavigationProps> = ({ 
  onLogout, 
  dashboardTab = 0, 
  onDashboardTabChange 
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  // Determine current main tab based on pathname
  const getCurrentMainTab = () => {
    const path = location.pathname;
    if (path.includes('/profile')) return 1;
    if (path.includes('/admin')) return 2;
    return 0; // dashboard
  };

  const handleMainTabChange = (event: React.SyntheticEvent, newValue: number) => {
    switch (newValue) {
      case 0:
        navigate('/dashboard');
        break;
      case 1:
        navigate('/profile');
        break;
      case 2:
        navigate('/admin');
        break;
    }
  };

  const handleDashboardTabChange = (event: React.SyntheticEvent, newValue: number) => {
    if (onDashboardTabChange) {
      onDashboardTabChange(newValue);
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

  const isDashboard = getCurrentMainTab() === 0;
  
  return (
    <Slide direction="down" in={true} mountOnEnter unmountOnExit>
      <AppBar position="static" elevation={0}>
        {/* Main Navigation Row */}
        <Toolbar sx={{ py: 1, minHeight: '64px !important' }}>
          {/* Company Logo/Name */}
          <Typography 
            variant="h5" 
            component="div" 
            sx={{ 
              background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)', 
              backgroundClip: 'text', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              fontWeight: 800,
              letterSpacing: '-0.01em',
              fontSize: '1.75rem',
              mr: 4
            }}
          >
            ESOTERIC ENTERPRISES
          </Typography>

          {/* Main Navigation Tabs */}
          <Box sx={{ flexGrow: 1 }}>
            <Tabs
              value={getCurrentMainTab()}
              onChange={handleMainTabChange}
              sx={{
                '& .MuiTab-root': {
                  color: alpha(theme.palette.common.white, 0.7),
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '1rem',
                  minWidth: 120,
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
              <Tab 
                icon={<Dashboard />} 
                label="Dashboard" 
                iconPosition="start"
                sx={{ 
                  '& .MuiTab-iconWrapper': { 
                    marginRight: '8px', 
                    marginBottom: '0px !important' 
                  } 
                }}
              />
              <Tab 
                icon={<Person />} 
                label="Profile" 
                iconPosition="start"
                sx={{ 
                  '& .MuiTab-iconWrapper': { 
                    marginRight: '8px', 
                    marginBottom: '0px !important' 
                  } 
                }}
              />
              {user?.role === 'admin' && (
                <Tab 
                  icon={<AdminPanelSettings />} 
                  label="Admin" 
                  iconPosition="start"
                  sx={{ 
                    '& .MuiTab-iconWrapper': { 
                      marginRight: '8px', 
                      marginBottom: '0px !important' 
                    } 
                  }}
                />
              )}
            </Tabs>
          </Box>

          {/* User Profile Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* User Info */}
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
                  width: 40,
                  height: 40,
                  background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
                  fontSize: '1rem',
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
                  '& .MuiMenuItem-root': {
                    px: 2,
                    py: 1.5,
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

        {/* Dashboard Sub-tabs Row - Only show when on Dashboard */}
        {isDashboard && (
          <Box sx={{ 
            bgcolor: alpha(theme.palette.common.black, 0.1),
            borderTop: `1px solid ${alpha(theme.palette.common.white, 0.1)}`
          }}>
            <Box sx={{ 
              maxWidth: '1200px', 
              mx: 'auto', 
              px: 3,
              display: 'flex',
              alignItems: 'center'
            }}>
              <Tabs
                value={dashboardTab}
                onChange={handleDashboardTabChange}
                sx={{
                  '& .MuiTab-root': {
                    color: alpha(theme.palette.common.white, 0.7),
                    fontWeight: 500,
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    minWidth: 100,
                    minHeight: 48,
                    '&.Mui-selected': {
                      color: theme.palette.common.white,
                    },
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: theme.palette.common.white,
                    height: 2,
                  },
                }}
              >
                <Tab 
                  icon={<AccountBalance />} 
                  label="Overview" 
                  iconPosition="start"
                  sx={{ 
                    '& .MuiTab-iconWrapper': { 
                      marginRight: '6px', 
                      marginBottom: '0px !important' 
                    } 
                  }}
                />
                <Tab 
                  icon={<TrendingUp />} 
                  label="Analytics" 
                  iconPosition="start"
                  sx={{ 
                    '& .MuiTab-iconWrapper': { 
                      marginRight: '6px', 
                      marginBottom: '0px !important' 
                    } 
                  }}
                />
                <Tab 
                  icon={<History />} 
                  label="Transactions" 
                  iconPosition="start"
                  sx={{ 
                    '& .MuiTab-iconWrapper': { 
                      marginRight: '6px', 
                      marginBottom: '0px !important' 
                    } 
                  }}
                />
                <Tab 
                  icon={<Description />} 
                  label="Documents" 
                  iconPosition="start"
                  sx={{ 
                    '& .MuiTab-iconWrapper': { 
                      marginRight: '6px', 
                      marginBottom: '0px !important' 
                    } 
                  }}
                />
                {user?.role === 'admin' && (
                  <Tab 
                    icon={<AdminPanelSettings />} 
                    label="Admin" 
                    iconPosition="start"
                    sx={{ 
                      '& .MuiTab-iconWrapper': { 
                        marginRight: '6px', 
                        marginBottom: '0px !important' 
                      } 
                    }}
                  />
                )}
              </Tabs>
            </Box>
          </Box>
        )}
      </AppBar>
    </Slide>
  );
};

export default AppNavigation;