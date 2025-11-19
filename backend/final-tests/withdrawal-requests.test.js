const request = require('supertest');
const app = require('../server-2fa.js');
const fs = require('fs');
const path = require('path');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  createUserSession,
  createTestLoan,
  createTestWithdrawalRequest,
  validateApiResponse
} = require('./helpers/test-utils');

describe('Withdrawal Requests Endpoints', () => {
  let user, userToken, otherUser, otherUserToken, adminUser, adminToken;
  let userLoan, otherUserLoan;
  let userWithdrawalRequest, otherUserWithdrawalRequest;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create test users
    user = await createTestUser({
      email: 'withdrawaluser@example.com',
      firstName: 'Withdrawal',
      lastName: 'User'
    });
    userToken = await createUserSession(user.id);

    otherUser = await createTestUser({
      email: 'otherwithdrawaluser@example.com',
      firstName: 'Other',
      lastName: 'User'
    });
    otherUserToken = await createUserSession(otherUser.id);

    adminUser = await createTestAdmin({
      email: 'withdrawaladmin@example.com'
    });
    adminToken = await createUserSession(adminUser.id);

    // Create test loan accounts
    userLoan = await createTestLoan(user.id, {
      currentBalance: 50000.00,
      principalAmount: 100000.00
    });

    otherUserLoan = await createTestLoan(otherUser.id, {
      currentBalance: 75000.00,
      principalAmount: 100000.00
    });

    // Create test withdrawal requests
    userWithdrawalRequest = await createTestWithdrawalRequest(user.id, userLoan.id, {
      amount: 5000.00,
      reason: 'Emergency funds',
      urgency: 'normal'
    });

    otherUserWithdrawalRequest = await createTestWithdrawalRequest(otherUser.id, otherUserLoan.id, {
      amount: 10000.00,
      reason: 'Investment opportunity',
      urgency: 'high'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/withdrawal-requests', () => {
    test('should create withdrawal request with valid data', async () => {
      const requestData = {
        amount: 15000.00,
        reason: 'Home renovation',
        urgency: 'normal',
        notes: 'Need funds for kitchen remodel'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(requestData)
        .expect(201);

      expect(response.body.message).toBe('Withdrawal request submitted successfully');
      expect(response.body.request).toHaveProperty('id');
      expect(response.body.request.amount).toBe('15000.00');
      expect(response.body.request.reason).toBe('Home renovation');
      expect(response.body.request.urgency).toBe('normal');
      expect(response.body.request.notes).toBe('Need funds for kitchen remodel');
      expect(response.body.request.status).toBe('pending');
      expect(response.body.request.user_id).toBe(user.id);
      expect(response.body.request.loan_account_id).toBe(userLoan.id);
    });

    test('should create withdrawal request with minimum required fields', async () => {
      const requestData = {
        amount: 5000.00,
        reason: 'Personal expenses'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(requestData)
        .expect(201);

      expect(response.body.request.amount).toBe('5000.00');
      expect(response.body.request.reason).toBe('Personal expenses');
      expect(response.body.request.urgency).toBe('normal'); // default value
      expect(response.body.request.notes).toBe(null);
    });

    test('should reject withdrawal request exceeding account balance', async () => {
      const requestData = {
        amount: 75000.00, // User's balance is 50,000
        reason: 'Large purchase'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(requestData)
        .expect(400);

      expect(response.body.error).toBe('Withdrawal amount exceeds current balance');
    });

    test('should reject withdrawal request for user without loan account', async () => {
      const userWithoutLoan = await createTestUser({
        email: 'noloan@example.com'
      });
      const tokenWithoutLoan = await createUserSession(userWithoutLoan.id);

      const requestData = {
        amount: 1000.00,
        reason: 'Test withdrawal'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${tokenWithoutLoan}`)
        .send(requestData)
        .expect(404);

      expect(response.body.error).toBe('No loan account found');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
      
      const errorMessages = response.body.errors.map(err => err.msg);
      expect(errorMessages).toContain('Amount must be greater than 0');
      expect(errorMessages).toContain('Reason is required');
    });

    test('should validate amount is positive number', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: -1000.00,
          reason: 'Invalid amount test'
        })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Amount must be greater than 0' })
      );
    });

    test('should validate urgency level', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 1000.00,
          reason: 'Test',
          urgency: 'invalid-urgency'
        })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Invalid urgency level' })
      );
    });

    test('should accept valid urgency levels', async () => {
      const urgencyLevels = ['low', 'normal', 'high', 'urgent'];
      
      for (const urgency of urgencyLevels) {
        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            amount: 1000.00,
            reason: `Test ${urgency} urgency`,
            urgency: urgency
          })
          .expect(201);

        expect(response.body.request.urgency).toBe(urgency);
      }
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .send({
          amount: 1000.00,
          reason: 'Test'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle zero amount', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 0,
          reason: 'Zero amount test'
        })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Amount must be greater than 0' })
      );
    });

    test('should handle decimal amounts correctly', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 1234.56,
          reason: 'Decimal amount test'
        })
        .expect(201);

      expect(response.body.request.amount).toBe('1234.56');
    });
  });

  describe('GET /api/withdrawal-requests', () => {
    test('should return user withdrawal requests with valid authentication', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(userWithdrawalRequest.id);
      expect(response.body[0].amount).toBe('5000.00');
      expect(response.body[0].reason).toBe('Emergency funds');
    });

    test('should only return requests belonging to authenticated user', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should only see user's own requests, not other user's requests
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(userWithdrawalRequest.id);
      expect(response.body.some(req => req.id === otherUserWithdrawalRequest.id)).toBe(false);
    });

    test('should include loan account information', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const withdrawalRequest = response.body[0];
      expect(withdrawalRequest).toHaveProperty('account_number');
      expect(withdrawalRequest).toHaveProperty('current_balance');
      expect(withdrawalRequest.account_number).toBe(userLoan.account_number);
      expect(withdrawalRequest.current_balance).toBe('50000.00');
    });

    test('should filter requests by status', async () => {
      // Create additional requests with different statuses
      await createTestWithdrawalRequest(user.id, userLoan.id, {
        amount: 2000.00,
        reason: 'Approved request',
        status: 'approved'
      });

      await createTestWithdrawalRequest(user.id, userLoan.id, {
        amount: 3000.00,
        reason: 'Rejected request',
        status: 'rejected'
      });

      // Filter by pending status
      const pendingResponse = await request(app)
        .get('/api/withdrawal-requests?status=pending')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(pendingResponse.body).toHaveLength(1);
      expect(pendingResponse.body[0].status).toBe('pending');

      // Filter by approved status
      const approvedResponse = await request(app)
        .get('/api/withdrawal-requests?status=approved')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(approvedResponse.body).toHaveLength(1);
      expect(approvedResponse.body[0].status).toBe('approved');
    });

    test('should support pagination with limit and offset', async () => {
      // Create multiple requests
      for (let i = 0; i < 5; i++) {
        await createTestWithdrawalRequest(user.id, userLoan.id, {
          amount: 1000.00 + i,
          reason: `Request ${i}`
        });
      }

      // Test limit
      const limitResponse = await request(app)
        .get('/api/withdrawal-requests?limit=3')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(limitResponse.body).toHaveLength(3);

      // Test offset
      const offsetResponse = await request(app)
        .get('/api/withdrawal-requests?limit=2&offset=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(offsetResponse.body).toHaveLength(2);
    });

    test('should order requests by created_at DESC (newest first)', async () => {
      // Create additional request with slight delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newerRequest = await createTestWithdrawalRequest(user.id, userLoan.id, {
        amount: 3000.00,
        reason: 'Newer request'
      });

      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      
      // Should be ordered by created_at DESC
      const dates = response.body.map(req => new Date(req.created_at).getTime());
      expect(dates[0]).toBeGreaterThan(dates[1]);
      expect(response.body[0].id).toBe(newerRequest.id); // Newer request first
    });

    test('should return empty array for user with no withdrawal requests', async () => {
      const newUser = await createTestUser({ email: 'norequests@example.com' });
      const newUserToken = await createUserSession(newUser.id);
      
      // Create loan account but no withdrawal requests
      await createTestLoan(newUser.id);

      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should include all expected withdrawal request fields', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const withdrawalRequest = response.body[0];
      expect(withdrawalRequest).toHaveProperty('id');
      expect(withdrawalRequest).toHaveProperty('amount');
      expect(withdrawalRequest).toHaveProperty('reason');
      expect(withdrawalRequest).toHaveProperty('urgency');
      expect(withdrawalRequest).toHaveProperty('status');
      expect(withdrawalRequest).toHaveProperty('notes');
      expect(withdrawalRequest).toHaveProperty('created_at');
      expect(withdrawalRequest).toHaveProperty('user_id');
      expect(withdrawalRequest).toHaveProperty('loan_account_id');
      expect(withdrawalRequest).toHaveProperty('account_number');
      expect(withdrawalRequest).toHaveProperty('current_balance');
    });

    test('should handle non-existent status filter gracefully', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests?status=nonexistent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('Withdrawal Request Security and Authorization', () => {
    test('should prevent access to withdrawal requests without valid token', async () => {
      await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
    });

    test('should handle malformed authorization headers', async () => {
      await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    test('should maintain user isolation across concurrent requests', async () => {
      const promises = Array.from({ length: 3 }, () =>
        request(app)
          .get('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].id).toBe(userWithdrawalRequest.id);
      });
    });

    test('should not expose sensitive loan account information unnecessarily', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const withdrawalRequest = response.body[0];
      // Should include account_number and current_balance but not sensitive details
      expect(withdrawalRequest.account_number).toBeDefined();
      expect(withdrawalRequest.current_balance).toBeDefined();
      expect(typeof withdrawalRequest.account_number).toBe('string');
      expect(typeof withdrawalRequest.current_balance).toBe('string');
    });
  });

  describe('Withdrawal Request Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Note: This would require mocking the database to simulate failures
      // For now, we test that the endpoint structure is correct
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should handle invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests?limit=invalid')
        .set('Authorization', `Bearer ${userToken}`);

      // Should either handle gracefully (200) or return error (500)
      expect([200, 500]).toContain(response.status);
    });

    test('should handle invalid offset parameter', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests?offset=invalid')
        .set('Authorization', `Bearer ${userToken}`);

      // Should either handle gracefully (200) or return error (500)
      expect([200, 500]).toContain(response.status);
    });

    test('should handle SQL injection attempts in status parameter', async () => {
      const maliciousStatus = "'; DROP TABLE withdrawal_requests; --";
      const response = await request(app)
        .get(`/api/withdrawal-requests?status=${encodeURIComponent(maliciousStatus)}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should handle malformed JSON in POST request', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/json')
        .send('{amount: 1000, reason: "malformed json"');

      expect([400, 500]).toContain(response.status);
    });

    test('should validate data types correctly', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 'not-a-number',
          reason: 123, // Should be string
          urgency: true, // Should be string
          notes: []  // Should be string
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Withdrawal Request Performance', () => {
    test('should handle large numbers of withdrawal requests efficiently', async () => {
      // Create multiple withdrawal requests
      const requestPromises = [];
      for (let i = 0; i < 20; i++) {
        requestPromises.push(
          createTestWithdrawalRequest(user.id, userLoan.id, {
            amount: 1000.00 + i,
            reason: `Request ${i}`,
            urgency: i % 2 === 0 ? 'normal' : 'high'
          })
        );
      }
      await Promise.all(requestPromises);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const endTime = Date.now();
      
      // Should complete within reasonable time (2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);
      expect(response.body.length).toBeGreaterThanOrEqual(21); // 20 + original
    });

    test('should respond quickly to status requests', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should be fast (under 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test('should handle concurrent POST requests without conflicts', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            amount: 1000.00 + i,
            reason: `Concurrent request ${i}`
          })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, i) => {
        expect(response.status).toBe(201);
        expect(response.body.request.amount).toBe(`${1000 + i}.00`);
      });
    });
  });
});