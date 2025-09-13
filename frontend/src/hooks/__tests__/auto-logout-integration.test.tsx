/**
 * Integration Test for Auto-Logout Functionality
 * This test demonstrates that the complete auto-logout system works as expected
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../useAuth';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock console.log to verify auto-logout messages
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

// Mock authApi with all required methods
jest.mock('../../services/api', () => ({
  authApi: {
    login: jest.fn(),
    complete2FALogin: jest.fn(), 
    register: jest.fn(),
    logout: jest.fn().mockResolvedValue({}),
  },
}));

import { authApi } from '../../services/api';

// Use fake timers
jest.useFakeTimers();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('Auto-Logout Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    jest.clearAllTimers();
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  it('Complete Auto-Logout Flow: Login → Timer → Expiration → Logout', async () => {
    // Mock successful login
    (authApi.login as jest.Mock).mockResolvedValue({
      user: { 
        id: '1', 
        email: 'test@example.com', 
        firstName: 'Test', 
        lastName: 'User' 
      },
      token: 'mock-jwt-token',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // ✅ Step 1: User successfully logs in
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    // Verify user is logged in
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');
    expect(result.current.token).toBe('mock-jwt-token');

    // Verify login data was stored with timestamp
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'mock-jwt-token');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('loginTimestamp', expect.any(String));
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user', expect.stringContaining('test@example.com'));

    // ✅ Step 2: User continues using the app (time passes)
    // Simulate 30 minutes of usage - user should still be logged in
    act(() => {
      jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(mockConsoleLog).not.toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');

    // Simulate another 25 minutes (55 minutes total) - still logged in
    act(() => {
      jest.advanceTimersByTime(25 * 60 * 1000); // 25 more minutes
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(mockConsoleLog).not.toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');

    // ✅ Step 3: Exactly 1 hour passes - auto-logout should trigger
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000); // 5 more minutes + 1 second = 1 hour + 1 second total
    });

    // Verify auto-logout occurred
    expect(mockConsoleLog).toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();

    // Verify localStorage was cleared
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('loginTimestamp');

    // ✅ Step 4: Verify subsequent timer advances don't cause additional logouts
    mockConsoleLog.mockClear();
    act(() => {
      jest.advanceTimersByTime(60 * 60 * 1000); // Another hour
    });

    expect(mockConsoleLog).not.toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
  });

  it('Manual Logout Cancels Auto-Logout Timer', async () => {
    // Setup: User logs in
    (authApi.login as jest.Mock).mockResolvedValue({
      user: { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      token: 'mock-jwt-token',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);

    // User manually logs out after 30 minutes
    act(() => {
      jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);

    // Advance time past when auto-logout would have occurred
    act(() => {
      jest.advanceTimersByTime(35 * 60 * 1000); // Another 35 minutes (65 total)
    });

    // Should NOT see auto-logout message since timer was cleared
    expect(mockConsoleLog).not.toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
  });

  it('App Restart with Valid Session Continues Auto-Logout', () => {
    const currentTime = 1640995200000; // Mock timestamp
    Date.now = jest.fn().mockReturnValue(currentTime);
    
    const loginTime = currentTime - (30 * 60 * 1000); // 30 minutes ago
    
    // Mock existing session data
    mockLocalStorage.getItem.mockImplementation((key) => {
      switch (key) {
        case 'authToken': return 'existing-token';
        case 'user': return JSON.stringify({ 
          id: '1', 
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });
        case 'loginTimestamp': return loginTime.toString();
        default: return null;
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Session should be restored
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');

    // Should auto-logout after remaining time (30 minutes)
    act(() => {
      jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes (1 hour total from login)
    });

    expect(mockConsoleLog).toHaveBeenCalledWith('Auto-logout: Token expired after 1 hour');
    expect(result.current.isAuthenticated).toBe(false);

    (Date.now as jest.Mock).mockRestore();
  });

  it('App Restart with Expired Session Auto-Cleans Up', () => {
    const currentTime = 1640995200000; // Mock timestamp
    Date.now = jest.fn().mockReturnValue(currentTime);
    
    const loginTime = currentTime - (65 * 60 * 1000); // 65 minutes ago (expired)
    
    mockLocalStorage.getItem.mockImplementation((key) => {
      switch (key) {
        case 'authToken': return 'expired-token';
        case 'user': return JSON.stringify({ id: '1', email: 'test@example.com' });
        case 'loginTimestamp': return loginTime.toString();
        default: return null;
      }
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Session should NOT be restored
    expect(result.current.isAuthenticated).toBe(false);
    
    // Should have cleaned up expired data
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('loginTimestamp');

    (Date.now as jest.Mock).mockRestore();
  });
});