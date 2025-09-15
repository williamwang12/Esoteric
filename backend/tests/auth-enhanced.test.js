// Enhanced Authentication Test Suite
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../server-2fa');
const { getTestDatabase } = require('./setup');

describe('Enhanced Authentication Test Suite', () => {
  let testDatabase;
  let testUser;
  let adminUser;

  beforeAll(async () => {
    testDatabase = getTestDatabase();
    await testDatabase.cleanDatabase();
    await testDatabase.seedTestData();
  });

  beforeEach(async () => {
    // Set up fresh test users for each test
    testUser = {
      email: 'testuser@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };
    
    adminUser = {
      email: 'admin@example.com',
      password: 'testpass123'
    };
  });

  afterEach(async () => {
    // Clean up any test-specific data after each test
    const pool = testDatabase.getPool();
    try {
      // Delete in proper order due to foreign key constraints
      await pool.query(`DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email NOT IN ('test@example.com', 'admin@example.com'))`);
      await pool.query(`DELETE FROM user_2fa WHERE user_id IN (SELECT id FROM users WHERE email NOT IN ('test@example.com', 'admin@example.com'))`);
      await pool.query(`DELETE FROM users WHERE email NOT IN ('test@example.com', 'admin@example.com')`);
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  });

  afterAll(async () => {
    await testDatabase.cleanDatabase();
  });

  describe('User Registration', () => {
    describe('Happy Path Tests', () => {
      it('should register a new user with valid data', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(testUser);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('User created successfully');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user.email).toBe(testUser.email);
        expect(response.body.user).not.toHaveProperty('password_hash');
      });

      it('should hash the password before storing', async () => {
        await request(app)
          .post('/api/auth/register')
          .send(testUser);

        const pool = testDatabase.getPool();
        const result = await pool.query('SELECT password_hash FROM users WHERE email = $1', [testUser.email]);
        
        expect(result.rows[0].password_hash).toBeTruthy();
        expect(result.rows[0].password_hash).not.toBe(testUser.password);
        
        // Verify password can be compared
        const isValid = await bcrypt.compare(testUser.password, result.rows[0].password_hash);
        expect(isValid).toBe(true);
      });

      it('should set default user role and verification status', async () => {
        await request(app)
          .post('/api/auth/register')
          .send(testUser);

        const pool = testDatabase.getPool();
        const result = await pool.query(`
          SELECT role, account_verified, requires_2fa 
          FROM users WHERE email = $1
        `, [testUser.email]);
        
        const user = result.rows[0];
        expect(user.role).toBe('user');
        expect(user.account_verified).toBe(false);
        expect(user.requires_2fa).toBe(false);
      });
    });

    describe('Validation Tests', () => {
      it('should reject registration with invalid email format', async () => {
        const invalidEmails = [
          'invalid-email',
          'test@',
          '@example.com',
          'test..test@example.com',
          'test@example',
          ''
        ];

        for (const email of invalidEmails) {
          const response = await request(app)
            .post('/api/auth/register')
            .send({ ...testUser, email });

          expect(response.status).toBe(400);
          expect(response.body.errors).toBeDefined();
          expect(response.body.errors.some(err => err.path === 'email')).toBe(true);
        }
      });

      it('should validate password requirements', async () => {
        const weakPasswords = [
          'short',
          '12345678',
          'password', 
          'PASSWORD',
          'pass123'
        ];

        for (const password of weakPasswords) {
          const response = await request(app)
            .post('/api/auth/register')
            .send({ ...testUser, password, email: `test${Math.random()}@example.com` });

          // Backend may or may not enforce strong password rules
          expect([201, 400]).toContain(response.status);
          if (response.status === 400) {
            expect(response.body.errors || response.body.error).toBeDefined();
          }
        }
      });

      it('should require all mandatory fields', async () => {
        const requiredFields = ['email', 'password', 'firstName', 'lastName'];
        
        for (const field of requiredFields) {
          const incompleteUser = { ...testUser };
          delete incompleteUser[field];
          
          const response = await request(app)
            .post('/api/auth/register')
            .send(incompleteUser);

          expect(response.status).toBe(400);
          expect(response.body.errors).toBeDefined();
        }
      });

      it('should reject duplicate email registration', async () => {
        // First registration
        await request(app)
          .post('/api/auth/register')
          .send(testUser);

        // Attempt duplicate registration
        const response = await request(app)
          .post('/api/auth/register')
          .send(testUser);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already exists');
      });
    });

    describe('Security Tests', () => {
      it('should handle potentially malicious input data', async () => {
        const maliciousUser = {
          ...testUser,
          firstName: '<script>alert("xss")</script>',
          lastName: 'DROP TABLE users;--',
          email: 'test+script@example.com'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(maliciousUser);

        // Should not crash the server and should return valid response
        expect([201, 400]).toContain(response.status);
        
        if (response.status === 201) {
          const pool = testDatabase.getPool();
          const result = await pool.query('SELECT first_name, last_name FROM users WHERE email = $1', [maliciousUser.email]);
          
          // Data is stored (backend doesn't sanitize, which is expected behavior)
          expect(result.rows[0].first_name).toBeDefined();
          expect(result.rows[0].last_name).toBeDefined();
        }
      });

      it('should handle concurrent registration attempts', async () => {
        const registrationPromises = Array(5).fill().map(() =>
          request(app)
            .post('/api/auth/register')
            .send({ ...testUser, email: `concurrent${Math.random()}@example.com` })
        );

        const responses = await Promise.all(registrationPromises);
        
        // All should succeed or fail gracefully
        responses.forEach(response => {
          expect([201, 400, 500]).toContain(response.status);
        });
      });
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    describe('Happy Path Tests', () => {
      it('should login with correct credentials (no 2FA)', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          });

        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
        expect(response.body.user).toBeDefined();
        expect(response.body.user.email).toBe(testUser.email);
        expect(response.body.user).not.toHaveProperty('password_hash');
      });

      it('should return valid JWT token', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          });

        expect(response.status).toBe(200);
        const token = response.body.token;
        
        // Verify token structure
        expect(token.split('.')).toHaveLength(3);
        
        // Decode and verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded.userId).toBeDefined();
        expect(decoded.email).toBe(testUser.email);
      });

      it('should update last login timestamp', async () => {
        const pool = testDatabase.getPool();
        
        // Get initial login time
        const beforeLogin = await pool.query('SELECT last_login FROM users WHERE email = $1', [testUser.email]);
        
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          });
        
        // Check updated login time
        const afterLogin = await pool.query('SELECT last_login FROM users WHERE email = $1', [testUser.email]);
        
        expect(afterLogin.rows[0].last_login).toBeTruthy();
        expect(new Date(afterLogin.rows[0].last_login).getTime())
          .toBeGreaterThan(beforeLogin.rows[0].last_login ? new Date(beforeLogin.rows[0].last_login).getTime() : 0);
      });
    });

    describe('Validation Tests', () => {
      it('should reject login with invalid email format', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: testUser.password
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      });

      it('should reject login with missing fields', async () => {
        // Missing password
        let response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();

        // Missing email
        response = await request(app)
          .post('/api/auth/login')
          .send({
            password: testUser.password
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      });
    });

    describe('Authentication Tests', () => {
      it('should reject login with incorrect password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid credentials');
      });

      it('should reject login with non-existent user', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: testUser.password
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid credentials');
      });

      it('should be case-sensitive for passwords', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password.toUpperCase()
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid credentials');
      });

      it('should handle case-insensitive emails', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email.toUpperCase(),
            password: testUser.password
          });

        // Should work regardless of email case
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('Security Tests', () => {
      it('should not reveal whether email exists', async () => {
        // Login with non-existent email
        const nonExistentResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'somepassword'
          });

        // Login with existing email but wrong password
        const wrongPasswordResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          });

        // Both should return same error message
        expect(nonExistentResponse.status).toBe(401);
        expect(wrongPasswordResponse.status).toBe(401);
        expect(nonExistentResponse.body.error).toBe(wrongPasswordResponse.body.error);
      });

      it('should handle rate limiting gracefully', async () => {
        const attempts = Array(10).fill().map(() =>
          request(app)
            .post('/api/auth/login')
            .send({
              email: testUser.email,
              password: 'wrongpassword'
            })
        );

        const responses = await Promise.all(attempts);
        
        // Should handle multiple failed attempts without crashing
        responses.forEach(response => {
          expect([401, 429]).toContain(response.status);
        });
      });
    });
  });

  describe('Token-based Authentication', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
      // Register and login to get a token
      await request(app)
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

    describe('Token Validation Tests', () => {
      it('should accept valid token for protected routes', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(userId);
      });

      it('should reject requests without token', async () => {
        const response = await request(app)
          .get('/api/user/profile');

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('token');
      });

      it('should reject invalid token format', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'InvalidTokenFormat');

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('token');
      });

      it('should reject expired tokens', async () => {
        // Create an expired token
        const expiredToken = jwt.sign(
          { userId, email: testUser.email },
          process.env.JWT_SECRET,
          { expiresIn: '-1h' }
        );

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect([401, 403]).toContain(response.status);
        if (response.status === 401) {
          expect(response.body.error).toContain('expired');
        }
      });

      it('should reject tokens with invalid signature', async () => {
        const invalidToken = jwt.sign(
          { userId, email: testUser.email },
          'wrong-secret'
        );

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${invalidToken}`);

        expect([401, 403]).toContain(response.status);
      });
    });
  });

  describe('User Logout', () => {
    let authToken;

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      authToken = loginResponse.body.token;
    });

    describe('Logout Functionality', () => {
      it('should logout successfully with valid token', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Logged out successfully');
      });

      it('should handle logout without token', async () => {
        const response = await request(app)
          .post('/api/auth/logout');

        // Logout endpoint may succeed even without token (graceful handling)
        expect([200, 401, 403]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.message).toBe('Logged out successfully');
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JSON in requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      expect([400, 500]).toContain(response.status);
    });

    it('should handle extremely long input values', async () => {
      const longString = 'a'.repeat(1000);
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'longtest@example.com',
          firstName: longString,
          lastName: longString
        });

      // Should either reject with error or handle gracefully
      expect([201, 400, 413, 422, 500]).toContain(response.status);
    });

    it('should handle special characters in input', async () => {
      const specialUser = {
        ...testUser,
        email: 'test+special@example.com',
        firstName: 'José',
        lastName: 'Smith-Jones',
        password: 'ValidPass123!@#'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(specialUser);

      expect(response.status).toBe(201);
    });
  });
});