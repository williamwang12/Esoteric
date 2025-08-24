const request = require('supertest');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-requests-simple';

// Import test server
const app = require('../server-2fa.js');

describe('Withdrawal and Meeting Requests API Tests (Simple)', () => {
  let userToken = '';
  let userId = '';
  let testLoanId = '';

  const testUser = {
    email: `test-requests-${Date.now()}@test.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    phone: '+1234567890'
  };

  beforeAll(async () => {
    // Register a new test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    if (registerResponse.status === 201) {
      userId = registerResponse.body.user.id;
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      if (loginResponse.status === 200) {
        userToken = loginResponse.body.token;
      }
    }
  });

  describe('Health Check', () => {
    test('should have working health endpoint', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Authentication Setup', () => {
    test('should have valid user token', () => {
      expect(userToken).toBeTruthy();
      expect(userId).toBeTruthy();
    });

    test('should access protected route with token', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
    });
  });

  describe('Basic Withdrawal Requests', () => {
    test('POST /api/withdrawal-requests should require authentication', async () => {
      const withdrawalData = {
        amount: 100,
        reason: 'Test reason',
        urgency: 'normal'
      };

      await request(app)
        .post('/api/withdrawal-requests')
        .send(withdrawalData)
        .expect(401);
    });

    test('GET /api/withdrawal-requests should require authentication', async () => {
      await request(app)
        .get('/api/withdrawal-requests')
        .expect(401);
    });

    test('should validate request data structure', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const invalidData = {
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData);

      // Should return validation error (400) or no loan account error (404)
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Basic Meeting Requests', () => {
    test('POST /api/meeting-requests should require authentication', async () => {
      const meetingData = {
        purpose: 'Test meeting',
        preferred_date: '2024-12-31',
        preferred_time: '14:30',
        meeting_type: 'video'
      };

      await request(app)
        .post('/api/meeting-requests')
        .send(meetingData)
        .expect(401);
    });

    test('GET /api/meeting-requests should require authentication', async () => {
      await request(app)
        .get('/api/meeting-requests')
        .expect(401);
    });

    test('should validate meeting data structure', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const invalidData = {
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData);

      // Should return validation error
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('Admin Endpoints Security', () => {
    test('should require admin authentication for withdrawal requests', async () => {
      await request(app)
        .get('/api/admin/withdrawal-requests')
        .expect(401);
    });

    test('should require admin authentication for meeting requests', async () => {
      await request(app)
        .get('/api/admin/meeting-requests')
        .expect(401);
    });

    test('should reject non-admin users for admin endpoints', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      // Regular user should not access admin endpoints
      const response = await request(app)
        .get('/api/admin/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`);

      // Should be forbidden (403) or unauthorized (401)
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Input Validation', () => {
    test('should validate withdrawal amount format', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const invalidData = {
        amount: 'not-a-number',
        reason: 'Test reason',
        urgency: 'normal'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData);

      // Should validate and reject invalid amount
      expect([400, 404]).toContain(response.status);
    });

    test('should validate meeting date format', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const invalidData = {
        purpose: 'Test meeting',
        preferred_date: 'invalid-date',
        preferred_time: '14:30',
        meeting_type: 'video'
      };

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    test('should validate urgency levels', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const invalidData = {
        amount: 100,
        reason: 'Test reason',
        urgency: 'invalid_urgency'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData);

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('API Response Structure', () => {
    test('withdrawal requests endpoint should return proper error structure', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Access token required');
    });

    test('meeting requests endpoint should return proper error structure', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Access token required');
    });

    test('admin endpoints should return proper error structure', async () => {
      const response = await request(app)
        .get('/api/admin/withdrawal-requests');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('CORS and Headers', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should handle OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/withdrawal-requests')
        .set('Origin', 'http://localhost:3000');

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      // Our error handler catches JSON parse errors and returns 500
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle missing Content-Type', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .send('plain text data');

      expect([400, 401]).toContain(response.status);
    });

    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});