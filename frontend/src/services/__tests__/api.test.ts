import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', { value: mockLocation });

// Mock console.log
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('API Auto-Logout Interceptor', () => {
  let mockAxios: MockAdapter;
  let api: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
    mockConsoleLog.mockClear();

    // Re-import to get fresh instance
    jest.resetModules();
    const apiModule = require('../api');
    api = apiModule.default || axios.create(); // Get the configured axios instance

    mockAxios = new MockAdapter(api);
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  afterEach(() => {
    mockAxios.restore();
  });

  describe('Response Interceptor', () => {
    it('should trigger auto-logout on 401 response', async () => {
      mockAxios.onGet('/test-endpoint').reply(401, { error: 'Unauthorized' });

      try {
        await api.get('/test-endpoint');
      } catch (error) {
        // Expected to throw
      }

      // Verify auto-logout behavior
      expect(mockConsoleLog).toHaveBeenCalledWith('Auto-logout: Received 401/403 response from server');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('loginTimestamp');
      expect(mockLocation.href).toBe('/login');
    });

    it('should trigger auto-logout on 403 response', async () => {
      mockAxios.onGet('/test-endpoint').reply(403, { error: 'Forbidden' });

      try {
        await api.get('/test-endpoint');
      } catch (error) {
        // Expected to throw
      }

      // Verify auto-logout behavior
      expect(mockConsoleLog).toHaveBeenCalledWith('Auto-logout: Received 401/403 response from server');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('loginTimestamp');
      expect(mockLocation.href).toBe('/login');
    });

    it('should NOT trigger auto-logout on other error codes', async () => {
      mockAxios.onGet('/test-endpoint').reply(500, { error: 'Internal Server Error' });

      try {
        await api.get('/test-endpoint');
      } catch (error) {
        // Expected to throw
      }

      // Verify auto-logout was NOT triggered
      expect(mockConsoleLog).not.toHaveBeenCalledWith('Auto-logout: Received 401/403 response from server');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(mockLocation.href).toBe('');
    });

    it('should NOT trigger auto-logout on successful responses', async () => {
      mockAxios.onGet('/test-endpoint').reply(200, { data: 'success' });

      const response = await api.get('/test-endpoint');

      expect(response.status).toBe(200);
      expect(mockConsoleLog).not.toHaveBeenCalledWith('Auto-logout: Received 401/403 response from server');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(mockLocation.href).toBe('');
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-auth-token');
      mockAxios.onGet('/test-endpoint').reply((config) => {
        expect(config.headers?.Authorization).toBe('Bearer test-auth-token');
        return [200, { data: 'success' }];
      });

      await api.get('/test-endpoint');
    });

    it('should not add Authorization header when token does not exist', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockAxios.onGet('/test-endpoint').reply((config) => {
        expect(config.headers?.Authorization).toBeUndefined();
        return [200, { data: 'success' }];
      });

      await api.get('/test-endpoint');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle token expiration during API call', async () => {
      // Setup: User has a token but it expires server-side
      mockLocalStorage.getItem.mockReturnValue('expired-token');
      mockAxios.onPost('/loans/1/transactions').reply(401, { error: 'Token expired' });

      try {
        await api.post('/loans/1/transactions', { amount: 1000 });
      } catch (error) {
        // Expected to throw
      }

      // Verify the token was added to request
      expect(mockAxios.history.post[0].headers?.Authorization).toBe('Bearer expired-token');

      // Verify auto-logout was triggered
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('loginTimestamp');
      expect(mockLocation.href).toBe('/login');
    });
  });
});