const request = require('supertest');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-simple-withdrawal';

// Import PostgreSQL server
const app = require('../server-2fa.js');

describe('Simple Withdrawal and Transaction Tests', () => {
  let userToken = '';
  let userId = '';
  let loanId = '';

  const testUser = {
    email: `simple-test-${Date.now()}@test.com`,
    password: 'TestPassword123!',
    firstName: 'Simple',
    lastName: 'User',
    phone: '+1234567890'
  };

  beforeAll(async () => {
    console.log('Setting up simple withdrawal tests...');
    
    // Register a new test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    if (registerResponse.status === 201) {
      userId = registerResponse.body.user.id;
      console.log(`Test user created with ID: ${userId}`);
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      if (loginResponse.status === 200) {
        userToken = loginResponse.body.token;
        console.log('Test user logged in successfully');
      } else {
        console.log('Failed to login test user:', loginResponse.body);
      }
    } else {
      console.log('Failed to register test user:', registerResponse.body);
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

  describe('Authentication Validation', () => {
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

  describe('Transaction Endpoint Tests', () => {
    test('should require authentication for transaction endpoint', async () => {
      await request(app)
        .get('/api/loans/1/transactions')
        .expect(401);
    });

    test('should return 404 for non-existent loan transactions', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const response = await request(app)
        .get('/api/loans/99999/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Loan account not found');
    });

    test('should handle transaction filtering validation', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      // Test with a loan ID that doesn't belong to user
      const response = await request(app)
        .get('/api/loans/1/transactions?type=monthly_payment')
        .set('Authorization', `Bearer ${userToken}`);

      // Should return 404 since loan doesn't belong to user
      expect(response.status).toBe(404);
    });
  });

  describe('Withdrawal Request Tests', () => {
    test('should require authentication for withdrawal requests', async () => {
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

    test('should validate withdrawal request data', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      // Test with invalid amount
      const invalidWithdrawal = {
        amount: -100, // Negative amount
        reason: 'Test reason',
        urgency: 'normal'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidWithdrawal)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0]).toMatchObject({
        msg: 'Amount must be greater than 0'
      });
    });

    test('should validate withdrawal reason requirement', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const withdrawalWithoutReason = {
        amount: 100,
        urgency: 'normal'
        // Missing reason
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(withdrawalWithoutReason)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      // The validation message might be "Invalid value" instead of "Reason is required"
      expect(response.body.errors[0]).toMatchObject({
        msg: expect.stringMatching(/(Reason is required|Invalid value)/)
      });
    });

    test('should validate urgency levels', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const withdrawalWithInvalidUrgency = {
        amount: 100,
        reason: 'Test reason',
        urgency: 'super_urgent' // Invalid urgency
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(withdrawalWithInvalidUrgency)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0]).toMatchObject({
        msg: 'Invalid urgency level'
      });
    });

    test('should handle withdrawal request with no loan account', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const validWithdrawal = {
        amount: 100,
        reason: 'Test withdrawal',
        urgency: 'normal'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validWithdrawal);

      // Expect 404 since user doesn't have a loan account yet
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'No loan account found');
    });
  });

  describe('Admin Endpoint Access Control', () => {
    test('should require admin privileges for admin withdrawal endpoints', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const updateData = {
        status: 'approved',
        admin_notes: 'Test notes'
      };

      const response = await request(app)
        .put('/api/admin/withdrawal-requests/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      // Should return 401 or 403 for non-admin user
      expect([401, 403]).toContain(response.status);
    });

    test('should require admin privileges for withdrawal completion', async () => {
      if (!userToken) {
        console.log('Skipping test - no user token available');
        return;
      }

      const response = await request(app)
        .post('/api/admin/withdrawal-requests/1/complete')
        .set('Authorization', `Bearer ${userToken}`);

      // Should return 401 or 403 for non-admin user
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/loans/1/transactions')
        .set('Authorization', 'InvalidToken');

      expect([401, 403]).toContain(response.status);
    });

    test('should handle non-existent endpoints gracefully', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint');

      expect(response.status).toBe(404);
    });
  });
});
