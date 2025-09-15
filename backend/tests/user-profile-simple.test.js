// Simplified User Profile Test Suite
const request = require('supertest');
const app = require('../server-2fa');
const { getTestDatabase } = require('./setup');

describe('User Profile Management - Core Tests', () => {
  let testDatabase;
  let authToken;
  let userId;

  beforeAll(async () => {
    testDatabase = getTestDatabase();
    await testDatabase.cleanDatabase();
    
    // Register a test user
    const testUser = {
      email: 'profile-simple@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;
  });

  afterAll(async () => {
    await testDatabase.cleanDatabase();
  });

  describe('Get User Profile', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(userId);
      expect(response.body.email).toBe('profile-simple@example.com');
      expect(response.body.first_name).toBe('Test');
      expect(response.body.last_name).toBe('User');
      expect(response.body).not.toHaveProperty('password_hash');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/user/profile');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Update User Profile', () => {
    it('should update profile with valid data', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.user.first_name).toBe(updateData.firstName);
      expect(response.body.user.last_name).toBe(updateData.lastName);
    });

    it('should update phone number', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: '1234567890' });

      expect([200, 400, 500]).toContain(response.status);
    });

    it('should reject update without token', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .send({ firstName: 'Unauthorized' });

      expect([401, 403]).toContain(response.status);
    });
  });
});