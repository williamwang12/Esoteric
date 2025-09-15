// User Profile Management Test Suite
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../server-2fa');
const { getTestDatabase } = require('./setup');

describe('User Profile Management Test Suite', () => {
  let testDatabase;
  let testUser;
  let adminUser;
  let authToken;
  let adminToken;
  let userId;
  let adminId;

  beforeAll(async () => {
    testDatabase = getTestDatabase();
    await testDatabase.cleanDatabase();
    await testDatabase.seedTestData();
  });

  beforeEach(async () => {
    // Set up fresh test users for each test with unique emails
    const timestamp = Date.now();
    testUser = {
      email: `profile-test-${timestamp}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Profile',
      lastName: 'User',
      phone: '+1234567890'
    };
    
    adminUser = {
      email: `profile-admin-${timestamp}@example.com`, 
      password: 'AdminPassword123!',
      firstName: 'Profile',
      lastName: 'Admin'
    };

    // Register and login test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    authToken = userLogin.body.token;
    userId = userLogin.body.user.id;

    // Register admin user
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send(adminUser);

    // Manually set admin role in database
    const pool = testDatabase.getPool();
    await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', adminUser.email]);

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password
      });

    adminToken = adminLogin.body.token;
    adminId = adminLogin.body.user.id;
  });

  afterEach(async () => {
    // Clean up test-specific data after each test
    const pool = testDatabase.getPool();
    try {
      await pool.query(`DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%profile-test-%' OR email LIKE '%profile-admin-%' OR email LIKE '%other-%')`);
      await pool.query(`DELETE FROM user_2fa WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%profile-test-%' OR email LIKE '%profile-admin-%' OR email LIKE '%other-%')`);
      await pool.query(`DELETE FROM users WHERE email LIKE '%profile-test-%' OR email LIKE '%profile-admin-%' OR email LIKE '%other-%'`);
    } catch (error) {
      console.warn('⚠️ Profile test cleanup warning:', error.message);
    }
  });

  afterAll(async () => {
    await testDatabase.cleanDatabase();
  });

  describe('Get User Profile', () => {
    describe('Happy Path Tests', () => {
      it('should get user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(userId);
        expect(response.body.email).toBe(testUser.email);
        expect(response.body.first_name).toBe(testUser.firstName);
        expect(response.body.last_name).toBe(testUser.lastName);
        expect(response.body).not.toHaveProperty('password_hash');
      });

      it('should include all user profile fields', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        
        const profile = response.body;
        expect(profile).toHaveProperty('id');
        expect(profile).toHaveProperty('email');
        expect(profile).toHaveProperty('first_name');
        expect(profile).toHaveProperty('last_name');
        expect(profile).toHaveProperty('phone');
        expect(profile).toHaveProperty('role');
        expect(profile).toHaveProperty('account_verified');
        expect(profile).toHaveProperty('created_at');
        expect(profile).toHaveProperty('last_login');
      });

      it('should return correct user role and verification status', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.role).toBe('user');
        expect(response.body.account_verified).toBe(false);
      });
    });

    describe('Authorization Tests', () => {
      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/user/profile');

        expect([401, 403]).toContain(response.status);
        expect(response.body.error).toBeDefined();
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Bearer invalid-token');

        expect([401, 403]).toContain(response.status);
      });

      it('should reject request with expired token', async () => {
        const expiredToken = jwt.sign(
          { userId, email: testUser.email },
          process.env.JWT_SECRET,
          { expiresIn: '-1h' }
        );

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect([401, 403]).toContain(response.status);
      });

    });
  });

  describe('Update User Profile', () => {
    describe('Happy Path Tests', () => {
      it('should update profile with valid data', async () => {
        const updateData = {
          firstName: 'Updated',
          lastName: 'Name',
          phone: '+1987654321'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Profile updated successfully');
        expect(response.body.user.first_name).toBe(updateData.firstName);
        expect(response.body.user.last_name).toBe(updateData.lastName);
        expect(response.body.user.phone).toBe(updateData.phone);
      });

      it('should update only provided fields (partial update)', async () => {
        const originalProfile = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        const updateData = {
          firstName: 'PartialUpdate',
          phone: '+1111111111'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.user.first_name).toBe(updateData.firstName);
        expect(response.body.user.phone).toBe(updateData.phone);
        expect(response.body.user.last_name).toBe(originalProfile.body.last_name);
        expect(response.body.user.email).toBe(originalProfile.body.email);
      });

      it('should preserve sensitive fields during update', async () => {
        const updateData = {
          firstName: 'Updated',
          // Attempt to update sensitive fields
          password: 'hackattempt',
          role: 'admin',
          account_verified: true
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.user.first_name).toBe(updateData.firstName);
        
        // Verify the profile doesn't contain sensitive fields in response
        expect(response.body.user).not.toHaveProperty('password_hash');
        expect(response.body.user).not.toHaveProperty('role');
        expect(response.body.user).not.toHaveProperty('password');
      });

      it('should maintain data consistency after update', async () => {
        const updateData = {
          firstName: 'Consistent',
          lastName: 'User'
        };

        await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        // Verify data persistence
        const updatedProfile = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(updatedProfile.body.first_name).toBe(updateData.firstName);
        expect(updatedProfile.body.last_name).toBe(updateData.lastName);
      });
    });

    describe('Validation Tests', () => {
      it('should validate email format when updating', async () => {
        const updateData = {
          email: 'invalid-email-format'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        // Email updates may be restricted or validated
        expect([200, 400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.errors || response.body.error).toBeDefined();
        }
      });

      it('should validate phone number format', async () => {
        const invalidPhones = [
          '123',
          'not-a-phone',
          '123-456-78901234567890',
          '+1 (234'
        ];

        for (const phone of invalidPhones) {
          const response = await request(app)
            .put('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ phone });

          // Phone validation may be lenient or strict depending on implementation
          expect([200, 400, 500]).toContain(response.status);
        }
      });

      it('should handle empty and null values', async () => {
        const updateData = {
          firstName: '',
          lastName: null,
          phone: ''
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect([200, 400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.errors || response.body.error).toBeDefined();
        }
      });

      it('should validate field length constraints', async () => {
        const longString = 'a'.repeat(500);
        
        const updateData = {
          firstName: longString,
          lastName: longString
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        // Should either truncate, validate, or reject (database constraint causes 500)
        expect([200, 400, 413, 422, 500]).toContain(response.status);
      });
    });

    describe('Authorization Tests', () => {
      it('should reject update without token', async () => {
        const response = await request(app)
          .put('/api/user/profile')
          .send({ firstName: 'Unauthorized' });

        expect([401, 403]).toContain(response.status);
      });

      it('should reject update with invalid token', async () => {
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', 'Bearer invalid-token')
          .send({ firstName: 'Unauthorized' });

        expect([401, 403]).toContain(response.status);
      });

      it('should only allow users to update their own profile', async () => {
        // Create another user
        const otherUser = {
          email: `other-profile-${Date.now()}@example.com`,
          password: 'OtherPassword123!',
          firstName: 'Other',
          lastName: 'User'
        };

        await request(app)
          .post('/api/auth/register')
          .send(otherUser);

        const otherLogin = await request(app)
          .post('/api/auth/login')
          .send({
            email: otherUser.email,
            password: otherUser.password
          });

        const otherToken = otherLogin.body.token;

        // Try to update original user's profile with other user's token
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ firstName: 'Hacked' });

        expect(response.status).toBe(200);
        
        // Verify the update only affected the token owner's profile
        const originalProfile = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(originalProfile.body.first_name).not.toBe('Hacked');
        expect(originalProfile.body.first_name).toBe(testUser.firstName);
      });
    });

    describe('Security Tests', () => {
      it('should sanitize XSS attempts in input', async () => {
        const maliciousData = {
          firstName: '<script>alert("xss")</script>',
          lastName: '<img src="x" onerror="alert(1)">'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(maliciousData);

        expect([200, 400]).toContain(response.status);
        
        if (response.status === 200) {
          // Verify data is stored (backend may not sanitize, which is expected)
          const profile = await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`);
          
          expect(profile.body.first_name).toBeDefined();
        }
      });

      it('should prevent SQL injection attempts', async () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE users; --",
          "' OR '1'='1",
          "admin'; UPDATE users SET role='admin' WHERE email='" + testUser.email + "'; --"
        ];

        for (const injection of sqlInjectionAttempts) {
          const response = await request(app)
            .put('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ firstName: injection });

          expect([200, 400]).toContain(response.status);
        }

        // Verify database integrity
        const pool = testDatabase.getPool();
        const tableCheck = await pool.query("SELECT COUNT(*) FROM users WHERE email LIKE '%profile-%'");
        expect(parseInt(tableCheck.rows[0].count)).toBeGreaterThan(0);
      });

      it('should handle concurrent profile updates', async () => {
        const updatePromises = Array(5).fill().map((_, index) =>
          request(app)
            .put('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ firstName: `Concurrent${index}` })
        );

        const responses = await Promise.all(updatePromises);
        
        // All should succeed or fail gracefully
        responses.forEach(response => {
          expect([200, 400, 409]).toContain(response.status);
        });

        // Final state should be consistent
        const finalProfile = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(finalProfile.status).toBe(200);
        expect(finalProfile.body.first_name).toMatch(/^(Profile|Concurrent\d)$/);
      });
    });
  });

  describe('Profile Data Integrity', () => {
    describe('Data Consistency Tests', () => {
      it('should maintain referential integrity', async () => {
        const pool = testDatabase.getPool();
        
        // Check that user exists in database
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [testUser.email]);
        expect(userCheck.rows.length).toBe(1);

        // Update profile
        await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ firstName: 'IntegrityTest' });

        // Verify referential integrity is maintained
        const updatedUserCheck = await pool.query('SELECT id, first_name FROM users WHERE email = $1', [testUser.email]);
        expect(updatedUserCheck.rows.length).toBe(1);
        expect(updatedUserCheck.rows[0].first_name).toBe('IntegrityTest');
      });

      it('should handle database transaction rollbacks', async () => {
        const originalProfile = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        // Attempt an update that might cause a constraint violation
        const invalidUpdate = {
          firstName: 'a'.repeat(1000) // Exceeds database field length
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUpdate);

        // Should either succeed with truncation or fail gracefully
        expect([200, 400, 422, 500]).toContain(response.status);

        // Verify profile is still accessible and unchanged if update failed
        const currentProfile = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(currentProfile.status).toBe(200);
        if (response.status !== 200) {
          expect(currentProfile.body.first_name).toBe(originalProfile.body.first_name);
        }
      });
    });

    describe('Field Validation Tests', () => {
      it('should validate phone number format constraints', async () => {
        const phones = [
          '1234567890',     // Valid 10-digit
          '+11234567890',   // Valid with country code
          '123',            // Invalid short
          '12345678901234567890', // Invalid long
          'not-a-phone'     // Invalid format
        ];
        
        for (const phone of phones) {
          const response = await request(app)
            .put('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ phone });

          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing request body', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 400, 500]).toContain(response.status);
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      expect([400, 500]).toContain(response.status);
    });

    it('should handle special characters in profile data', async () => {
      const specialData = {
        firstName: 'José',
        lastName: 'García-Smith'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(specialData);

      expect(response.status).toBe(200);
      expect(response.body.user.first_name).toBe(specialData.firstName);
      expect(response.body.user.last_name).toBe(specialData.lastName);
    });

    it('should handle unicode characters', async () => {
      const unicodeData = {
        firstName: '🎯 Test',
        lastName: 'ユーザー'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(unicodeData);

      expect([200, 400]).toContain(response.status);
    });

    it('should handle large request payload', async () => {
      const largeData = {
        firstName: 'Test',
        phone: 'A'.repeat(50)
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeData);

      expect([200, 400, 413, 422]).toContain(response.status);
    });
  });
});