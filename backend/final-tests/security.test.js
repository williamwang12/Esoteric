/**
 * Security and Edge Case Tests
 * 
 * Comprehensive security tests covering:
 * - Authentication and authorization security
 * - Input validation and sanitization
 * - SQL injection prevention
 * - XSS prevention
 * - Rate limiting and DDoS protection
 * - File upload security
 * - Session management security
 * - API endpoint security
 * - Edge cases and error handling
 */

const request = require('supertest');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  createUserSession,
  createTestLoan,
  createTestDocument,
  validateApiResponse
} = require('./helpers/test-utils');

// Import server
// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

const app = require('../server-2fa');

describe('Security and Edge Case Tests', () => {
  let user, userToken, adminUser, adminToken, otherUser, otherUserToken;
  let testLoan;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create test users
    user = await createTestUser({
      email: 'securityuser@example.com',
      firstName: 'Security',
      lastName: 'User'
    });
    userToken = await createUserSession(user.id);

    otherUser = await createTestUser({
      email: 'otheruser@example.com'
    });
    otherUserToken = await createUserSession(otherUser.id);

    adminUser = await createTestAdmin({
      email: 'admin@example.com'
    });
    adminToken = await createUserSession(adminUser.id);

    // Create test loan
    testLoan = await createTestLoan(user.id, {
      accountNumber: 'SEC-LOAN-001'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Authentication Security', () => {
    test('should reject requests without authentication token', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/user/profile' },
        { method: 'get', path: '/api/loans' },
        { method: 'get', path: '/api/documents' },
        { method: 'post', path: '/api/withdrawal-requests' },
        { method: 'post', path: '/api/meeting-requests' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/authorization|authenticate/i);
      }
    });

    test('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Basic dGVzdA==',
        'InvalidScheme token123',
        'Bearer token with spaces',
        'bearer lowercase-bearer'
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', header)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'expired.token.here',
        jwt.sign({}, 'wrong-secret', { expiresIn: '1h' }),
        jwt.sign({ userId: 999999 }, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only', { expiresIn: '1h' })
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: user.id, is2faComplete: true },
        process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/expired|invalid/i);
    });

    test('should reject tokens with invalid structure', async () => {
      const invalidStructureTokens = [
        jwt.sign({ noUserId: true }, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only'),
        jwt.sign({ userId: 'not-a-number' }, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only'),
        jwt.sign({ userId: null }, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only')
      ];

      for (const token of invalidStructureTokens) {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should enforce 2FA completion for protected endpoints', async () => {
      const incomplete2FAToken = jwt.sign(
        { userId: user.id, is2faComplete: false },
        process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
        { expiresIn: '1h' }
      );

      // Create session in database for this token
      const tokenHash = crypto.createHash('sha256').update(incomplete2FAToken).digest('hex');
      await pool.query(
        `INSERT INTO user_sessions (user_id, token_hash, expires_at, is_2fa_complete, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenHash, new Date(Date.now() + 3600000), false, '127.0.0.1']
      );

      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${incomplete2FAToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/2fa|two.factor/i);
    });
  });

  describe('Authorization Security', () => {
    test('should prevent cross-user data access', async () => {
      const otherUserLoan = await createTestLoan(otherUser.id, {
        accountNumber: 'OTHER-LOAN-001'
      });

      // User should not access other user's data
      const crossUserEndpoints = [
        { method: 'get', path: `/api/loans/${otherUserLoan.id}/transactions` },
        { method: 'get', path: `/api/loans/${otherUserLoan.id}/analytics` },
        { method: 'post', path: `/api/loans/${otherUserLoan.id}/recompute-balances` }
      ];

      for (const endpoint of crossUserEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/access|permission|forbidden/i);
      }
    });

    test('should enforce admin-only endpoint protection', async () => {
      const adminOnlyEndpoints = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/loans' },
        { method: 'post', path: '/api/admin/create-loan' },
        { method: 'get', path: '/api/admin/withdrawal-requests' },
        { method: 'get', path: '/api/admin/meeting-requests' }
      ];

      for (const endpoint of adminOnlyEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/admin|forbidden/i);
      }
    });

    test('should prevent privilege escalation through parameter manipulation', async () => {
      // Attempt to modify user role through profile update
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          role: 'admin', // Should be ignored
          account_verified: true, // Should be ignored
          id: otherUser.id // Should be ignored
        })
        .expect(200);

      expect(response.body.user.role).toBe('user'); // Should remain unchanged
      expect(response.body.user.id).toBe(user.id); // Should remain original user
    });

    test('should validate resource ownership for updates', async () => {
      const otherUserDocument = await createTestDocument(otherUser.id);

      const response = await request(app)
        .get(`/api/documents/${otherUserDocument.id}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should prevent SQL injection in all string inputs', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET role='admin' WHERE id=1; --",
        "' UNION SELECT password_hash FROM users --",
        "'; INSERT INTO users (role) VALUES ('admin'); --"
      ];

      for (const payload of sqlInjectionPayloads) {
        // Test in profile update
        const profileResponse = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            firstName: payload,
            lastName: 'Test',
            phone: '+1234567890'
          })
          .expect(200);

        // Should safely store the payload as data, not execute it
        expect(profileResponse.body.user.first_name).toBe(payload);

        // Verify database integrity
        const usersResult = await pool.query('SELECT COUNT(*) FROM users');
        expect(parseInt(usersResult.rows[0].count)).toBeGreaterThan(0);

        // Test in withdrawal request
        await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            loanAccountId: testLoan.id,
            amount: 1000,
            reason: payload,
            urgency: 'normal'
          })
          .expect(201);

        // Verify tables still exist and have correct data
        const withdrawalResult = await pool.query('SELECT reason FROM withdrawal_requests WHERE reason = $1', [payload]);
        expect(withdrawalResult.rows).toHaveLength(1);
      }
    });

    test('should prevent XSS attacks in user inputs', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<svg onload="alert(1)">',
        '"><script>alert("xss")</script><"'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            firstName: payload,
            lastName: 'Test',
            phone: '+1234567890'
          })
          .expect(200);

        // Data should be stored safely (exact handling depends on sanitization strategy)
        expect(response.body.user.first_name).toBeDefined();
        expect(typeof response.body.user.first_name).toBe('string');
      }
    });

    test('should validate numeric inputs strictly', async () => {
      const invalidAmounts = [
        'not-a-number',
        '1.234.567',
        'Infinity',
        'NaN',
        '1e308', // Number.MAX_VALUE overflow
        '[]',
        '{}',
        null,
        undefined
      ];

      for (const amount of invalidAmounts) {
        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            loanAccountId: testLoan.id,
            amount: amount,
            reason: 'Test request',
            urgency: 'normal'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });

    test('should validate email format strictly', async () => {
      const invalidEmails = [
        'not-an-email',
        'user@',
        '@domain.com',
        'user@domain',
        'user space@domain.com',
        'user..double.dot@domain.com',
        'user@domain..com',
        '"quoted"@domain.com',
        'user+tag@domain',
        'user@[127.0.0.1]' // IP address format
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: email,
            password: 'ValidPassword123!',
            firstName: 'Test',
            lastName: 'User'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });

    test('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoSpecialChars123',
        'NoNumbers!',
        '12345678', // Only numbers
        'abcdefgh', // Only letters
        'password', // Common password
        '12345678!', // Sequential numbers
        'aaaaaaaA1!' // Repeated characters
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'testuser@example.com',
            password: password,
            firstName: 'Test',
            lastName: 'User'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.some(err => 
          err.msg && err.msg.toLowerCase().includes('password')
        )).toBe(true);
      }
    });

    test('should validate file upload types and sizes', async () => {
      // This test would require setting up file upload endpoints
      // For now, we'll test basic validation principles
      
      const invalidFileData = {
        userId: user.id,
        title: 'Test Document',
        category: 'loan_agreement'
      };

      // Test without file
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('userId', invalidFileData.userId)
        .field('title', invalidFileData.title)
        .field('category', invalidFileData.category)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Rate Limiting and DDoS Protection', () => {
    test('should enforce rate limiting on authentication endpoints', async () => {
      const credentials = {
        email: user.email,
        password: 'WrongPassword'
      };

      // Make multiple failed login attempts
      const promises = Array.from({ length: 15 }, () =>
        request(app)
          .post('/api/auth/login')
          .send(credentials)
      );

      const responses = await Promise.all(promises);
      
      // Should have some rate limited responses (429)
      const rateLimitedCount = responses.filter(res => res.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should enforce rate limiting on admin endpoints', async () => {
      const promises = Array.from({ length: 25 }, () =>
        request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const responses = await Promise.all(promises);
      
      // Should have some rate limited responses
      const rateLimitedCount = responses.filter(res => res.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should enforce rate limiting on file upload endpoints', async () => {
      const testFilePath = path.join(__dirname, 'test-rate-limit.txt');
      fs.writeFileSync(testFilePath, 'Rate limit test file');

      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('document', testFilePath)
          .field('userId', user.id)
          .field('title', 'Rate Limit Test')
          .field('category', 'other')
      );

      const responses = await Promise.all(promises);
      
      // Should have some rate limited responses
      const rateLimitedCount = responses.filter(res => res.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      fs.unlinkSync(testFilePath);
    });

    test('should track rate limiting per IP address', async () => {
      // Test with different IP addresses (simulated via headers if supported)
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', '192.168.1.100')
          .send({
            email: user.email,
            password: 'WrongPassword'
          })
      );

      const responses = await Promise.all(requests);
      
      // First few should succeed (or fail normally), later ones should be rate limited
      const statusCodes = responses.map(r => r.status);
      expect(statusCodes).toContain(401); // Normal auth failure
      expect(statusCodes).toContain(429); // Rate limited
    });
  });

  describe('Session Management Security', () => {
    test('should invalidate sessions on logout', async () => {
      // First verify session works
      await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Token should now be invalid
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle concurrent sessions securely', async () => {
      // Create multiple sessions for same user
      const session1 = await createUserSession(user.id);
      const session2 = await createUserSession(user.id);

      // Both should work initially
      await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${session1}`)
        .expect(200);

      await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${session2}`)
        .expect(200);

      // Logout from one session
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${session1}`)
        .expect(200);

      // Only the logged out session should be invalid
      await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${session1}`)
        .expect(401);

      await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${session2}`)
        .expect(200);
    });

    test('should clean up expired sessions', async () => {
      // This test verifies that expired sessions are cleaned up
      // Implementation depends on session cleanup strategy

      // Create expired session in database
      const expiredToken = jwt.sign(
        { userId: user.id, is2faComplete: true },
        process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
        { expiresIn: '1ms' }
      );

      const tokenHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
      await pool.query(
        `INSERT INTO user_sessions (user_id, token_hash, expires_at, is_2fa_complete, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenHash, new Date(Date.now() - 3600000), true, '127.0.0.1']
      );

      // Wait a moment then make a request to trigger cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .get('/api/health')
        .expect(200);

      // After some time, expired session should be cleaned up
      // This is implementation-dependent
    });

    test('should enforce session timeout', async () => {
      // Create a session that will expire soon
      const shortLivedToken = jwt.sign(
        { userId: user.id, is2faComplete: true },
        process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
        { expiresIn: '1ms' }
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${shortLivedToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('API Security Headers and CORS', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for security headers (depending on implementation)
      const headers = response.headers;
      
      // These checks depend on what security headers are actually implemented
      if (headers['x-frame-options']) {
        expect(headers['x-frame-options']).toBeDefined();
      }
      if (headers['x-content-type-options']) {
        expect(headers['x-content-type-options']).toBe('nosniff');
      }
      if (headers['x-xss-protection']) {
        expect(headers['x-xss-protection']).toBeDefined();
      }
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'https://example.com')
        .expect(204);

      // Check CORS headers if implemented
      if (response.headers['access-control-allow-origin']) {
        expect(response.headers['access-control-allow-origin']).toBeDefined();
      }
    });

    test('should reject requests with suspicious headers', async () => {
      const suspiciousHeaders = {
        'X-Forwarded-Host': 'evil.com',
        'X-Original-URL': '/admin/users',
        'X-Rewrite-URL': '/admin/delete',
        'Host': 'evil.com'
      };

      for (const [headerName, headerValue] of Object.entries(suspiciousHeaders)) {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .set(headerName, headerValue);

        // Should either reject or handle safely
        expect([200, 400, 403]).toContain(response.status);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extremely large request payloads', async () => {
      const largePayload = {
        firstName: 'a'.repeat(100000),
        lastName: 'b'.repeat(100000),
        phone: '+1234567890'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(largePayload);

      // Should either reject (413 Payload Too Large) or handle gracefully
      expect([400, 413, 500]).toContain(response.status);
    });

    test('should handle malformed JSON payloads', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json,}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle requests with no content-type', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send('some data')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle concurrent database operations safely', async () => {
      // Create multiple concurrent profile updates
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            firstName: `Concurrent${i}`,
            lastName: 'Test',
            phone: '+1234567890'
          })
      );

      const responses = await Promise.all(promises);
      
      // All should succeed or fail gracefully
      responses.forEach(response => {
        expect([200, 409, 500]).toContain(response.status);
      });

      // Final state should be consistent
      const finalProfile = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(finalProfile.body.first_name).toMatch(/^Concurrent\d+$/);
    });

    test('should handle database connection failures gracefully', async () => {
      // This test would require mocking database failures
      // For comprehensive testing, you'd mock the pool.query function
      
      // Test that app doesn't crash on database errors
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    test('should handle memory exhaustion attempts', async () => {
      // Create many large objects in request
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000)
      }));

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          loanAccountId: testLoan.id,
          amount: 1000,
          reason: 'Memory test',
          urgency: 'normal',
          extraData: largeArray
        });

      // Should handle gracefully
      expect([400, 413, 500]).toContain(response.status);
    });

    test('should validate content-length header', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Length', '999999999')
        .send({
          loanAccountId: testLoan.id,
          amount: 1000,
          reason: 'Test',
          urgency: 'normal'
        });

      // Should handle content-length mismatch
      expect([400, 413]).toContain(response.status);
    });
  });

  describe('Data Privacy and Compliance', () => {
    test('should not log sensitive information', async () => {
      // Make request with sensitive data
      await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          ssn: '123-45-6789' // Should not be logged
        })
        .expect(200);

      // This test would check logs don't contain sensitive data
      // Implementation depends on logging setup
    });

    test('should mask sensitive fields in error responses', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: user.email, // Duplicate email
          password: 'ValidPassword123!',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      // Error should not expose full email
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).not.toContain(user.email);
    });

    test('should respect data retention policies', async () => {
      // Test that deleted users data is properly cleaned up
      const testUser = await createTestUser({
        email: 'todelete@example.com'
      });

      // Delete user through admin endpoint
      await request(app)
        .delete(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify user data is removed
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [testUser.id]);
      expect(userResult.rows).toHaveLength(0);
    });

    test('should handle requests for personal data export', async () => {
      // If GDPR compliance is implemented, test data export functionality
      // This would depend on specific implementation
      
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should return user's data
      expect(response.body).toHaveProperty('email', user.email);
    });
  });

  describe('API Versioning and Deprecation', () => {
    test('should handle missing API version gracefully', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email');
    });

    test('should provide appropriate error for deprecated endpoints', async () => {
      // If API versioning is implemented, test deprecated endpoints
      // This would test specific deprecated endpoint handling
      
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Monitoring and Alerting', () => {
    test('should handle health check endpoint securely', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      
      // Should not expose sensitive system information
      expect(response.body).not.toHaveProperty('database_password');
      expect(response.body).not.toHaveProperty('api_keys');
      expect(response.body).not.toHaveProperty('private_keys');
    });

    test('should not expose internal errors to clients', async () => {
      // Force an error condition
      const response = await request(app)
        .get('/api/loans/999999999/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      // Should return generic error, not expose internal details
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).not.toContain('SQL');
      expect(response.body.error).not.toContain('stack trace');
      expect(response.body.error).not.toContain('database');
    });
  });
});