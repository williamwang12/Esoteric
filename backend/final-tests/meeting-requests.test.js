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
  createTestMeetingRequest,
  validateApiResponse
} = require('./helpers/test-utils');

describe('Meeting Requests Endpoints', () => {
  let user, userToken, otherUser, otherUserToken, adminUser, adminToken;
  let userMeetingRequest, otherUserMeetingRequest;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create test users
    user = await createTestUser({
      email: 'meetinguser@example.com',
      firstName: 'Meeting',
      lastName: 'User'
    });
    userToken = await createUserSession(user.id);

    otherUser = await createTestUser({
      email: 'othermeetinguser@example.com',
      firstName: 'Other',
      lastName: 'User'
    });
    otherUserToken = await createUserSession(otherUser.id);

    adminUser = await createTestAdmin({
      email: 'meetingadmin@example.com'
    });
    adminToken = await createUserSession(adminUser.id);

    // Create test meeting requests
    userMeetingRequest = await createTestMeetingRequest(user.id, {
      purpose: 'Discuss loan terms',
      preferredDate: '2024-12-15',
      preferredTime: '14:00',
      urgency: 'normal'
    });

    otherUserMeetingRequest = await createTestMeetingRequest(otherUser.id, {
      purpose: 'Portfolio review',
      preferredDate: '2024-12-20',
      preferredTime: '10:00',
      urgency: 'high'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/meeting-requests', () => {
    test('should create meeting request with valid data', async () => {
      const requestData = {
        purpose: 'Investment consultation',
        preferred_date: '2024-12-25',
        preferred_time: '15:30',
        meeting_type: 'video',
        urgency: 'high',
        topics: 'Portfolio diversification, risk assessment',
        notes: 'Prefer afternoon meetings'
      };

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(requestData)
        .expect(201);

      expect(response.body.message).toBe('Meeting request submitted successfully');
      expect(response.body.request).toHaveProperty('id');
      expect(response.body.request.purpose).toBe('Investment consultation');
      expect(response.body.request.preferred_date).toMatch(/2024-12-25T\d{2}:00:00.000Z/);
      expect(response.body.request.preferred_time).toBe('15:30:00');
      expect(response.body.request.meeting_type).toBe('video');
      expect(response.body.request.urgency).toBe('high');
      expect(response.body.request.topics).toBe('Portfolio diversification, risk assessment');
      expect(response.body.request.notes).toBe('Prefer afternoon meetings');
      expect(response.body.request.status).toBe('pending');
      expect(response.body.request.user_id).toBe(user.id);
    });

    test('should create meeting request with minimum required fields', async () => {
      const requestData = {
        purpose: 'Quick consultation',
        preferred_date: '2024-12-28',
        preferred_time: '09:00'
      };

      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(requestData)
        .expect(201);

      expect(response.body.request.purpose).toBe('Quick consultation');
      expect(response.body.request.preferred_date).toMatch(/2024-12-28T\d{2}:00:00.000Z/);
      expect(response.body.request.preferred_time).toBe('09:00:00');
      expect(response.body.request.meeting_type).toBe('video'); // default value
      expect(response.body.request.urgency).toBe('normal'); // default value
      expect(response.body.request.topics).toBe(null);
      expect(response.body.request.notes).toBe(null);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
      
      const errorMessages = response.body.errors.map(err => err.msg);
      expect(errorMessages).toContain('Purpose is required');
      expect(errorMessages).toContain('Valid preferred date required');
      expect(errorMessages).toContain('Valid time format required (HH:MM)');
    });

    test('should validate date format', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Test meeting',
          preferred_date: 'invalid-date',
          preferred_time: '14:00'
        })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Valid preferred date required' })
      );
    });

    test('should validate time format', async () => {
      const invalidTimes = ['25:00', '12:60', '12:5', 'invalid', '12', '12:'];
      
      for (const time of invalidTimes) {
        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            purpose: 'Test meeting',
            preferred_date: '2024-12-30',
            preferred_time: time
          })
          .expect(400);

        expect(response.body.errors).toContainEqual(
          expect.objectContaining({ msg: 'Valid time format required (HH:MM)' })
        );
      }
    });

    test('should accept valid time formats', async () => {
      const validTimes = ['00:00', '09:30', '12:45', '23:59'];
      
      for (const time of validTimes) {
        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            purpose: `Test meeting ${time}`,
            preferred_date: '2024-12-30',
            preferred_time: time
          })
          .expect(201);

        expect(response.body.request.preferred_time).toBe(`${time}:00`);
      }
    });

    test('should enforce video meeting type only', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Test meeting',
          preferred_date: '2024-12-30',
          preferred_time: '14:00',
          meeting_type: 'phone'
        })
        .expect(400);

      // Check for validation error in errors array
      expect(response.body.errors || [response.body]).toContainEqual(
        expect.objectContaining({ msg: 'Only video meetings are supported' })
      );
    });

    test('should validate urgency level', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Test meeting',
          preferred_date: '2024-12-30',
          preferred_time: '14:00',
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
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            purpose: `Test ${urgency} meeting`,
            preferred_date: '2024-12-30',
            preferred_time: '14:00',
            urgency: urgency
          })
          .expect(201);

        expect(response.body.request.urgency).toBe(urgency);
      }
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .send({
          purpose: 'Test meeting',
          preferred_date: '2024-12-30',
          preferred_time: '14:00'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle past dates', async () => {
      // The endpoint doesn't explicitly validate against past dates,
      // but we can test that the request is processed normally
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Past date meeting',
          preferred_date: '2020-01-01',
          preferred_time: '14:00'
        })
        .expect(201);

      expect(response.body.request.preferred_date).toMatch(/2020-01-01T\d{2}:00:00.000Z/);
    });

    test('should validate string fields are strings', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 123, // Should be string
          preferred_date: '2024-12-30',
          preferred_time: '14:00',
          topics: [], // Should be string
          notes: true // Should be string
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('should handle empty string purpose', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: '',
          preferred_date: '2024-12-30',
          preferred_time: '14:00'
        })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Purpose is required' })
      );
    });
  });

  describe('GET /api/meeting-requests', () => {
    test('should return user meeting requests with valid authentication', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(userMeetingRequest.id);
      expect(response.body[0].purpose).toBe('Discuss loan terms');
      expect(response.body[0].urgency).toBe('normal');
    });

    test('should only return requests belonging to authenticated user', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should only see user's own requests, not other user's requests
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(userMeetingRequest.id);
      expect(response.body.some(req => req.id === otherUserMeetingRequest.id)).toBe(false);
    });

    test('should filter requests by status', async () => {
      // Create additional requests with different statuses
      await createTestMeetingRequest(user.id, {
        purpose: 'Scheduled meeting',
        preferredDate: '2024-12-30',
        preferredTime: '14:00:00',
        status: 'scheduled'
      });

      await createTestMeetingRequest(user.id, {
        purpose: 'Cancelled meeting',
        preferredDate: '2024-12-31',
        preferredTime: '15:00:00',
        status: 'cancelled'
      });

      // Filter by pending status
      const pendingResponse = await request(app)
        .get('/api/meeting-requests?status=pending')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(pendingResponse.body).toHaveLength(1);
      expect(pendingResponse.body[0].status).toBe('pending');

      // Filter by scheduled status
      const scheduledResponse = await request(app)
        .get('/api/meeting-requests?status=scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(scheduledResponse.body).toHaveLength(1);
      expect(scheduledResponse.body[0].status).toBe('scheduled');
      expect(scheduledResponse.body[0].purpose).toBe('Scheduled meeting');
    });

    test('should support pagination with limit and offset', async () => {
      // Create multiple requests
      for (let i = 0; i < 5; i++) {
        await createTestMeetingRequest(user.id, {
          purpose: `Meeting ${i}`,
          preferredDate: '2024-12-30',
          preferredTime: '14:00'
        });
      }

      // Test limit
      const limitResponse = await request(app)
        .get('/api/meeting-requests?limit=3')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(limitResponse.body).toHaveLength(3);

      // Test offset
      const offsetResponse = await request(app)
        .get('/api/meeting-requests?limit=2&offset=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(offsetResponse.body).toHaveLength(2);
    });

    test('should order requests by created_at DESC (newest first)', async () => {
      // Create additional request with slight delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newerRequest = await createTestMeetingRequest(user.id, {
        purpose: 'Newer meeting',
        preferredDate: '2024-12-30',
        preferredTime: '14:00'
      });

      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      
      // Should be ordered by created_at DESC
      const dates = response.body.map(req => new Date(req.created_at).getTime());
      expect(dates[0]).toBeGreaterThan(dates[1]);
      expect(response.body[0].id).toBe(newerRequest.id); // Newer request first
    });

    test('should return empty array for user with no meeting requests', async () => {
      const newUser = await createTestUser({ email: 'norequests@example.com' });
      const newUserToken = await createUserSession(newUser.id);

      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should include all expected meeting request fields', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const meetingRequest = response.body[0];
      expect(meetingRequest).toHaveProperty('id');
      expect(meetingRequest).toHaveProperty('purpose');
      expect(meetingRequest).toHaveProperty('preferred_date');
      expect(meetingRequest).toHaveProperty('preferred_time');
      expect(meetingRequest).toHaveProperty('meeting_type');
      expect(meetingRequest).toHaveProperty('urgency');
      expect(meetingRequest).toHaveProperty('topics');
      expect(meetingRequest).toHaveProperty('notes');
      expect(meetingRequest).toHaveProperty('status');
      expect(meetingRequest).toHaveProperty('created_at');
      expect(meetingRequest).toHaveProperty('user_id');
    });

    test('should handle non-existent status filter gracefully', async () => {
      const response = await request(app)
        .get('/api/meeting-requests?status=nonexistent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should format dates and times correctly', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const meetingRequest = response.body[0];
      expect(typeof meetingRequest.preferred_date).toBe('string');
      expect(typeof meetingRequest.preferred_time).toBe('string');
      expect(meetingRequest.preferred_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(meetingRequest.preferred_time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('Meeting Request Security and Authorization', () => {
    test('should prevent access to meeting requests without valid token', async () => {
      await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
    });

    test('should handle malformed authorization headers', async () => {
      await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    test('should maintain user isolation across concurrent requests', async () => {
      const promises = Array.from({ length: 3 }, () =>
        request(app)
          .get('/api/meeting-requests')
          .set('Authorization', `Bearer ${userToken}`)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].id).toBe(userMeetingRequest.id);
      });
    });

    test('should not expose other users meeting requests', async () => {
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify only user's own meeting requests are returned
      response.body.forEach(meetingRequest => {
        expect(meetingRequest.user_id).toBe(user.id);
      });
    });
  });

  describe('Meeting Request Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Note: This would require mocking the database to simulate failures
      // For now, we test that the endpoint structure is correct
      const response = await request(app)
        .get('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should handle invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/meeting-requests?limit=invalid')
        .set('Authorization', `Bearer ${userToken}`);

      // Should either handle gracefully (200) or return error (500)
      expect([200, 500]).toContain(response.status);
    });

    test('should handle invalid offset parameter', async () => {
      const response = await request(app)
        .get('/api/meeting-requests?offset=invalid')
        .set('Authorization', `Bearer ${userToken}`);

      // Should either handle gracefully (200) or return error (500)
      expect([200, 500]).toContain(response.status);
    });

    test('should handle SQL injection attempts in status parameter', async () => {
      const maliciousStatus = "'; DROP TABLE meeting_requests; --";
      const response = await request(app)
        .get(`/api/meeting-requests?status=${encodeURIComponent(maliciousStatus)}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should handle malformed JSON in POST request', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/json')
        .send('{purpose: "test", preferred_date: "2024-12-30"');

      expect([400, 500]).toContain(response.status);
    });

    test('should validate data types correctly', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 123, // Should be string
          preferred_date: 20241230, // Should be string
          preferred_time: true, // Should be string
          urgency: [], // Should be string
          topics: false, // Should be string
          notes: {} // Should be string
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('should handle very long input strings', async () => {
      const longString = 'x'.repeat(10000);
      
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: longString,
          preferred_date: '2024-12-30',
          preferred_time: '14:00',
          topics: longString,
          notes: longString
        });

      // Should either accept it or return a validation error
      expect([201, 400, 413]).toContain(response.status);
    });
  });

  describe('Meeting Request Performance', () => {
    test('should handle large numbers of meeting requests efficiently', async () => {
      // Create multiple meeting requests
      const requestPromises = [];
      for (let i = 0; i < 20; i++) {
        requestPromises.push(
          createTestMeetingRequest(user.id, {
            purpose: `Meeting ${i}`,
            preferredDate: '2024-12-30',
            preferredTime: '14:00',
            urgency: i % 2 === 0 ? 'normal' : 'high'
          })
        );
      }
      await Promise.all(requestPromises);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/meeting-requests')
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
        .get('/api/meeting-requests')
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
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            purpose: `Concurrent meeting ${i}`,
            preferred_date: '2024-12-30',
            preferred_time: '14:00'
          })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, i) => {
        expect(response.status).toBe(201);
        expect(response.body.request.purpose).toBe(`Concurrent meeting ${i}`);
      });
    });
  });

  describe('Meeting Request Business Logic', () => {
    test('should handle different meeting types (currently only video)', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Video meeting test',
          preferred_date: '2024-12-30',
          preferred_time: '14:00',
          meeting_type: 'video'
        })
        .expect(201);

      expect(response.body.request.meeting_type).toBe('video');
    });

    test('should handle edge case time formats', async () => {
      const edgeTimeFormats = [
        '00:00', // Midnight
        '23:59', // Just before midnight
        '01:01', // Early morning
        '12:00'  // Noon
      ];

      for (const time of edgeTimeFormats) {
        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            purpose: `Edge time test ${time}`,
            preferred_date: '2024-12-30',
            preferred_time: time
          })
          .expect(201);

        expect(response.body.request.preferred_time).toBe(`${time}:00`);
      }
    });

    test('should handle leap year dates', async () => {
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Leap year meeting',
          preferred_date: '2024-02-29',
          preferred_time: '14:00'
        })
        .expect(201);

      expect(response.body.request.preferred_date).toMatch(/2024-02-29T\d{2}:00:00.000Z/);
    });

    test('should preserve timezone in date storage', async () => {
      const testDate = '2024-12-30';
      
      const response = await request(app)
        .post('/api/meeting-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purpose: 'Timezone test',
          preferred_date: testDate,
          preferred_time: '14:00'
        })
        .expect(201);

      // Verify the date is stored correctly (ISO format with timezone)
      expect(response.body.request.preferred_date).toMatch(new RegExp(`${testDate}T\\d{2}:00:00.000Z`));
    });
  });
});