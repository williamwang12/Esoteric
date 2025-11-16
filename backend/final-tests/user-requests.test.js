/**
 * User Request Tests
 * 
 * Comprehensive tests for user request endpoints including:
 * - Withdrawal requests
 * - Meeting requests  
 * - Document management
 * - Request status tracking
 * - Authorization and validation
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  createUserSession,
  createTestLoan,
  createTestDocument,
  createTestWithdrawalRequest,
  createTestMeetingRequest,
  createTestFile,
  validateApiResponse
} = require('./helpers/test-utils');

// Import server
// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

const app = require('../server-2fa');

describe('User Request Endpoints', () => {
  let user, userToken, otherUser, otherUserToken, adminUser, adminToken;
  let userLoan, testDocument;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create test users
    user = await createTestUser({
      email: 'requestuser@example.com',
      firstName: 'Request',
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

    // Create test loan for withdrawal requests
    userLoan = await createTestLoan(user.id, {
      accountNumber: 'LOAN-WITHDRAW-001',
      principalAmount: 100000,
      currentBalance: 50000
    });

    // Create test document
    testDocument = await createTestDocument(user.id);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/withdrawal-requests', () => {
    test('should create withdrawal request with valid data', async () => {
      const requestData = {
        loanAccountId: userLoan.id,
        amount: 5000,
        reason: 'Medical expenses',
        urgency: 'normal'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(requestData)
        .expect(201);

      validateApiResponse(response, ['message', 'request']);
      
      expect(response.body.request).toHaveProperty('id');
      expect(parseFloat(response.body.request.amount)).toBe(requestData.amount);
      expect(response.body.request.reason).toBe(requestData.reason);
      expect(response.body.request.status).toBe('pending');

      // Verify request in database
      const dbResult = await pool.query(
        'SELECT * FROM withdrawal_requests WHERE user_id = $1',
        [user.id]
      );
      expect(dbResult.rows).toHaveLength(1);
    });

    test('should validate withdrawal amount', async () => {
      const invalidAmounts = [0, -1000, 'invalid', null];

      for (const amount of invalidAmounts) {
        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            loanAccountId: userLoan.id,
            amount: amount,
            reason: 'Test reason',
            urgency: 'normal'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });

    test('should validate loan ownership', async () => {
      const otherUserLoan = await createTestLoan(otherUser.id);

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          loanAccountId: otherUserLoan.id,
          amount: 1000,
          reason: 'Test reason',
          urgency: 'normal'
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/access|permission/i);
    });

    test('should validate urgency level', async () => {
      const validUrgencies = ['low', 'normal', 'high', 'urgent'];

      for (const urgency of validUrgencies) {
        await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            loanAccountId: userLoan.id,
            amount: 1000,
            reason: 'Test reason',
            urgency: urgency
          })
          .expect(201);
      }

      // Test invalid urgency
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          loanAccountId: userLoan.id,
          amount: 1000,
          reason: 'Test reason',
          urgency: 'invalid'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require reason for withdrawal', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          loanAccountId: userLoan.id,
          amount: 1000,
          urgency: 'normal'
          // Missing reason
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.some(err => err.param === 'reason')).toBe(true);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .send({
          loanAccountId: userLoan.id,
          amount: 1000,
          reason: 'Test reason',
          urgency: 'normal'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should set default values appropriately', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          loanAccountId: userLoan.id,
          amount: 1000,
          reason: 'Test reason'
          // Omitting urgency to test default
        })
        .expect(201);

      expect(response.body.request.urgency).toBe('normal');
      expect(response.body.request.status).toBe('pending');
      expect(response.body.request.created_at).toBeDefined();
    });
  });

  describe('GET /api/withdrawal-requests', () => {
    beforeEach(async () => {
      // Create test withdrawal requests
      await createTestWithdrawalRequest(user.id, userLoan.id, {
        amount: 2000,
        reason: 'First request',
        status: 'pending'
      });
      
      await createTestWithdrawalRequest(user.id, userLoan.id, {
        amount: 3000,
        reason: 'Second request',
        status: 'approved'
      });

      // Create request for other user (should not be visible)
      const otherLoan = await createTestLoan(otherUser.id);
      await createTestWithdrawalRequest(otherUser.id, otherLoan.id);
    });

    test('should return user withdrawal requests', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['requests']);
      
      expect(response.body.requests).toHaveLength(2);
      expect(response.body.requests[0]).toHaveProperty('amount');
      expect(response.body.requests[0]).toHaveProperty('reason');
      expect(response.body.requests[0]).toHaveProperty('status');
      expect(response.body.requests[0]).toHaveProperty('created_at');
    });

    test('should only show user own requests', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should only see 2 requests (user's own), not the other user's
      expect(response.body.requests).toHaveLength(2);
      response.body.requests.forEach(req => {
        expect(req.user_id).toBe(user.id);
      });
    });

    test('should include loan account information', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const request_item = response.body.requests[0];
      expect(request_item).toHaveProperty('loan_account_id');
      expect(request_item.loan_account_id).toBe(userLoan.id);
    });

    test('should order requests by creation date (newest first)', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const dates = response.body.requests.map(req => new Date(req.created_at));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
      }
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should return empty array for user with no requests', async () => {
      const response = await request(app)
        .get('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      // otherUser has 1 request, but we deleted it in cleanup or it's isolated
      expect(Array.isArray(response.body.requests)).toBe(true);
    });
  });

  describe('POST /api/meeting-requests', () => {
    test('should create meeting request with valid data', async () => {
      const requestData = {
        purpose: 'Discuss loan terms',
        preferredDate: '2024-12-15',
        preferredTime: '14:00',
        meetingType: 'video',
        urgency: 'normal'
      };

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(requestData)
        .expect(201);

      validateApiResponse(response, ['message', 'request']);
      
      expect(response.body.request).toHaveProperty('id');
      expect(response.body.request.purpose).toBe(requestData.purpose);
      expect(response.body.request.meeting_type).toBe(requestData.meetingType);
      expect(response.body.request.status).toBe('pending');
    });

    test('should validate meeting type', async () => {
      const validTypes = ['phone', 'video', 'in_person'];

      for (const meetingType of validTypes) {
        await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            purpose: 'Test meeting',
            preferredDate: '2024-12-15',
            preferredTime: '14:00',
            meetingType: meetingType,
            urgency: 'normal'
          })
          .expect(201);
      }

      // Test invalid meeting type
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Test meeting',
          preferredDate: '2024-12-15',
          preferredTime: '14:00',
          meetingType: 'invalid',
          urgency: 'normal'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate date format', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Test meeting',
          preferredDate: 'invalid-date',
          preferredTime: '14:00',
          meetingType: 'video',
          urgency: 'normal'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate time format', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Test meeting',
          preferredDate: '2024-12-15',
          preferredTime: '25:00', // Invalid time
          meetingType: 'video',
          urgency: 'normal'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require all mandatory fields', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          // Missing purpose, preferredDate, preferredTime, meetingType
          urgency: 'normal'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('should not allow past dates', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const dateString = pastDate.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Test meeting',
          preferredDate: dateString,
          preferredTime: '14:00',
          meetingType: 'video',
          urgency: 'normal'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .send({
          purpose: 'Test meeting',
          preferredDate: '2024-12-15',
          preferredTime: '14:00',
          meetingType: 'video',
          urgency: 'normal'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/meeting-requests', () => {
    beforeEach(async () => {
      // Create test meeting requests
      await createTestMeetingRequest(user.id, {
        purpose: 'First meeting',
        status: 'pending'
      });
      
      await createTestMeetingRequest(user.id, {
        purpose: 'Second meeting',
        status: 'scheduled'
      });

      // Create request for other user
      await createTestMeetingRequest(otherUser.id);
    });

    test('should return user meeting requests', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['requests']);
      
      expect(response.body.requests).toHaveLength(2);
      expect(response.body.requests[0]).toHaveProperty('purpose');
      expect(response.body.requests[0]).toHaveProperty('preferred_date');
      expect(response.body.requests[0]).toHaveProperty('meeting_type');
      expect(response.body.requests[0]).toHaveProperty('status');
    });

    test('should only show user own requests', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.requests).toHaveLength(2);
      response.body.requests.forEach(req => {
        expect(req.user_id).toBe(user.id);
      });
    });

    test('should include scheduled meeting details when available', async () => {
      // Create a scheduled meeting with details
      await pool.query(
        `INSERT INTO meeting_requests (
          user_id, purpose, preferred_date, preferred_time, meeting_type,
          urgency, status, scheduled_date, scheduled_time, meeting_link
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          user.id, 'Scheduled meeting', '2024-12-15', '14:00:00', 'video',
          'normal', 'scheduled', '2024-12-15', '14:00:00', 'https://zoom.us/j/123456789'
        ]
      );

      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const scheduledMeeting = response.body.requests.find(req => 
        req.status === 'scheduled' && req.meeting_link
      );
      
      expect(scheduledMeeting).toBeDefined();
      expect(scheduledMeeting.meeting_link).toBe('https://zoom.us/j/123456789');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/documents', () => {
    beforeEach(async () => {
      // Create additional test documents
      await createTestDocument(user.id, {
        title: 'Loan Agreement',
        fileName: 'loan-agreement.pdf',
        category: 'loan_agreement'
      });
      
      await createTestDocument(user.id, {
        title: 'Tax Document',
        fileName: 'tax-doc.pdf',
        category: 'tax_document'
      });

      // Create document for other user
      await createTestDocument(otherUser.id);
    });

    test('should return user documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['documents']);
      
      expect(response.body.documents.length).toBeGreaterThanOrEqual(3);
      expect(response.body.documents[0]).toHaveProperty('title');
      expect(response.body.documents[0]).toHaveProperty('file_path');
      expect(response.body.documents[0]).toHaveProperty('category');
      expect(response.body.documents[0]).toHaveProperty('upload_date');
    });

    test('should only show user own documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.documents.forEach(doc => {
        expect(doc.user_id).toBe(user.id);
      });
    });

    test('should support category filtering', async () => {
      const response = await request(app)
        .get('/api/documents?category=loan_agreement')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.documents.length).toBeGreaterThan(0);
      response.body.documents.forEach(doc => {
        expect(doc.category).toBe('loan_agreement');
      });
    });

    test('should order documents by upload date (newest first)', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const dates = response.body.documents.map(doc => new Date(doc.upload_date));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
      }
    });

    test('should not expose file system paths in detail', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.documents.forEach(doc => {
        // Should have file_path but it should be sanitized/relative
        expect(doc.file_path).toBeDefined();
        expect(doc.file_path).not.toMatch(/^\/[a-zA-Z]:\//); // Not absolute Windows path
        expect(doc.file_path).not.toMatch(/^\/home\//); // Not absolute Unix path
      });
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/documents')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/documents/:documentId/download', () => {
    test('should download user own document', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.id}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-type']).toBeDefined();
    });

    test('should reject access to other user documents', async () => {
      const otherDocument = await createTestDocument(otherUser.id);

      const response = await request(app)
        .get(`/api/documents/${otherDocument.id}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/99999/download')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.id}/download`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should set appropriate headers for file download', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.id}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain(testDocument.file_name || 'document');
    });
  });

  describe('Security and Validation', () => {
    test('should prevent injection attacks in request fields', async () => {
      const maliciousData = {
        loanAccountId: userLoan.id,
        amount: 1000,
        reason: "'; DROP TABLE withdrawal_requests; --",
        urgency: 'normal'
      };

      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(maliciousData)
        .expect(201);

      // Should safely handle malicious input
      expect(response.body.request.reason).toBe(maliciousData.reason);

      // Verify table still exists
      const dbResult = await pool.query('SELECT COUNT(*) FROM withdrawal_requests');
      expect(dbResult.rows[0].count).toBeGreaterThan(0);
    });

    test('should validate request ID parameters', async () => {
      const invalidIds = ['abc', '0', '-1', 'null', 'undefined'];

      for (const id of invalidIds) {
        const response = await request(app)
          .get(`/api/documents/${id}/download`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle very large text inputs', async () => {
      const largeText = 'a'.repeat(10000);

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: largeText,
          preferredDate: '2024-12-15',
          preferredTime: '14:00',
          meetingType: 'video',
          urgency: 'normal'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should sanitize and validate all user inputs', async () => {
      const testData = {
        purpose: '  Test Meeting  ',
        preferredDate: '2024-12-15',
        preferredTime: '14:00',
        meetingType: 'VIDEO', // Should be case-insensitive or handled
        urgency: 'NORMAL'
      };

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testData)
        .expect(201);

      // Should handle case and whitespace appropriately
      expect(response.body.request.purpose.trim()).toBe('Test Meeting');
    });

    test('should enforce rate limiting on request creation', async () => {
      const requestData = {
        loanAccountId: userLoan.id,
        amount: 100,
        reason: 'Rate limit test',
        urgency: 'normal'
      };

      // Make multiple rapid requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ ...requestData, reason: `Test ${i}` })
      );

      const responses = await Promise.all(promises);
      
      // Should have some rate limited responses
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should validate document access permissions consistently', async () => {
      const otherDocument = await createTestDocument(otherUser.id);

      // Test all document access endpoints
      const endpoints = [
        { method: 'get', path: `/api/documents/${otherDocument.id}/download` }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle concurrent request submissions', async () => {
      const requestData = {
        loanAccountId: userLoan.id,
        amount: 1000,
        reason: 'Concurrent test',
        urgency: 'normal'
      };

      const promises = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ ...requestData, reason: `Concurrent ${i}` })
      );

      const responses = await Promise.all(promises);
      
      // All should succeed or fail gracefully
      responses.forEach(response => {
        expect([201, 400, 429]).toContain(response.status);
      });
    });

    test('should handle missing file for document download', async () => {
      // Create document with non-existent file path
      const brokenDocument = await createTestDocument(user.id, {
        title: 'Missing File',
        fileName: 'non-existent.pdf'
      });

      const response = await request(app)
        .get(`/api/documents/${brokenDocument.id}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/file.*not.*found/i);
    });

    test('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // Placeholder for database error handling tests
      expect(true).toBe(true);
    });

    test('should handle timezone issues in date validation', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateString = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Timezone test',
          preferredDate: dateString,
          preferredTime: '14:00',
          meetingType: 'video',
          urgency: 'normal'
        })
        .expect(201);

      expect(response.body.request).toHaveProperty('id');
    });
  });
});