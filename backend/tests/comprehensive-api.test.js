const request = require('supertest');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-comprehensive-api';
process.env.DB_NAME = 'esoteric_loans_test';

const app = require('../server-2fa.js');

describe('Comprehensive API Tests', () => {
  let pool;
  let regularUserToken = '';
  let adminUserToken = '';
  let testUserId = '';
  let adminUserId = '';
  let testLoanId = '';
  let testWithdrawalRequestId = '';
  let testMeetingRequestId = '';

  beforeAll(async () => {
    // Initialize database connection
    pool = new Pool({
      connectionString: `postgresql://${process.env.DB_USER || 'williamwang'}:${process.env.DB_PASSWORD || ''}@localhost:5432/esoteric_loans_test`,
      ssl: false
    });

    // Clean up existing test data
    await pool.query('DELETE FROM user_sessions WHERE 1=1');
    await pool.query('DELETE FROM user_2fa WHERE 1=1');
    await pool.query('DELETE FROM withdrawal_requests WHERE 1=1');
    await pool.query('DELETE FROM meeting_requests WHERE 1=1');
    await pool.query('DELETE FROM loan_transactions WHERE 1=1');
    await pool.query('DELETE FROM loan_accounts WHERE 1=1');
    await pool.query('DELETE FROM account_verification_requests WHERE 1=1');
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', ['test@example.com', 'admin@example.com']);

    // Create test users
    const hashedPassword = await bcrypt.hash('testpass123', 12);
    const hashedAdminPassword = await bcrypt.hash('adminpass123', 12);

    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role, account_verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['test@example.com', hashedPassword, 'Test', 'User', 'user', true]
    );
    testUserId = userResult.rows[0].id;

    const adminResult = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role, account_verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['admin@example.com', hashedAdminPassword, 'Admin', 'User', 'admin', true]
    );
    adminUserId = adminResult.rows[0].id;

    // Create test loan account
    const loanResult = await pool.query(
      'INSERT INTO loan_accounts (user_id, account_number, principal_amount, current_balance, monthly_rate) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [testUserId, 'TEST-LOAN-001', 10000.00, 10000.00, 0.01]
    );
    testLoanId = loanResult.rows[0].id;

    // Login test users
    const userLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpass123'
      });
    
    regularUserToken = userLoginResponse.body.token;

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'adminpass123'
      });
    
    adminUserToken = adminLoginResponse.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    if (pool) {
      await pool.query('DELETE FROM user_sessions WHERE 1=1');
      await pool.query('DELETE FROM user_2fa WHERE 1=1');
      await pool.query('DELETE FROM withdrawal_requests WHERE 1=1');
      await pool.query('DELETE FROM meeting_requests WHERE 1=1');
      await pool.query('DELETE FROM loan_transactions WHERE 1=1');
      await pool.query('DELETE FROM loan_accounts WHERE 1=1');
      await pool.query('DELETE FROM account_verification_requests WHERE 1=1');
      await pool.query('DELETE FROM users WHERE email IN ($1, $2)', ['test@example.com', 'admin@example.com']);
      await pool.end();
    }
  });

  describe('Health Check', () => {
    test('GET /api/health should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        database: 'connected',
        features: expect.arrayContaining(['2FA', 'JWT Sessions', 'TOTP', 'Backup Codes'])
      });
    });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      test('should register a new user', async () => {
        const userData = {
          email: 'newuser@example.com',
          password: 'newpass123',
          firstName: 'New',
          lastName: 'User',
          phone: '+1234567890'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'User created successfully',
          user: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: 'user'
          },
          token: expect.any(String)
        });

        // Clean up
        await pool.query('DELETE FROM users WHERE email = $1', ['newuser@example.com']);
      });

      test('should fail with duplicate email', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'testpass123',
          firstName: 'Test',
          lastName: 'User'
        };

        await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);
      });

      test('should fail with invalid email', async () => {
        const userData = {
          email: 'invalid-email',
          password: 'testpass123',
          firstName: 'Test',
          lastName: 'User'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });

    describe('POST /api/auth/login', () => {
      test('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'testpass123'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Login successful',
          user: {
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          },
          token: expect.any(String)
        });
      });

      test('should fail with invalid credentials', async () => {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
          .expect(401);
      });
    });

    describe('POST /api/auth/logout', () => {
      test('should logout successfully', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Logged out successfully'
        });
      });
    });
  });

  describe('User Profile Endpoints', () => {
    describe('GET /api/user/profile', () => {
      test('should get user profile', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: testUserId,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          twoFA: {
            enabled: false
          }
        });
      });

      test('should fail without authentication', async () => {
        await request(app)
          .get('/api/user/profile')
          .expect(401);
      });
    });

    describe('PUT /api/user/profile', () => {
      test('should update user profile', async () => {
        const updateData = {
          firstName: 'Updated',
          lastName: 'Name',
          phone: '+9876543210'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Profile updated successfully',
          user: {
            first_name: updateData.firstName,
            last_name: updateData.lastName,
            phone: updateData.phone
          }
        });
      });

      test('should fail with invalid phone format', async () => {
        const updateData = {
          phone: 'invalid-phone'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });
  });

  describe('Loan Endpoints', () => {
    describe('GET /api/loans', () => {
      test('should get user loan accounts', async () => {
        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toMatchObject({
          id: testLoanId,
          user_id: testUserId,
          account_number: 'TEST-LOAN-001',
          principal_amount: '10000.00',
          current_balance: '10000.00'
        });
      });
    });

    describe('GET /api/loans/:loanId/transactions', () => {
      test('should get loan transactions', async () => {
        const response = await request(app)
          .get(`/api/loans/${testLoanId}/transactions`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('transactions');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.transactions)).toBe(true);
      });

      test('should fail for non-existent loan', async () => {
        await request(app)
          .get('/api/loans/99999/transactions')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(404);
      });
    });

    describe('GET /api/loans/:loanId/analytics', () => {
      test('should get loan analytics', async () => {
        const response = await request(app)
          .get(`/api/loans/${testLoanId}/analytics`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('loanAccount');
        expect(response.body).toHaveProperty('analytics');
        expect(response.body.analytics).toHaveProperty('balanceHistory');
        expect(response.body.analytics).toHaveProperty('currentBalance');
      });
    });
  });

  describe('Withdrawal Request Endpoints', () => {
    describe('POST /api/withdrawal-requests', () => {
      test('should create a withdrawal request', async () => {
        const withdrawalData = {
          amount: 500.00,
          reason: 'Test withdrawal',
          urgency: 'normal',
          notes: 'Testing withdrawal functionality'
        };

        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(withdrawalData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Withdrawal request submitted successfully',
          request: expect.objectContaining({
            amount: '500.00',
            reason: withdrawalData.reason,
            status: 'pending'
          })
        });

        testWithdrawalRequestId = response.body.request.id;
      });

      test('should fail with amount exceeding balance', async () => {
        const withdrawalData = {
          amount: 50000.00,
          reason: 'Test withdrawal',
          urgency: 'normal'
        };

        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(withdrawalData)
          .expect(400);

        expect(response.body.error).toContain('exceeds current balance');
      });
    });

    describe('GET /api/withdrawal-requests', () => {
      test('should get user withdrawal requests', async () => {
        const response = await request(app)
          .get('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('id');
          expect(response.body[0]).toHaveProperty('amount');
          expect(response.body[0]).toHaveProperty('status');
        }
      });
    });
  });

  describe('Meeting Request Endpoints', () => {
    describe('POST /api/meeting-requests', () => {
      test('should create a meeting request', async () => {
        const meetingData = {
          purpose: 'Discuss loan terms',
          preferred_date: '2024-12-31',
          preferred_time: '14:30',
          meeting_type: 'video',
          urgency: 'normal',
          topics: 'Loan modification, payment schedule',
          notes: 'Prefer afternoon meetings'
        };

        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(meetingData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Meeting request submitted successfully',
          request: expect.objectContaining({
            purpose: meetingData.purpose,
            preferred_date: expect.any(String),
            preferred_time: meetingData.preferred_time,
            meeting_type: meetingData.meeting_type,
            status: 'pending'
          })
        });

        testMeetingRequestId = response.body.request.id;
      });

      test('should fail with invalid time format', async () => {
        const meetingData = {
          purpose: 'Test meeting',
          preferred_date: '2024-12-31',
          preferred_time: '25:00',
          meeting_type: 'video'
        };

        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(meetingData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });

    describe('GET /api/meeting-requests', () => {
      test('should get user meeting requests', async () => {
        const response = await request(app)
          .get('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('id');
          expect(response.body[0]).toHaveProperty('purpose');
          expect(response.body[0]).toHaveProperty('status');
        }
      });
    });
  });

  describe('Admin Endpoints', () => {
    describe('GET /api/admin/users', () => {
      test('should get all users for admin', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
        expect(response.body[0]).toHaveProperty('email');
        expect(response.body[0]).toHaveProperty('first_name');
      });

      test('should fail for non-admin user', async () => {
        await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      });
    });

    describe('GET /api/admin/loans', () => {
      test('should get all loans for admin', async () => {
        const response = await request(app)
          .get('/api/admin/loans')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('loans');
        expect(response.body).toHaveProperty('totalCount');
        expect(Array.isArray(response.body.loans)).toBe(true);
      });
    });

    describe('POST /api/admin/create-loan', () => {
      test('should create loan for user', async () => {
        // Create another test user first
        const newUserResult = await pool.query(
          'INSERT INTO users (email, password_hash, first_name, last_name, account_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          ['loanuser@example.com', await bcrypt.hash('pass123', 12), 'Loan', 'User', true]
        );
        const newUserId = newUserResult.rows[0].id;

        const loanData = {
          userId: newUserId,
          principalAmount: 5000.00,
          monthlyRate: 0.02
        };

        const response = await request(app)
          .post('/api/admin/create-loan')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(loanData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Loan account created successfully',
          loanAccount: expect.objectContaining({
            principalAmount: loanData.principalAmount,
            monthlyRate: loanData.monthlyRate
          })
        });

        // Clean up
        await pool.query('DELETE FROM loan_accounts WHERE user_id = $1', [newUserId]);
        await pool.query('DELETE FROM users WHERE id = $1', [newUserId]);
      });
    });

    describe('GET /api/admin/withdrawal-requests', () => {
      test('should get all withdrawal requests for admin', async () => {
        const response = await request(app)
          .get('/api/admin/withdrawal-requests')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('PUT /api/admin/withdrawal-requests/:requestId', () => {
      test('should update withdrawal request status', async () => {
        if (!testWithdrawalRequestId) {
          // Create a withdrawal request first
          const withdrawalResponse = await request(app)
            .post('/api/withdrawal-requests')
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send({
              amount: 200.00,
              reason: 'Test for admin update',
              urgency: 'normal'
            });
          testWithdrawalRequestId = withdrawalResponse.body.request.id;
        }

        const updateData = {
          status: 'approved',
          admin_notes: 'Approved for testing'
        };

        const response = await request(app)
          .put(`/api/admin/withdrawal-requests/${testWithdrawalRequestId}`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Withdrawal request updated successfully',
          request: expect.objectContaining({
            status: 'approved',
            admin_notes: 'Approved for testing'
          })
        });
      });
    });

    describe('GET /api/admin/meeting-requests', () => {
      test('should get all meeting requests for admin', async () => {
        const response = await request(app)
          .get('/api/admin/meeting-requests')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('PUT /api/admin/meeting-requests/:requestId', () => {
      test('should update meeting request status', async () => {
        if (!testMeetingRequestId) {
          // Create a meeting request first
          const meetingResponse = await request(app)
            .post('/api/meeting-requests')
            .set('Authorization', `Bearer ${regularUserToken}`)
            .send({
              purpose: 'Test meeting for admin update',
              preferred_date: '2024-12-31',
              preferred_time: '15:00',
              meeting_type: 'video'
            });
          testMeetingRequestId = meetingResponse.body.request.id;
        }

        const updateData = {
          status: 'scheduled',
          scheduled_date: '2024-12-31',
          scheduled_time: '15:00',
          meeting_link: 'https://meet.google.com/test-meeting',
          admin_notes: 'Meeting scheduled for testing'
        };

        const response = await request(app)
          .put(`/api/admin/meeting-requests/${testMeetingRequestId}`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Meeting request updated successfully',
          request: expect.objectContaining({
            status: 'scheduled',
            meeting_link: updateData.meeting_link
          })
        });
      });
    });
  });

  describe('2FA Endpoints', () => {
    describe('POST /api/2fa/setup', () => {
      test('should initiate 2FA setup', async () => {
        const response = await request(app)
          .post('/api/2fa/setup')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Scan the QR code with your authenticator app',
          qrCode: expect.any(String),
          manualEntryKey: expect.any(String)
        });
      });
    });

    describe('GET /api/2fa/status', () => {
      test('should get 2FA status', async () => {
        const response = await request(app)
          .get('/api/2fa/status')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('enabled');
        expect(response.body).toHaveProperty('setup_initiated');
      });
    });
  });

  describe('Email Verification Endpoints', () => {
    describe('POST /api/user/send-email-verification', () => {
      test('should send email verification', async () => {
        // First mark user as unverified
        await pool.query('UPDATE users SET email_verified = false WHERE id = $1', [testUserId]);

        const response = await request(app)
          .post('/api/user/send-email-verification')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Verification email sent successfully',
          token: expect.any(String)
        });
      });
    });

    describe('POST /api/user/verify-email', () => {
      test('should verify email with valid token', async () => {
        // Get verification token first
        const verificationResponse = await request(app)
          .post('/api/user/send-email-verification')
          .set('Authorization', `Bearer ${regularUserToken}`);

        const token = verificationResponse.body.token;

        const response = await request(app)
          .post('/api/user/verify-email')
          .send({ token })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Email verified successfully',
          email: 'test@example.com'
        });
      });

      test('should fail with invalid token', async () => {
        const response = await request(app)
          .post('/api/user/verify-email')
          .send({ token: 'invalid-token' })
          .expect(400);

        expect(response.body.error).toContain('Invalid verification token');
      });
    });
  });

  describe('Account Verification Endpoints', () => {
    describe('POST /api/user/request-account-verification', () => {
      test('should request account verification', async () => {
        // First mark user as unverified
        await pool.query('UPDATE users SET account_verified = false WHERE id = $1', [testUserId]);

        const response = await request(app)
          .post('/api/user/request-account-verification')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Account verification request submitted successfully',
          status: 'pending'
        });
      });
    });

    describe('GET /api/admin/verification-requests', () => {
      test('should get verification requests for admin', async () => {
        const response = await request(app)
          .get('/api/admin/verification-requests')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Endpoint not found'
      });
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    test('should require authentication for protected endpoints', async () => {
      await request(app)
        .get('/api/user/profile')
        .expect(401);

      await request(app)
        .get('/api/loans')
        .expect(401);

      await request(app)
        .post('/api/withdrawal-requests')
        .send({ amount: 100, reason: 'test' })
        .expect(401);
    });
  });

  describe('Data Validation', () => {
    test('should validate email format in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'testpass123',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate password length in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'valid@example.com',
          password: 'short',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate withdrawal amount', async () => {
      const response = await request(app)
        .post('/api/withdrawal-requests')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          amount: -100,
          reason: 'Test'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});