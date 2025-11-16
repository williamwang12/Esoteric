/**
 * Authentication Tests
 * 
 * Comprehensive tests for authentication endpoints including:
 * - User registration and login
 * - Two-Factor Authentication (2FA) 
 * - JWT token management
 * - Session handling
 * - Password security
 * - Rate limiting
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  generateJwtToken,
  createUserSession,
  setup2FA,
  generate2FAToken,
  validateApiResponse,
  delay
} = require('./helpers/test-utils');

// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

// Import server
const app = require('../server-2fa');

describe('Authentication Endpoints', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/auth/register', () => {
    test('should register new user with valid data', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      validateApiResponse(response, ['message', 'user', 'token']);
      
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).toHaveProperty('firstName', userData.firstName);
      expect(response.body.user).toHaveProperty('lastName', userData.lastName);
      expect(response.body.user).not.toHaveProperty('password_hash');
      expect(response.body.user.role).toBe('user');
      // Note: account_verified is not included in registration response
      
      // Verify user is in database
      const dbResult = await pool.query('SELECT * FROM users WHERE email = $1', [userData.email]);
      expect(dbResult.rows).toHaveLength(1);
      
      const dbUser = dbResult.rows[0];
      expect(bcrypt.compareSync(userData.password, dbUser.password_hash)).toBe(true);
    });

    test('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0]).toHaveProperty('msg');
    });

    test('should reject registration with weak password', async () => {
      const userData = {
        email: 'user@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.some(err => err.msg.includes('password'))).toBe(true);
    });

    test('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/already exists/i);
    });

    test('should reject registration with missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'incomplete@example.com'
          // Missing password, firstName, lastName
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login user with valid credentials', async () => {
      const user = await createTestUser({
        email: 'logintest@example.com',
        password: 'TestPassword123!'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password
        })
        .expect(200);

      validateApiResponse(response, ['message', 'token', 'user', 'requires2FA']);
      
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toHaveProperty('id', user.id);
      expect(response.body.requires2FA).toBe(false);
      expect(response.body.user).not.toHaveProperty('password_hash');

      // Verify JWT token
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('userId', user.id);
    });

    test('should login user requiring 2FA', async () => {
      const user = await createTestUser({
        email: 'login2fa@example.com',
        password: 'TestPassword123!',
        requires2fa: true
      });

      await setup2FA(user.id);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password
        })
        .expect(200);

      expect(response.body.requires2FA).toBe(true);
      expect(response.body.token).toBeDefined();
      
      // Verify token is not 2FA complete
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.is2faComplete).toBe(false);
    });

    test('should reject login with invalid credentials', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    test('should reject login for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject login with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'SomePassword123!'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should track login attempts and update last_login', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password
        })
        .expect(200);

      // Verify last_login was updated
      const dbResult = await pool.query(
        'SELECT last_login FROM users WHERE id = $1', 
        [user.id]
      );
      expect(dbResult.rows[0].last_login).toBeDefined();
    });
  });

  describe('POST /api/auth/verify-2fa', () => {
    test('should verify 2FA token and complete authentication', async () => {
      const user = await createTestUser({ requires2fa: true });
      const { secret } = await setup2FA(user.id);
      const sessionToken = await createUserSession(user.id, false);

      const totpToken = generate2FAToken(secret);

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ token: totpToken })
        .expect(200);

      validateApiResponse(response, ['message', 'token']);
      
      // Verify new token has 2FA complete
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.is2faComplete).toBe(true);
    });

    test('should verify backup code and complete authentication', async () => {
      const user = await createTestUser({ requires2fa: true });
      const { backupCodes } = await setup2FA(user.id);
      const sessionToken = await createUserSession(user.id, false);

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ token: backupCodes[0] })
        .expect(200);

      validateApiResponse(response, ['message', 'token']);
      
      // Verify backup code was consumed
      const dbResult = await pool.query(
        'SELECT backup_codes FROM user_2fa WHERE user_id = $1',
        [user.id]
      );
      const remainingCodes = dbResult.rows[0].backup_codes;
      expect(remainingCodes).not.toContain(backupCodes[0]);
    });

    test('should reject invalid 2FA token', async () => {
      const user = await createTestUser({ requires2fa: true });
      await setup2FA(user.id);
      const sessionToken = await createUserSession(user.id, false);

      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ token: '000000' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid/i);
    });

    test('should reject 2FA verification without session token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({ token: '123456' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should record 2FA attempt in database', async () => {
      const user = await createTestUser({ requires2fa: true });
      const { secret } = await setup2FA(user.id);
      const sessionToken = await createUserSession(user.id, false);
      const totpToken = generate2FAToken(secret);

      await request(app)
        .post('/api/auth/verify-2fa')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ token: totpToken })
        .expect(200);

      // Verify attempt was recorded
      const dbResult = await pool.query(
        'SELECT * FROM user_2fa_attempts WHERE user_id = $1',
        [user.id]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].success).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout user and invalidate session', async () => {
      const user = await createTestUser();
      const token = await createUserSession(user.id);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify session was invalidated
      const dbResult = await pool.query(
        'SELECT * FROM user_sessions WHERE token_hash = $1',
        [require('crypto').createHash('sha256').update(token).digest('hex')]
      );
      expect(dbResult.rows).toHaveLength(0);
    });

    test('should handle logout without valid session gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user data with valid token', async () => {
      const user = await createTestUser();
      const token = await createUserSession(user.id);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      validateApiResponse(response, ['id', 'email', 'first_name', 'last_name']);
      
      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
      expect(response.body).not.toHaveProperty('password_hash');
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject request with expired token', async () => {
      const user = await createTestUser();
      const expiredToken = jwt.sign(
        { userId: user.id, is2faComplete: true },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('should initiate password reset for valid email', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/reset/i);
    });

    test('should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      // Should return success for security reasons
      expect(response.body).toHaveProperty('message');
    });

    test('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limiting on login attempts', async () => {
      const user = await createTestUser();

      // Make multiple failed login attempts
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: 'WrongPassword'
          })
      );

      const responses = await Promise.all(promises);
      
      // Should have some rate limited responses
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should enforce rate limiting on 2FA verification attempts', async () => {
      const user = await createTestUser({ requires2fa: true });
      await setup2FA(user.id);
      const sessionToken = await createUserSession(user.id, false);

      // Make multiple failed 2FA attempts
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/verify-2fa')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send({ token: '000000' })
      );

      const responses = await Promise.all(promises);
      
      // Should have some rate limited responses
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    test('should create session on successful login', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password
        })
        .expect(200);

      // Verify session exists in database
      const dbResult = await pool.query(
        'SELECT * FROM user_sessions WHERE user_id = $1',
        [user.id]
      );
      expect(dbResult.rows).toHaveLength(1);
    });

    test('should clean up expired sessions', async () => {
      const user = await createTestUser();
      
      // Create expired session manually
      await pool.query(
        `INSERT INTO user_sessions (user_id, token_hash, expires_at, is_2fa_complete)
         VALUES ($1, $2, $3, $4)`,
        [user.id, 'expired-hash', new Date(Date.now() - 3600000), true]
      );

      // Make request to trigger cleanup
      await request(app)
        .get('/api/health')
        .expect(200);

      // Wait for cleanup
      await delay(1000);

      // Verify expired session was removed
      const dbResult = await pool.query(
        'SELECT * FROM user_sessions WHERE token_hash = $1',
        ['expired-hash']
      );
      expect(dbResult.rows).toHaveLength(0);
    });

    test('should handle multiple concurrent sessions for same user', async () => {
      const user = await createTestUser();

      // Create multiple login sessions
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password
        })
        .expect(200);

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password
        })
        .expect(200);

      expect(response1.body.token).toBeDefined();
      expect(response2.body.token).toBeDefined();
      expect(response1.body.token).not.toBe(response2.body.token);

      // Both tokens should work
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${response1.body.token}`)
        .expect(200);

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${response2.body.token}`)
        .expect(200);
    });
  });

  describe('Security Features', () => {
    test('should hash passwords securely', async () => {
      const password = 'TestPassword123!';
      const user = await createTestUser({ password });

      const dbResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [user.id]
      );

      const hash = dbResult.rows[0].password_hash;
      
      // Password should be hashed, not stored in plain text
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      expect(bcrypt.compareSync(password, hash)).toBe(true);
    });

    test('should not expose sensitive data in API responses', async () => {
      const user = await createTestUser();
      const token = await createUserSession(user.id);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Should not contain sensitive fields
      expect(response.body).not.toHaveProperty('password_hash');
      expect(response.body).not.toHaveProperty('email_verification_token');
      expect(response.body).not.toHaveProperty('temp_password');
    });

    test('should validate JWT token structure', async () => {
      const user = await createTestUser();
      const token = generateJwtToken(user.id);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('is2faComplete');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });
  });
});