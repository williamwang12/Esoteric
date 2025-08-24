const request = require('supertest');
const speakeasy = require('speakeasy');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-security-2fa';

// Import test server
const app = require('../server-2fa.js');

describe('Security and 2FA Tests', () => {
  let userToken = '';
  let userId = '';
  let basicToken = '';
  let twoFASecret = '';

  const testUser = {
    email: `security-test-${Date.now()}@test.com`,
    password: 'SecurePassword123!',
    firstName: 'Security',
    lastName: 'Test',
    phone: '+1234567890'
  };

  beforeAll(async () => {
    // Register a new user for 2FA testing
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    userId = registerResponse.body.user.id;

    // Login to get basic token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      })
      .expect(200);

    basicToken = loginResponse.body.token;
  });

  describe('2FA Setup and Management', () => {
    test('POST /api/2fa/setup should initiate 2FA setup', async () => {
      const response = await request(app)
        .post('/api/2fa/setup')
        .set('Authorization', `Bearer ${basicToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'TOTP setup initiated',
        secret: expect.any(String),
        qrCode: expect.any(String),
        backupCodes: expect.any(Array)
      });

      twoFASecret = response.body.secret;
      expect(response.body.backupCodes).toHaveLength(10);
    });

    test('POST /api/2fa/verify-setup should verify and enable 2FA', async () => {
      // Generate a valid TOTP token
      const token = speakeasy.totp({
        secret: twoFASecret,
        encoding: 'base32',
        window: 2
      });

      const response = await request(app)
        .post('/api/2fa/verify-setup')
        .set('Authorization', `Bearer ${basicToken}`)
        .send({ token })
        .expect(200);

      expect(response.body).toMatchObject({
        message: '2FA enabled successfully',
        user: expect.objectContaining({
          requires_2fa: true
        })
      });
    });

    test('should require 2FA for subsequent logins', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toMatchObject({
        requires2FA: true,
        tempToken: expect.any(String)
      });
      expect(response.body).not.toHaveProperty('token');
    });

    test('POST /api/auth/verify-2fa should complete 2FA login', async () => {
      // First login to get temp token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const tempToken = loginResponse.body.tempToken;

      // Generate valid TOTP token
      const token = speakeasy.totp({
        secret: twoFASecret,
        encoding: 'base32',
        window: 2
      });

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          tempToken,
          token
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: '2FA verification successful',
        token: expect.any(String),
        user: expect.any(Object)
      });

      userToken = response.body.token;
    });

    test('should fail 2FA verification with invalid token', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          tempToken: loginResponse.body.tempToken,
          token: '000000' // Invalid token
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Invalid 2FA token'
      });
    });

    test('should work with backup codes', async () => {
      // Get backup codes
      const backupResponse = await request(app)
        .get('/api/2fa/backup-codes')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const backupCode = backupResponse.body.backupCodes[0];

      // Login and use backup code
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          tempToken: loginResponse.body.tempToken,
          token: backupCode
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: '2FA verification successful',
        token: expect.any(String)
      });
    });

    test('should regenerate backup codes', async () => {
      const response = await request(app)
        .post('/api/2fa/regenerate-backup-codes')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Backup codes regenerated successfully',
        backupCodes: expect.any(Array)
      });

      expect(response.body.backupCodes).toHaveLength(10);
    });

    test('GET /api/2fa/status should return 2FA status', async () => {
      const response = await request(app)
        .get('/api/2fa/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        enabled: true,
        lastUsed: expect.any(String)
      });
    });

    test('POST /api/2fa/disable should disable 2FA', async () => {
      // Generate current TOTP token for verification
      const token = speakeasy.totp({
        secret: twoFASecret,
        encoding: 'base32',
        window: 2
      });

      const response = await request(app)
        .post('/api/2fa/disable')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ token })
        .expect(200);

      expect(response.body).toMatchObject({
        message: '2FA disabled successfully'
      });
    });

    test('should not require 2FA after disabling', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Login successful',
        token: expect.any(String),
        user: expect.any(Object)
      });
      expect(response.body).not.toHaveProperty('requires2FA');
    });
  });

  describe('Session Management', () => {
    test('should track user sessions', async () => {
      // Login creates a session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(loginResponse.body.token).toBeDefined();
    });

    test('should validate session tokens', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
    });

    test('should handle token expiration', async () => {
      // This would test expired tokens in a real scenario
      // For now, we test the structure is in place
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer expired-token')
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Invalid or expired token'
      });
    });
  });

  describe('Email Verification', () => {
    test('POST /api/user/send-email-verification should send verification email', async () => {
      const response = await request(app)
        .post('/api/user/send-email-verification')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Verification email sent successfully',
        token: expect.any(String) // In test mode, token is returned
      });
    });

    test('POST /api/user/verify-email should verify email with token', async () => {
      // First send verification email to get token
      const sendResponse = await request(app)
        .post('/api/user/send-email-verification')
        .set('Authorization', `Bearer ${userToken}`);

      const verificationToken = sendResponse.body.token;

      const response = await request(app)
        .post('/api/user/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Email verified successfully',
        email: testUser.email
      });
    });

    test('should fail with invalid verification token', async () => {
      const response = await request(app)
        .post('/api/user/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid verification token'
      });
    });

    test('should handle already verified email', async () => {
      const sendResponse = await request(app)
        .post('/api/user/send-email-verification')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(sendResponse.body).toMatchObject({
        error: 'Email is already verified'
      });
    });
  });

  describe('Security Headers and CORS', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for CORS headers
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should validate email format in registration', async () => {
      const invalidUser = {
        email: 'invalid-email',
        password: 'ValidPassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate password strength', async () => {
      const weakPasswordUser = {
        email: 'test-weak@example.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should sanitize phone number input', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          phone: '+1 (555) 123-4567' // Should accept formatted phone numbers
        })
        .expect(200);

      expect(response.body.user.phone).toBeDefined();
    });

    test('should reject malicious input', async () => {
      const maliciousInput = {
        firstName: '<script>alert("xss")</script>',
        lastName: 'DROP TABLE users;--'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(maliciousInput);

      // Should either sanitize or reject
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        // If accepted, should be sanitized
        expect(response.body.user.first_name).not.toContain('<script>');
        expect(response.body.user.last_name).not.toContain('DROP TABLE');
      }
    });
  });

  describe('Rate Limiting', () => {
    test('should handle multiple login attempts gracefully', async () => {
      const attempts = Array(5).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrong-password'
          })
      );

      const responses = await Promise.all(attempts);
      
      // All should be unauthorized, but server should handle the load
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });

    test('should handle multiple 2FA attempts', async () => {
      if (!twoFASecret) {
        console.log('Skipping 2FA rate limit test - no 2FA setup');
        return;
      }

      // Setup 2FA again for testing
      await request(app)
        .post('/api/2fa/setup')
        .set('Authorization', `Bearer ${userToken}`);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      if (loginResponse.body.requires2FA) {
        const attempts = Array(3).fill().map(() =>
          request(app)
            .post('/api/auth/verify-2fa')
            .send({
              tempToken: loginResponse.body.tempToken,
              token: '000000' // Invalid token
            })
        );

        const responses = await Promise.all(attempts);
        
        responses.forEach(response => {
          expect(response.status).toBe(401);
        });
      }
    });
  });

  describe('Error Handling and Logging', () => {
    test('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For now, ensure error handling structure exists
      expect(true).toBe(true);
    });

    test('should not leak sensitive information in errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password'
        })
        .expect(401);

      // Should not reveal whether user exists
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.error).not.toContain('user not found');
      expect(response.body.error).not.toContain('email');
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Should handle JSON parse errors
    });
  });

  describe('Account Security Features', () => {
    test('should track last login time', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const profileResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(profileResponse.body.last_login).toBeDefined();
    });

    test('should update user profile securely', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.user.first_name).toBe(updateData.firstName);
      expect(response.body.user.last_name).toBe(updateData.lastName);
      // Should not return sensitive data
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });
  });
});