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
    // Check for existing auth data on app start
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    const loginTimestamp = localStorage.getItem('loginTimestamp');

    if (storedToken && storedUser && loginTimestamp) {
      const loginTime = parseInt(loginTimestamp);
      const currentTime = Date.now();
      const timeDiff = currentTime - loginTime;

      // Check if token is still valid (less than 1 hour old)
      if (timeDiff < 3600000) { // 1 hour in milliseconds
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Set up auto-logout for remaining time
        const remainingTime = 3600000 - timeDiff;
        const timer = setTimeout(() => {
          console.log('Auto-logout: Token expired after 1 hour');
          logout();
        }, remainingTime);
        setLogoutTimer(timer);
      } else {
        // Token has expired, clear storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('loginTimestamp');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await authApi.login({ email, password });
      
      // Check if 2FA is required
      if (response.requires_2fa) {
        // Return 2FA data without storing anything yet
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
      
      return { requires2FA: false };
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
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
      
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
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
      const response = await authApi.register(userData);
      
      const { user: newUser, token: authToken } = response;
      
      // Store in localStorage with timestamp
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      localStorage.setItem('loginTimestamp', Date.now().toString());
      
      // Update state
      setToken(authToken);
      setUser(newUser);
      
      // Setup auto-logout timer
      setupAutoLogout();
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
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