import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  complete2FALogin: (sessionToken: string, totpToken: string) => Promise<any>;
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoutTimer, setLogoutTimer] = useState<NodeJS.Timeout | null>(null);

  const setupAutoLogout = () => {
    // Clear existing timer
    if (logoutTimer) {
      clearTimeout(logoutTimer);
    }

    // Set up new timer for 1 hour (3600000 ms)
    const timer = setTimeout(() => {
      console.log('Auto-logout: Token expired after 1 hour');
      logout();
    }, 3600000); // 1 hour

    setLogoutTimer(timer);
  };

  const clearAutoLogout = () => {
    if (logoutTimer) {
      clearTimeout(logoutTimer);
      setLogoutTimer(null);
    }
  };

  useEffect(() => {
    console.log('[AUTH] App initialization - checking stored auth data');
    // Check for existing auth data on app start
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    const loginTimestamp = localStorage.getItem('loginTimestamp');

    console.log('[AUTH] Initial storage check:', {
      hasToken: !!storedToken,
      hasUser: !!storedUser,
      hasTimestamp: !!loginTimestamp
    });

    if (storedToken && storedUser && loginTimestamp) {
      const loginTime = parseInt(loginTimestamp);
      const currentTime = Date.now();
      const timeDiff = currentTime - loginTime;

      console.log('[AUTH] Token age check:', { timeDiff, isValid: timeDiff < 3600000 });

      // Check if token is still valid (less than 1 hour old)
      if (timeDiff < 3600000) { // 1 hour in milliseconds
        console.log('[AUTH] Restoring authentication from localStorage');
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Set up auto-logout for remaining time
        const remainingTime = 3600000 - timeDiff;
        const timer = setTimeout(() => {
          console.log('Auto-logout: Token expired after 1 hour');
          logout();
        }, remainingTime);
        setLogoutTimer(timer);
        
        console.log('[AUTH] Authentication restored successfully');
      } else {
        console.log('[AUTH] Token expired, clearing storage');
        // Token has expired, clear storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('loginTimestamp');
      }
    } else {
      console.log('[AUTH] No stored authentication found');
    }
    
    console.log('[AUTH] Setting isLoading to false after initialization');
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await authApi.login({ email, password });
      
      // Check if 2FA is required
      if (response.requires_2fa) {
        // Return 2FA data without storing anything yet
        setIsLoading(false);
        return {
          requires2FA: true,
          sessionToken: response.session_token,
          user: response.user
        };
      }
      
      // Direct login (no 2FA)
      const { user: userData, token: authToken } = response;
      
      // Store in localStorage with timestamp
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('loginTimestamp', Date.now().toString());
      
      // Update state
      setToken(authToken);
      setUser(userData);
      
      // Setup auto-logout timer
      setupAutoLogout();
      
      setIsLoading(false);
      return { requires2FA: false };
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const complete2FALogin = async (sessionToken: string, totpToken: string) => {
    try {
      setIsLoading(true);
      const response = await authApi.complete2FALogin({
        session_token: sessionToken,
        totp_token: totpToken
      });
      
      const { user: userData, token: authToken } = response;
      
      // Store in localStorage with timestamp
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('loginTimestamp', Date.now().toString());
      
      // Update state
      setToken(authToken);
      setUser(userData);
      
      // Setup auto-logout timer
      setupAutoLogout();
      
      setIsLoading(false);
      return response;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => {
    try {
      setIsLoading(true);
      
      // Save debug logs to localStorage
      const debugLog = JSON.parse(localStorage.getItem('debugLog') || '[]');
      debugLog.push(`[${new Date().toISOString()}] [AUTH] Registration attempt: ${userData.email}`);
      localStorage.setItem('debugLog', JSON.stringify(debugLog));
      
      console.log('[AUTH] Registration attempt:', userData.email);
      const response = await authApi.register(userData);
      
      console.log('[AUTH] Registration response:', response);
      const { user: newUser, token: authToken } = response;
      
      // Add to persistent debug log
      debugLog.push(`[${new Date().toISOString()}] [AUTH] Registration response received`);
      debugLog.push(`[${new Date().toISOString()}] [AUTH] Response user: ${!!newUser}, token: ${!!authToken}`);
      localStorage.setItem('debugLog', JSON.stringify(debugLog));
      
      if (!newUser || !authToken) {
        console.error('[AUTH] Registration response missing user or token:', { user: newUser, token: authToken });
        debugLog.push(`[${new Date().toISOString()}] [AUTH] ERROR: Missing user or token in response`);
        localStorage.setItem('debugLog', JSON.stringify(debugLog));
        throw new Error('Registration response incomplete');
      }
      
      // Store in localStorage with timestamp
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      localStorage.setItem('loginTimestamp', Date.now().toString());
      
      console.log('[AUTH] Registration successful, localStorage updated');
      console.log('[AUTH] localStorage authToken:', localStorage.getItem('authToken'));
      console.log('[AUTH] localStorage user:', localStorage.getItem('user'));
      
      // Add to persistent debug log
      debugLog.push(`[${new Date().toISOString()}] [AUTH] localStorage updated successfully`);
      
      // Update state and wait for React to process the updates
      setToken(authToken);
      setUser(newUser);
      
      console.log('[AUTH] State updated - token set:', !!authToken);
      console.log('[AUTH] State updated - user set:', !!newUser);
      
      debugLog.push(`[${new Date().toISOString()}] [AUTH] React state updated - token: ${!!authToken}, user: ${!!newUser}`);
      
      // Setup auto-logout timer
      setupAutoLogout();
      
      // Set loading to false after all state updates are complete
      setIsLoading(false);
      
      console.log('[AUTH] Registration complete - isLoading set to false');
      console.log('[AUTH] Final authentication state:', { 
        hasToken: !!authToken, 
        hasUser: !!newUser, 
        isAuthenticated: !!(newUser && authToken) 
      });
      
      debugLog.push(`[${new Date().toISOString()}] [AUTH] Registration complete - final state: authenticated=${!!(newUser && authToken)}`);
      localStorage.setItem('debugLog', JSON.stringify(debugLog));
      
      // Wait for the next tick to ensure React state updates are committed
      await new Promise(resolve => setTimeout(resolve, 0));
      
    } catch (error) {
      console.error('[AUTH] Registration error:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const logout = () => {
    // Clear auto-logout timer
    clearAutoLogout();
    
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTimestamp');
    
    // Clear state
    setToken(null);
    setUser(null);
    
    // Optional: Call API to invalidate token on server
    try {
      if (authApi.logout) {
        authApi.logout().catch(() => {
          // Ignore logout API errors
        });
      }
    } catch (error) {
      // Ignore logout API errors
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const isAuthenticated = !!user && !!token;

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    complete2FALogin,
    register,
    logout,
    updateUser,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 