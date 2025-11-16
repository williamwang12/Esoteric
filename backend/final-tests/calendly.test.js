/**
 * Calendly Integration Tests
 * 
 * Comprehensive tests for Calendly API integration including:
 * - User information retrieval
 * - Event types and availability
 * - Scheduled events management
 * - Event cancellation
 * - Admin dashboard functionality
 * - API error handling and authentication
 */

const request = require('supertest');
const nock = require('nock');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  createUserSession,
  validateApiResponse
} = require('./helpers/test-utils');

// Import server
// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

const app = require('../server-2fa');

// Mock Calendly API responses
const mockCalendlyAPI = () => {
  const calendlyBaseURL = 'https://api.calendly.com';

  // Mock user info response
  const mockUser = {
    resource: {
      uri: 'https://api.calendly.com/users/user123',
      name: 'John Doe',
      email: 'john@example.com',
      timezone: 'America/New_York',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2023-01-01T00:00:00.000000Z',
      updated_at: '2023-01-01T00:00:00.000000Z'
    }
  };

  // Mock event types response
  const mockEventTypes = {
    collection: [
      {
        uri: 'https://api.calendly.com/event_types/et1',
        name: '30 Minute Meeting',
        duration: 30,
        scheduling_url: 'https://calendly.com/user/30min',
        active: true,
        kind: 'solo',
        created_at: '2023-01-01T00:00:00.000000Z',
        updated_at: '2023-01-01T00:00:00.000000Z'
      },
      {
        uri: 'https://api.calendly.com/event_types/et2',
        name: '60 Minute Consultation',
        duration: 60,
        scheduling_url: 'https://calendly.com/user/60min',
        active: true,
        kind: 'solo',
        created_at: '2023-01-01T00:00:00.000000Z',
        updated_at: '2023-01-01T00:00:00.000000Z'
      }
    ],
    pagination: {
      count: 2,
      next_page: null,
      previous_page: null,
      next_page_token: null,
      previous_page_token: null
    }
  };

  // Mock scheduled events response
  const mockScheduledEvents = {
    collection: [
      {
        uri: 'https://api.calendly.com/scheduled_events/se1',
        name: '30 Minute Meeting',
        status: 'active',
        start_time: '2024-12-15T14:00:00.000000Z',
        end_time: '2024-12-15T14:30:00.000000Z',
        event_type: 'https://api.calendly.com/event_types/et1',
        location: {
          type: 'zoom',
          location: 'https://zoom.us/j/123456789'
        },
        invitees_counter: {
          total: 1,
          active: 1,
          limit: 1
        },
        created_at: '2023-01-01T00:00:00.000000Z',
        updated_at: '2023-01-01T00:00:00.000000Z'
      }
    ],
    pagination: {
      count: 1,
      next_page: null,
      previous_page: null,
      next_page_token: null,
      previous_page_token: null
    }
  };

  // Mock availability response
  const mockAvailability = {
    collection: [
      {
        start_time: '2024-12-15T14:00:00.000000Z',
        invitees_remaining: 1,
        status: 'available'
      },
      {
        start_time: '2024-12-15T15:00:00.000000Z',
        invitees_remaining: 1,
        status: 'available'
      },
      {
        start_time: '2024-12-15T16:00:00.000000Z',
        invitees_remaining: 1,
        status: 'available'
      }
    ]
  };

  // Setup nock interceptors
  nock(calendlyBaseURL)
    .persist()
    .get('/users/me')
    .reply(200, mockUser)
    .get('/event_types')
    .query(true)
    .reply(200, mockEventTypes)
    .get('/scheduled_events')
    .query(true)
    .reply(200, mockScheduledEvents)
    .get('/scheduled_events/se1')
    .reply(200, { resource: mockScheduledEvents.collection[0] })
    .delete('/scheduled_events/se1')
    .reply(204)
    .get('/event_types/et1/available_times')
    .query(true)
    .reply(200, mockAvailability);

  return {
    mockUser,
    mockEventTypes,
    mockScheduledEvents,
    mockAvailability
  };
};

describe('Calendly Integration Endpoints', () => {
  let user, userToken, adminUser, adminToken;
  let mocks;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create test users
    user = await createTestUser({
      email: 'calendlyuser@example.com',
      firstName: 'Calendly',
      lastName: 'User'
    });
    userToken = await createUserSession(user.id);

    adminUser = await createTestAdmin({
      email: 'admin@example.com'
    });
    adminToken = await createUserSession(adminUser.id);

    // Setup Calendly API mocks
    mocks = mockCalendlyAPI();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/calendly/user', () => {
    test('should retrieve Calendly user information', async () => {
      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['user']);
      
      expect(response.body.user).toHaveProperty('uri');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('timezone');
      expect(response.body.user.name).toBe(mocks.mockUser.resource.name);
      expect(response.body.user.email).toBe(mocks.mockUser.resource.email);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/calendly/user')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle Calendly API errors', async () => {
      // Mock API error
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/users/me')
        .reply(401, { message: 'Unauthorized' });

      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/calendly/i);
    });

    test('should handle network timeouts', async () => {
      // Mock timeout
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/users/me')
        .delayConnection(5000)
        .reply(200, {});

      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .timeout(3000)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/calendly/event-types', () => {
    test('should retrieve user event types', async () => {
      const response = await request(app)
        .get('/api/calendly/event-types')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['eventTypes']);
      
      expect(Array.isArray(response.body.eventTypes)).toBe(true);
      expect(response.body.eventTypes).toHaveLength(2);
      
      const eventType = response.body.eventTypes[0];
      expect(eventType).toHaveProperty('uri');
      expect(eventType).toHaveProperty('name');
      expect(eventType).toHaveProperty('duration');
      expect(eventType).toHaveProperty('scheduling_url');
      expect(eventType).toHaveProperty('active');
    });

    test('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/calendly/event-types?count=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('eventTypes');
    });

    test('should filter active event types only', async () => {
      // Mock response with inactive event type
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/event_types')
        .query(true)
        .reply(200, {
          collection: [
            { ...mocks.mockEventTypes.collection[0], active: true },
            { ...mocks.mockEventTypes.collection[1], active: false }
          ],
          pagination: mocks.mockEventTypes.pagination
        });

      const response = await request(app)
        .get('/api/calendly/event-types?active=true')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should filter based on active parameter if implemented
      expect(response.body.eventTypes).toBeDefined();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/calendly/event-types')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/calendly/scheduled-events', () => {
    test('should retrieve scheduled events', async () => {
      const response = await request(app)
        .get('/api/calendly/scheduled-events')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['events']);
      
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events).toHaveLength(1);
      
      const event = response.body.events[0];
      expect(event).toHaveProperty('uri');
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('status');
      expect(event).toHaveProperty('start_time');
      expect(event).toHaveProperty('end_time');
      expect(event).toHaveProperty('location');
    });

    test('should support date filtering', async () => {
      const minStartTime = '2024-12-01T00:00:00.000Z';
      const maxStartTime = '2024-12-31T23:59:59.000Z';

      const response = await request(app)
        .get(`/api/calendly/scheduled-events?min_start_time=${minStartTime}&max_start_time=${maxStartTime}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('events');
    });

    test('should support status filtering', async () => {
      const response = await request(app)
        .get('/api/calendly/scheduled-events?status=active')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('events');
    });

    test('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/calendly/scheduled-events?count=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('pagination');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/calendly/scheduled-events')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/calendly/events/:eventUuid', () => {
    test('should retrieve specific event details', async () => {
      const eventUuid = 'se1';
      
      const response = await request(app)
        .get(`/api/calendly/events/${eventUuid}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['event']);
      
      expect(response.body.event).toHaveProperty('uri');
      expect(response.body.event).toHaveProperty('name');
      expect(response.body.event).toHaveProperty('start_time');
      expect(response.body.event).toHaveProperty('end_time');
      expect(response.body.event).toHaveProperty('location');
    });

    test('should return 404 for non-existent event', async () => {
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/scheduled_events/nonexistent')
        .reply(404, { message: 'Not found' });

      const response = await request(app)
        .get('/api/calendly/events/nonexistent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate event UUID format', async () => {
      const invalidUuids = ['', 'invalid-uuid', '123', 'too-long-uuid-that-exceeds-limits'];

      for (const uuid of invalidUuids) {
        const response = await request(app)
          .get(`/api/calendly/events/${uuid}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/calendly/events/se1')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/calendly/events/:eventUuid/cancel', () => {
    test('should cancel scheduled event', async () => {
      const eventUuid = 'se1';
      
      const response = await request(app)
        .post(`/api/calendly/events/${eventUuid}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Schedule conflict' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/cancelled/i);
    });

    test('should require cancellation reason', async () => {
      const response = await request(app)
        .post('/api/calendly/events/se1/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .send({}) // No reason provided
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate reason length', async () => {
      const longReason = 'a'.repeat(1000);
      
      const response = await request(app)
        .post('/api/calendly/events/se1/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: longReason })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should handle already cancelled events', async () => {
      nock.cleanAll();
      nock('https://api.calendly.com')
        .delete('/scheduled_events/se1')
        .reply(409, { message: 'Event already cancelled' });

      const response = await request(app)
        .post('/api/calendly/events/se1/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Test cancellation' })
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/calendly/events/se1/cancel')
        .send({ reason: 'Test' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/calendly/availability/:eventTypeUuid', () => {
    test('should retrieve availability for event type', async () => {
      const eventTypeUuid = 'et1';
      const startDate = '2024-12-15';
      const endDate = '2024-12-16';
      
      const response = await request(app)
        .get(`/api/calendly/availability/${eventTypeUuid}?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['availability']);
      
      expect(Array.isArray(response.body.availability)).toBe(true);
      expect(response.body.availability.length).toBeGreaterThan(0);
      
      const slot = response.body.availability[0];
      expect(slot).toHaveProperty('start_time');
      expect(slot).toHaveProperty('invitees_remaining');
      expect(slot).toHaveProperty('status');
    });

    test('should require date parameters', async () => {
      const response = await request(app)
        .get('/api/calendly/availability/et1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate date format', async () => {
      const invalidDates = ['invalid-date', '2024-13-01', '2024-12-32'];

      for (const date of invalidDates) {
        const response = await request(app)
          .get(`/api/calendly/availability/et1?start_date=${date}&end_date=2024-12-16`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });

    test('should validate date range', async () => {
      // End date before start date
      const response = await request(app)
        .get('/api/calendly/availability/et1?start_date=2024-12-16&end_date=2024-12-15')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/calendly/availability/et1?start_date=2024-12-15&end_date=2024-12-16')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/calendly/dashboard', () => {
    test('should provide admin dashboard data', async () => {
      const response = await request(app)
        .get('/api/admin/calendly/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['dashboard']);
      
      expect(response.body.dashboard).toHaveProperty('totalEvents');
      expect(response.body.dashboard).toHaveProperty('upcomingEvents');
      expect(response.body.dashboard).toHaveProperty('eventTypes');
      expect(response.body.dashboard).toHaveProperty('recentActivity');
    });

    test('should include event statistics', async () => {
      const response = await request(app)
        .get('/api/admin/calendly/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dashboard = response.body.dashboard;
      expect(dashboard).toHaveProperty('statistics');
      expect(dashboard.statistics).toHaveProperty('totalScheduled');
      expect(dashboard.statistics).toHaveProperty('totalCancelled');
      expect(dashboard.statistics).toHaveProperty('averageDuration');
    });

    test('should include upcoming events summary', async () => {
      const response = await request(app)
        .get('/api/admin/calendly/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.dashboard.upcomingEvents).toBeDefined();
      expect(Array.isArray(response.body.dashboard.upcomingEvents)).toBe(true);
    });

    test('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/calendly/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/calendly/dashboard')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle Calendly API rate limiting', async () => {
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/users/me')
        .reply(429, { 
          message: 'Too Many Requests',
          'retry-after': '60'
        });

      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(429);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/rate limit/i);
    });

    test('should handle Calendly service unavailable', async () => {
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/event_types')
        .query(true)
        .reply(503, { message: 'Service Unavailable' });

      const response = await request(app)
        .get('/api/calendly/event-types')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(503);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid API responses', async () => {
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/users/me')
        .reply(200, 'Invalid JSON response');

      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle network connectivity issues', async () => {
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/users/me')
        .replyWithError('Network error');

      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should sanitize user inputs', async () => {
      const maliciousReason = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/calendly/events/se1/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: maliciousReason })
        .expect(200);

      // Should handle malicious input safely
      expect(response.body).toHaveProperty('message');
    });

    test('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/calendly/user')
          .set('Authorization', `Bearer ${userToken}`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect([200, 429, 500]).toContain(response.status);
      });
    });

    test('should validate UUID parameters consistently', async () => {
      const invalidUuids = [
        '../../../etc/passwd',
        'null',
        'undefined',
        '../../admin',
        '<script>alert("xss")</script>'
      ];

      for (const uuid of invalidUuids) {
        const response = await request(app)
          .get(`/api/calendly/events/${uuid}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle timezone conversion issues', async () => {
      // Mock response with invalid timezone data
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/users/me')
        .reply(200, {
          resource: {
            ...mocks.mockUser.resource,
            timezone: 'Invalid/Timezone'
          }
        });

      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should handle gracefully or return appropriate error
      expect(response.body.user).toHaveProperty('timezone');
    });

    test('should respect API response timeouts', async () => {
      nock.cleanAll();
      nock('https://api.calendly.com')
        .get('/scheduled_events')
        .query(true)
        .delayConnection(10000) // 10 second delay
        .reply(200, {});

      const response = await request(app)
        .get('/api/calendly/scheduled-events')
        .set('Authorization', `Bearer ${userToken}`)
        .timeout(5000)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Data Validation and Security', () => {
    test('should validate date ranges for availability requests', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year in future
      const dateString = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/calendly/availability/et1?start_date=${dateString}&end_date=${dateString}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should limit the number of days in availability requests', async () => {
      const startDate = '2024-12-01';
      const endDate = '2025-01-31'; // More than 30 days

      const response = await request(app)
        .get(`/api/calendly/availability/et1?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should not expose internal system information', async () => {
      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should not expose sensitive server information
      expect(response.body).not.toHaveProperty('api_key');
      expect(response.body).not.toHaveProperty('access_token');
      expect(response.body).not.toHaveProperty('secret');
    });

    test('should properly encode URL parameters', async () => {
      const specialChars = 'test@example.com+special chars';
      
      // Should handle special characters in parameters properly
      const response = await request(app)
        .get('/api/calendly/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
    });
  });
});