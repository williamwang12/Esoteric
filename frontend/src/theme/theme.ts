import { createTheme, alpha } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6B46C1', // Deep purple
      light: '#8B7CDF',
      dark: '#553C9A',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9333EA', // Purple accent
      light: '#A855F7',
      dark: '#7C3AED',
      contrastText: '#ffffff',
    },
    background: {
      default: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)', // Modern gradient
      paper: 'rgba(31, 41, 55, 0.8)', // Glass morphism
    },
    surface: {
      main: '#4B5563', // Medium gray for surfaces
    },
    text: {
      primary: '#F9FAFB', // White text
      secondary: '#D1D5DB', // Light gray text
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
    },
    // Custom gradients
    gradient: {
      primary: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
      secondary: 'linear-gradient(135deg, #1F2937 0%, #374151 50%, #4B5563 100%)',
      glass: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    },
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", "Segoe UI", "Roboto", sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 800,
      color: '#F9FAFB',
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2.25rem',
      fontWeight: 700,
      color: '#F9FAFB',
      letterSpacing: '-0.01em',
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.875rem',
      fontWeight: 700,
      color: '#F9FAFB',
      letterSpacing: '-0.01em',
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#F9FAFB',
      letterSpacing: '-0.005em',
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: '#F9FAFB',
      letterSpacing: '0em',
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: '#F9FAFB',
      letterSpacing: '0em',
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      color: '#F9FAFB',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      color: '#D1D5DB',
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      color: '#9CA3AF',
      lineHeight: 1.4,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          background: 'rgba(31, 41, 55, 0.8)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(107, 70, 193, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(107, 70, 193, 0.5), transparent)',
          },
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(107, 70, 193, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(107, 70, 193, 0.4)',
          },
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: ({ theme }) => ({
          borderRadius: '12px',
          textTransform: 'none',
          fontWeight: 600,
          padding: '14px 28px',
          fontSize: '0.95rem',
          background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 50%, #A855F7 100%)',
          boxShadow: '0 4px 15px rgba(107, 70, 193, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
            transition: 'left 0.6s',
          },
          '&:hover': {
            background: 'linear-gradient(135deg, #553C9A 0%, #7C3AED 50%, #8B5CF6 100%)',
            boxShadow: '0 8px 25px rgba(107, 70, 193, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            transform: 'translateY(-1px)',
            '&::before': {
              left: '100%',
            },
          },
          '&:active': {
            transform: 'translateY(0px)',
          },
        }),
        outlined: ({ theme }) => ({
          borderRadius: '12px',
          textTransform: 'none',
          fontWeight: 600,
          padding: '14px 28px',
          fontSize: '0.95rem',
          borderColor: 'rgba(107, 70, 193, 0.5)',
          color: '#6B46C1',
          background: 'rgba(107, 70, 193, 0.05)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            borderColor: '#6B46C1',
            backgroundColor: 'rgba(107, 70, 193, 0.15)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 15px rgba(107, 70, 193, 0.2)',
          },
        }),
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: 'rgba(75, 85, 99, 0.5)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '& fieldset': {
              borderColor: 'rgba(107, 114, 128, 0.3)',
              borderWidth: '1px',
            },
            '&:hover': {
              backgroundColor: 'rgba(75, 85, 99, 0.7)',
              '& fieldset': {
                borderColor: 'rgba(107, 70, 193, 0.5)',
              },
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(75, 85, 99, 0.8)',
              boxShadow: '0 0 0 4px rgba(107, 70, 193, 0.1)',
              '& fieldset': {
                borderColor: '#6B46C1',
                borderWidth: '2px',
              },
            },
          },
          '& .MuiInputLabel-root': {
            color: '#D1D5DB',
            fontWeight: 500,
            '&.Mui-focused': {
              color: '#6B46C1',
            },
          },
          '& .MuiOutlinedInput-input': {
            color: '#F9FAFB',
            fontWeight: 500,
          },
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          background: 'rgba(31, 41, 55, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(107, 70, 193, 0.2)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }),
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiTabs-indicator': {
            background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
            height: '3px',
            borderRadius: '2px',
          },
        }),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.95rem',
          color: '#D1D5DB',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            color: '#6B46C1',
            backgroundColor: 'rgba(107, 70, 193, 0.1)',
          },
          '&.Mui-selected': {
            color: '#6B46C1',
          },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '8px',
          fontWeight: 600,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }),
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '12px',
          backgroundColor: 'rgba(31, 41, 55, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(107, 70, 193, 0.1)',
        }),
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiTableCell-head': {
            backgroundColor: 'rgba(107, 70, 193, 0.1)',
            fontWeight: 700,
            fontSize: '0.875rem',
            color: '#F9FAFB',
            borderBottom: '1px solid rgba(107, 70, 193, 0.2)',
          },
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&:hover': {
            backgroundColor: 'rgba(107, 70, 193, 0.05)',
          },
          '&:not(:last-child)': {
            borderBottom: '1px solid rgba(107, 70, 193, 0.1)',
          },
        }),
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: '#6B46C1',
        }),
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }),
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
});

// Extend the theme to include custom colors
declare module '@mui/material/styles' {
  interface Palette {
    surface: Palette['primary'];
    gradient: {
      primary: string;
      secondary: string;
      glass: string;
    };
  }

  interface PaletteOptions {
    surface?: PaletteOptions['primary'];
    gradient?: {
      primary?: string;
      secondary?: string;
      glass?: string;
    };
  }
} 