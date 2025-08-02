import { createTheme } from '@mui/material/styles';

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
      default: '#1F2937', // Matte black
      paper: '#374151', // Slightly lighter for cards
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
    },
    warning: {
      main: '#F59E0B',
    },
    success: {
      main: '#10B981',
    },
    info: {
      main: '#3B82F6',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      color: '#F9FAFB',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: '#F9FAFB',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      color: '#F9FAFB',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#F9FAFB',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: '#F9FAFB',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      color: '#F9FAFB',
    },
    body1: {
      fontSize: '1rem',
      color: '#F9FAFB',
    },
    body2: {
      fontSize: '0.875rem',
      color: '#D1D5DB',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#374151',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          border: '1px solid #4B5563',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 600,
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #6B46C1 0%, #9333EA 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #553C9A 0%, #7C3AED 100%)',
            boxShadow: '0 8px 20px rgba(107, 70, 193, 0.4)',
          },
        },
        outlined: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 600,
          padding: '12px 24px',
          borderColor: '#6B46C1',
          color: '#6B46C1',
          '&:hover': {
            borderColor: '#553C9A',
            backgroundColor: 'rgba(107, 70, 193, 0.1)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            backgroundColor: '#4B5563',
            '& fieldset': {
              borderColor: '#6B7280',
            },
            '&:hover fieldset': {
              borderColor: '#6B46C1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#6B46C1',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#D1D5DB',
            '&.Mui-focused': {
              color: '#6B46C1',
            },
          },
          '& .MuiOutlinedInput-input': {
            color: '#F9FAFB',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)',
          borderBottom: '1px solid #4B5563',
        },
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
  }

  interface PaletteOptions {
    surface?: PaletteOptions['primary'];
  }
} 