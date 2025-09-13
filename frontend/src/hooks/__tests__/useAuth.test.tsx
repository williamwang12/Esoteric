import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../useAuth';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock console.log to track auto-logout messages
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

// Mock authApi
jest.mock('../../services/api', () => ({
  authApi: {
    login: jest.fn(),
    complete2FALogin: jest.fn(),
    register: jest.fn(),
    logout: jest.fn().mockResolvedValue({}),
  },
}));

// Import the mocked module
import { authApi } from '../../services/api';

// Mock timers
jest.useFakeTimers();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth Auto-Logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Auto-logout timer', () => {
    it('should set up 1-hour auto-logout timer on login', async () => {
      (authApi.login as jest.Mock).mockResolvedValue({
        user: { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        token: 'mock-token',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      // Verify login timestamp was stored
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'loginTimestamp',
        expect.any(String)
      );

      // Fast-forward just under 1 hour - user should still be logged in
      act(() => {
        jest.advanceTimersByTime(3599000); // 59 minutes 59 seconds
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(mockConsoleLog).not.toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');

      // Fast-forward past 1 hour - should trigger auto-logout
      act(() => {
        jest.advanceTimersByTime(1000); // 1 more second = 1 hour total
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('loginTimestamp');
    });

    it('should clear auto-logout timer on manual logout', async () => {
      (authApi.login as jest.Mock).mockResolvedValue({
        user: { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        token: 'mock-token',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      // Manual logout before timer expires
      act(() => {
        result.current.logout();
      });

      // Fast-forward past 1 hour - should NOT trigger auto-logout since timer was cleared
      act(() => {
        jest.advanceTimersByTime(3600000);
      });

      expect(mockConsoleLog).not.toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Session persistence on app restart', () => {
    beforeEach(() => {
      Date.now = jest.fn();
    });

    afterEach(() => {
      (Date.now as jest.Mock).mockRestore();
    });

    it('should continue session if token is still valid on app restart', () => {
      const currentTime = 1640995200000; // Mock timestamp
      (Date.now as jest.Mock).mockReturnValue(currentTime);
      
      const loginTime = currentTime - 1800000; // 30 minutes ago
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'authToken': return 'valid-token';
          case 'user': return JSON.stringify({ id: '1', email: 'test@example.com' });
          case 'loginTimestamp': return loginTime.toString();
          default: return null;
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should restore session
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('test@example.com');

      // Should set up timer for remaining time (30 minutes)
      act(() => {
        jest.advanceTimersByTime(1800000); // 30 minutes
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should auto-logout if token has already expired on app restart', () => {
      const currentTime = 1640995200000; // Mock timestamp
      (Date.now as jest.Mock).mockReturnValue(currentTime);
      
      const loginTime = currentTime - 3700000; // 1 hour and 1 minute ago (expired)
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'authToken': return 'expired-token';
          case 'user': return JSON.stringify({ id: '1', email: 'test@example.com' });
          case 'loginTimestamp': return loginTime.toString();
          default: return null;
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should NOT restore session and should clear storage
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('loginTimestamp');
    });

    it('should not restore session if loginTimestamp is missing', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'authToken': return 'some-token';
          case 'user': return JSON.stringify({ id: '1', email: 'test@example.com' });
          case 'loginTimestamp': return null; // Missing timestamp
          default: return null;
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('2FA and Register flows', () => {
    it('should set up auto-logout timer after 2FA completion', async () => {
      (authApi.complete2FALogin as jest.Mock).mockResolvedValue({
        user: { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        token: 'mock-token-2fa',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.complete2FALogin('session-token', '123456');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('loginTimestamp', expect.any(String));

      // Fast-forward 1 hour to test auto-logout
      act(() => {
        jest.advanceTimersByTime(3600000);
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set up auto-logout timer after registration', async () => {
      (authApi.register as jest.Mock).mockResolvedValue({
        user: { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        token: 'mock-token-register',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.register({
          email: 'test@example.com',
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
        });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('loginTimestamp', expect.any(String));

      // Fast-forward 1 hour to test auto-logout
      act(() => {
        jest.advanceTimersByTime(3600000);
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple login attempts correctly (clear old timer)', async () => {
      (authApi.login as jest.Mock).mockResolvedValue({
        user: { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        token: 'mock-token',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // First login
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      // Fast-forward 30 minutes
      act(() => {
        jest.advanceTimersByTime(1800000);
      });

      // Second login (should reset timer)
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      // Fast-forward another 30 minutes (60 minutes total from first login, but only 30 from second)
      act(() => {
        jest.advanceTimersByTime(1800000);
      });

      // Should still be logged in (timer was reset on second login)
      expect(result.current.isAuthenticated).toBe(true);

      // Fast-forward another 30 minutes (should trigger logout - 1 hour from second login)
      act(() => {
        jest.advanceTimersByTime(1800000);
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});