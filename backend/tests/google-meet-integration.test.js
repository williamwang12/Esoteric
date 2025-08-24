const request = require('supertest');
const app = require('../server-2fa');

// Mock the Meeting service to avoid actual API calls during tests
jest.mock('../services/meetingService', () => ({
  createMeeting: jest.fn().mockResolvedValue({
    success: true,
    meeting: {
      id: 'mock-meeting-id',
      join_url: 'https://meet.google.com/abc-defg-hij',
      meeting_code: 'abc-defg-hij',
      topic: 'Test Meeting',
      start_time: '2024-01-15T10:00:00Z',
      duration: 60,
      provider: 'google_meet'
    }
  }),
  deleteMeeting: jest.fn().mockResolvedValue({ success: true })
}));

describe('Google Meet Integration', () => {
  let authToken;
  let adminToken;
  let meetingRequestId;

  beforeAll(async () => {
    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'zoomtest@example.com',
        password: 'TestPass123!',
        firstName: 'Zoom',
        lastName: 'Test',
        phone: '+1234567890'
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'zoomtest@example.com',
        password: 'TestPass123!'
      });

    authToken = loginResponse.body.token;

    // Create admin token (assuming admin@example.com exists)
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      });

    if (adminLoginResponse.status === 200) {
      adminToken = adminLoginResponse.body.token;
    }
  });

  test('Should create a meeting request for video call', async () => {
    const meetingData = {
      purpose: 'Test video consultation',
      preferred_date: '2024-12-25',
      preferred_time: '10:00',
      meeting_type: 'video',
      urgency: 'normal'
    };

    const response = await request(app)
      .post('/api/meeting-requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send(meetingData);

    expect(response.status).toBe(201);
    expect(response.body.request.meeting_type).toBe('video');
    meetingRequestId = response.body.request.id;
  });

  test('Should schedule video meeting with Google Meet integration', async () => {
    if (!adminToken || !meetingRequestId) {
      console.log('Skipping admin test - no admin token or meeting request');
      return;
    }

    const meetingService = require('../services/meetingService');
    
    const updateData = {
      status: 'scheduled',
      scheduled_date: '2024-12-25',
      scheduled_time: '10:00',
      admin_notes: 'Test video meeting with Google Meet'
    };

    const response = await request(app)
      .put(`/api/admin/meeting-requests/${meetingRequestId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.request.meeting_link).toBe('https://meet.google.com/abc-defg-hij');
    expect(meetingService.createMeeting).toHaveBeenCalledWith({
      topic: 'Test video consultation',
      start_time: '2024-12-25T10:00:00',
      duration: 60
    });
  });

  test('Should not create Google Meet for phone calls', async () => {
    if (!adminToken) {
      console.log('Skipping admin test - no admin token');
      return;
    }

    // Create phone meeting request
    const phoneRequestResponse = await request(app)
      .post('/api/meeting-requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        purpose: 'Test phone consultation',
        preferred_date: '2024-12-25',
        preferred_time: '11:00',
        meeting_type: 'phone',
        urgency: 'normal'
      });

    const phoneRequestId = phoneRequestResponse.body.request.id;
    const meetingService = require('../services/meetingService');
    meetingService.createMeeting.mockClear();

    // Schedule phone meeting
    const response = await request(app)
      .put(`/api/admin/meeting-requests/${phoneRequestId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'scheduled',
        scheduled_date: '2024-12-25',
        scheduled_time: '11:00',
        admin_notes: 'Phone consultation'
      });

    expect(response.status).toBe(200);
    expect(meetingService.createMeeting).not.toHaveBeenCalled();
  });
});

afterAll(async () => {
  // Cleanup test data if needed
  if (process.env.NODE_ENV === 'test') {
    // Add cleanup logic here if needed
  }
});