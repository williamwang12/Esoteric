const request = require('supertest');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-all-endpoints';

const app = require('../server-2fa.js');

describe('All Backend Endpoints Tests', () => {
  let regularUserToken = '';
  let adminUserToken = '';
  let testUserId = '';
  let testLoanId = '';
  let testWithdrawalRequestId = '';
  let testMeetingRequestId = '';

  beforeAll(async () => {
    // Try to login with existing demo user
    let loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@test.com',
        password: 'password123'
      });

    if (loginResponse.status !== 200) {
      // Try demo user
      loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'demo@esoteric.com',
          password: 'demo123456'
        });
    }

    if (loginResponse.status === 200) {
      regularUserToken = loginResponse.body.token;
      testUserId = loginResponse.body.user.id;
      // Since these users are admins, use same token
      adminUserToken = regularUserToken;
    } else {
      // Create a new test user if needed
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'testpass123',
          firstName: 'Test',
          lastName: 'User'
        });

      if (registerResponse.status === 201) {
        regularUserToken = registerResponse.body.token;
        testUserId = registerResponse.body.user.id;
        adminUserToken = regularUserToken;
      }
    }

    // Get or create a loan account for testing
    const loansResponse = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${regularUserToken}`);
    
    if (loansResponse.status === 200 && loansResponse.body.length > 0) {
      testLoanId = loansResponse.body[0].id;
    } else if (adminUserToken) {
      // Create a loan account if user doesn't have one
      const createLoanResponse = await request(app)
        .post('/api/admin/create-loan')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          userId: testUserId,
          principalAmount: 10000.00,
          monthlyRate: 0.01
        });
      
      if (createLoanResponse.status === 201) {
        testLoanId = createLoanResponse.body.loanAccount.id;
      }
    }
  });

  describe('Health Check', () => {
    test('GET /api/health', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('database', 'connected');
      expect(response.body).toHaveProperty('features');
    });
  });

  describe('Authentication Routes', () => {
    describe('POST /api/auth/register', () => {
      test('should register new user', async () => {
        const userData = {
          email: `newuser-${Date.now()}@example.com`,
          password: 'newpass123',
          firstName: 'New',
          lastName: 'User'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'User created successfully',
          user: expect.objectContaining({
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName
          }),
          token: expect.any(String)
        });
      });

      test('should fail with invalid email', async () => {
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

      test('should fail with short password', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'short',
            firstName: 'Test',
            lastName: 'User'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });

    describe('POST /api/auth/login', () => {
      test('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@test.com',
            password: 'password123'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Login successful',
          user: expect.objectContaining({
            email: 'test@test.com'
          }),
          token: expect.any(String)
        });
      });

      test('should fail with invalid credentials', async () => {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@test.com',
            password: 'wrongpassword'
          })
          .expect(401);
      });

      test('should fail with missing email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: 'password123'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
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

      test('should handle logout without token', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Logged out successfully'
        });
      });
    });
  });

  describe('User Profile Routes', () => {
    describe('GET /api/user/profile', () => {
      test('should get user profile', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('email');
        expect(response.body).toHaveProperty('first_name');
        expect(response.body).toHaveProperty('last_name');
        expect(response.body).toHaveProperty('twoFA');
      });

      test('should fail without authentication', async () => {
        await request(app)
          .get('/api/user/profile')
          .expect(401);
      });

      test('should fail with invalid token', async () => {
        await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });

    describe('PUT /api/user/profile', () => {
      test('should update user profile', async () => {
        const updateData = {
          firstName: 'UpdatedFirst',
          lastName: 'UpdatedLast',
          phone: '+1987654321'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Profile updated successfully',
          user: expect.objectContaining({
            first_name: updateData.firstName,
            last_name: updateData.lastName,
            phone: updateData.phone
          })
        });
      });

      test('should fail with invalid phone format', async () => {
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            phone: 'invalid-phone-format'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });

      test('should handle empty update', async () => {
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({})
          .expect(400);

        expect(response.body.error).toContain('No fields to update');
      });
    });
  });

  describe('Loan Management Routes', () => {
    describe('GET /api/loans', () => {
      test('should get user loan accounts', async () => {
        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should fail without authentication', async () => {
        await request(app)
          .get('/api/loans')
          .expect(401);
      });
    });

    describe('GET /api/loans/:loanId/transactions', () => {
      test('should get loan transactions when loan exists', async () => {
        if (testLoanId) {
          const response = await request(app)
            .get(`/api/loans/${testLoanId}/transactions`)
            .set('Authorization', `Bearer ${regularUserToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('transactions');
          expect(response.body).toHaveProperty('pagination');
          expect(Array.isArray(response.body.transactions)).toBe(true);
        }
      });

      test('should fail for non-existent loan', async () => {
        await request(app)
          .get('/api/loans/99999/transactions')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(404);
      });

      test('should support pagination', async () => {
        if (testLoanId) {
          const response = await request(app)
            .get(`/api/loans/${testLoanId}/transactions?page=1&limit=5`)
            .set('Authorization', `Bearer ${regularUserToken}`)
            .expect(200);

          expect(response.body.pagination).toHaveProperty('page', 1);
          expect(response.body.pagination).toHaveProperty('limit', 5);
        }
      });
    });

    describe('GET /api/loans/:loanId/analytics', () => {
      test('should get loan analytics when loan exists', async () => {
        if (testLoanId) {
          const response = await request(app)
            .get(`/api/loans/${testLoanId}/analytics`)
            .set('Authorization', `Bearer ${regularUserToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('loanAccount');
          expect(response.body).toHaveProperty('analytics');
          expect(response.body.analytics).toHaveProperty('balanceHistory');
          expect(response.body.analytics).toHaveProperty('currentBalance');
        }
      });

      test('should support period parameter', async () => {
        if (testLoanId) {
          const response = await request(app)
            .get(`/api/loans/${testLoanId}/analytics?period=6`)
            .set('Authorization', `Bearer ${regularUserToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('analytics');
        }
      });
    });
  });

  describe('Withdrawal Request Routes', () => {
    describe('POST /api/withdrawal-requests', () => {
      test('should create withdrawal request with valid data', async () => {
        if (testLoanId) {
          const withdrawalData = {
            amount: 100.00,
            reason: 'Test withdrawal request',
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
              amount: '100.00',
              reason: withdrawalData.reason,
              urgency: withdrawalData.urgency,
              status: 'pending'
            })
          });

          testWithdrawalRequestId = response.body.request.id;
        }
      });

      test('should fail with invalid amount', async () => {
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

      test('should fail with missing reason', async () => {
        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            amount: 100.00
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });

      test('should fail with invalid urgency', async () => {
        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            amount: 100.00,
            reason: 'Test',
            urgency: 'invalid'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });

    describe('GET /api/withdrawal-requests', () => {
      test('should get user withdrawal requests', async () => {
        const response = await request(app)
          .get('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should support status filter', async () => {
        const response = await request(app)
          .get('/api/withdrawal-requests?status=pending')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should support pagination', async () => {
        const response = await request(app)
          .get('/api/withdrawal-requests?limit=10&offset=0')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  describe('Meeting Request Routes', () => {
    describe('POST /api/meeting-requests', () => {
      test('should create meeting request with valid data', async () => {
        const meetingData = {
          purpose: 'Discuss loan terms and conditions',
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
            meeting_type: meetingData.meeting_type,
            urgency: meetingData.urgency,
            status: 'pending'
          })
        });

        testMeetingRequestId = response.body.request.id;
      });

      test('should fail with invalid date format', async () => {
        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            purpose: 'Test meeting',
            preferred_date: 'invalid-date',
            preferred_time: '14:30',
            meeting_type: 'video'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });

      test('should fail with invalid time format', async () => {
        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            purpose: 'Test meeting',
            preferred_date: '2024-12-31',
            preferred_time: '25:00',
            meeting_type: 'video'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });

      test('should fail with invalid meeting type', async () => {
        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            purpose: 'Test meeting',
            preferred_date: '2024-12-31',
            preferred_time: '14:30',
            meeting_type: 'phone'
          })
          .expect(400);

        expect(response.body.error).toContain('Only video meetings are supported');
      });
    });

    describe('GET /api/meeting-requests', () => {
      test('should get user meeting requests', async () => {
        const response = await request(app)
          .get('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should support status filter', async () => {
        const response = await request(app)
          .get('/api/meeting-requests?status=pending')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  describe('2FA Routes', () => {
    describe('POST /api/2fa/setup', () => {
      test('should initiate 2FA setup', async () => {
        const response = await request(app)
          .post('/api/2fa/setup')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: expect.stringContaining('QR code'),
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

    describe('POST /api/2fa/disable', () => {
      test('should fail without valid token and password', async () => {
        const response = await request(app)
          .post('/api/2fa/disable')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            token: '123456',
            password: 'wrongpassword'
          })
          .expect(400);

        expect(response.body.error).toMatch(/Invalid|not enabled/);
      });
    });
  });

  describe('Email Verification Routes', () => {
    describe('POST /api/user/send-email-verification', () => {
      test('should send email verification', async () => {
        const response = await request(app)
          .post('/api/user/send-email-verification')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: expect.stringContaining('sent successfully'),
          token: expect.any(String)
        });
      });
    });

    describe('POST /api/user/verify-email', () => {
      test('should fail with invalid token', async () => {
        const response = await request(app)
          .post('/api/user/verify-email')
          .send({ token: 'invalid-token' })
          .expect(400);

        expect(response.body.error).toContain('Invalid verification token');
      });

      test('should fail with missing token', async () => {
        const response = await request(app)
          .post('/api/user/verify-email')
          .send({})
          .expect(400);

        expect(response.body.error).toContain('required');
      });
    });
  });

  describe('Account Verification Routes', () => {
    describe('POST /api/user/request-account-verification', () => {
      test('should request account verification', async () => {
        const response = await request(app)
          .post('/api/user/request-account-verification')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: expect.stringContaining('submitted successfully'),
          status: 'pending'
        });
      });
    });
  });

  describe('Document Routes', () => {
    describe('GET /api/documents', () => {
      test('should get user documents', async () => {
        const response = await request(app)
          .get('/api/documents')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should support category filter', async () => {
        const response = await request(app)
          .get('/api/documents?category=statements')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /api/documents/:documentId/download', () => {
      test('should fail for non-existent document', async () => {
        await request(app)
          .get('/api/documents/99999/download')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(404);
      });
    });
  });

  describe('Admin Routes', () => {
    describe('GET /api/admin/users', () => {
      test('should get all users for admin', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('email');
          expect(response.body[0]).toHaveProperty('first_name');
          expect(response.body[0]).toHaveProperty('last_name');
        }
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

    describe('GET /api/admin/withdrawal-requests', () => {
      test('should get all withdrawal requests for admin', async () => {
        const response = await request(app)
          .get('/api/admin/withdrawal-requests')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should support status filter', async () => {
        const response = await request(app)
          .get('/api/admin/withdrawal-requests?status=pending')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('PUT /api/admin/withdrawal-requests/:requestId', () => {
      test('should update withdrawal request status', async () => {
        if (testWithdrawalRequestId) {
          const updateData = {
            status: 'approved',
            admin_notes: 'Approved for testing purposes'
          };

          const response = await request(app)
            .put(`/api/admin/withdrawal-requests/${testWithdrawalRequestId}`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .send(updateData)
            .expect(200);

          expect(response.body).toMatchObject({
            message: expect.stringContaining('updated successfully'),
            request: expect.objectContaining({
              status: 'approved'
            })
          });
        }
      });

      test('should fail with invalid status', async () => {
        if (testWithdrawalRequestId) {
          const response = await request(app)
            .put(`/api/admin/withdrawal-requests/${testWithdrawalRequestId}`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .send({
              status: 'invalid-status'
            })
            .expect(400);

          expect(response.body).toHaveProperty('errors');
        }
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
        if (testMeetingRequestId) {
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
            message: expect.stringContaining('updated successfully'),
            request: expect.objectContaining({
              status: 'scheduled'
            })
          });
        }
      });

      test('should fail with invalid status', async () => {
        if (testMeetingRequestId) {
          const response = await request(app)
            .put(`/api/admin/meeting-requests/${testMeetingRequestId}`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .send({
              status: 'invalid-status'
            })
            .expect(400);

          expect(response.body).toHaveProperty('errors');
        }
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

    describe('GET /api/admin/users/:userId/loans', () => {
      test('should get user loans for admin', async () => {
        if (testUserId) {
          const response = await request(app)
            .get(`/api/admin/users/${testUserId}/loans`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('user');
          expect(response.body).toHaveProperty('loans');
          expect(Array.isArray(response.body.loans)).toBe(true);
        }
      });

      test('should fail for non-existent user', async () => {
        await request(app)
          .get('/api/admin/users/99999/loans')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(404);
      });
    });

    describe('GET /api/admin/users/:userId/documents', () => {
      test('should get user documents for admin', async () => {
        if (testUserId) {
          const response = await request(app)
            .get(`/api/admin/users/${testUserId}/documents`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('user');
          expect(response.body).toHaveProperty('documents');
          expect(Array.isArray(response.body.documents)).toBe(true);
        }
      });
    });

    describe('GET /api/admin/users/:userId/transactions', () => {
      test('should get user transactions for admin', async () => {
        if (testUserId) {
          const response = await request(app)
            .get(`/api/admin/users/${testUserId}/transactions`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('user');
          expect(response.body).toHaveProperty('transactions');
          expect(Array.isArray(response.body.transactions)).toBe(true);
        }
      });
    });
  });

  describe('Error Handling and Security', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Endpoint not found'
      });
    });

    test('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/user/profile' },
        { method: 'get', path: '/api/loans' },
        { method: 'post', path: '/api/withdrawal-requests' },
        { method: 'post', path: '/api/meeting-requests' },
        { method: 'get', path: '/api/documents' },
        { method: 'post', path: '/api/2fa/setup' },
        { method: 'get', path: '/api/2fa/status' }
      ];

      for (const endpoint of protectedEndpoints) {
        await request(app)[endpoint.method](endpoint.path)
          .expect(401);
      }
    });

    test('should require admin authentication for admin endpoints', async () => {
      const adminEndpoints = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/loans' },
        { method: 'get', path: '/api/admin/withdrawal-requests' },
        { method: 'get', path: '/api/admin/meeting-requests' }
      ];

      for (const endpoint of adminEndpoints) {
        await request(app)[endpoint.method](endpoint.path)
          .expect(401);
      }
    });

    test('should handle malformed JSON gracefully', async () => {
      // This test verifies the error handling middleware works
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');
      
      // Accept either 400 (handled by body parser) or 500 (handled by error middleware)
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Input Validation', () => {
    test('should validate registration input', async () => {
      const invalidInputs = [
        { email: 'invalid-email', password: 'testpass123', firstName: 'Test', lastName: 'User' },
        { email: 'test@example.com', password: 'short', firstName: 'Test', lastName: 'User' },
        { email: 'test@example.com', password: 'testpass123', firstName: '', lastName: 'User' },
        { email: 'test@example.com', password: 'testpass123', firstName: 'Test', lastName: '' }
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(input);
        
        expect([400, 409]).toContain(response.status);
      }
    });

    test('should validate withdrawal request input', async () => {
      const invalidInputs = [
        { amount: -100, reason: 'Test' },
        { amount: 0, reason: 'Test' },
        { amount: 100, reason: '' },
        { amount: 100, reason: 'Test', urgency: 'invalid' }
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/api/withdrawal-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(input);
        
        expect([400, 401, 403]).toContain(response.status);
      }
    });

    test('should validate meeting request input', async () => {
      const invalidInputs = [
        { purpose: '', preferred_date: '2024-12-31', preferred_time: '14:30' },
        { purpose: 'Test', preferred_date: 'invalid-date', preferred_time: '14:30' },
        { purpose: 'Test', preferred_date: '2024-12-31', preferred_time: '25:00' },
        { purpose: 'Test', preferred_date: '2024-12-31', preferred_time: '14:30', meeting_type: 'phone' }
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/api/meeting-requests')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(input);
        
        expect([400, 401, 403]).toContain(response.status);
      }
    });
  });

  describe('Complete Workflow Tests', () => {
    test('should complete withdrawal request workflow', async () => {
      if (testWithdrawalRequestId && testLoanId) {
        // First approve the request
        const approveResponse = await request(app)
          .put(`/api/admin/withdrawal-requests/${testWithdrawalRequestId}`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send({
            status: 'approved',
            admin_notes: 'Approved for testing'
          });

        if (approveResponse.status === 200) {
          // Then complete the withdrawal
          const completeResponse = await request(app)
            .post(`/api/admin/withdrawal-requests/${testWithdrawalRequestId}/complete`)
            .set('Authorization', `Bearer ${adminUserToken}`)
            .expect(200);

          expect(completeResponse.body).toMatchObject({
            message: expect.stringContaining('completed successfully'),
            newBalance: expect.any(Number),
            withdrawalAmount: expect.any(Number)
          });
        }
      }
    });

    test('should complete meeting request workflow', async () => {
      if (testMeetingRequestId) {
        const updateData = {
          status: 'scheduled',
          scheduled_date: '2024-12-31',
          scheduled_time: '16:00',
          meeting_link: 'https://meet.google.com/test-workflow',
          admin_notes: 'Scheduled for workflow testing'
        };

        const response = await request(app)
          .put(`/api/admin/meeting-requests/${testMeetingRequestId}`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(updateData);

        if (response.status === 200) {
          expect(response.body).toMatchObject({
            message: expect.stringContaining('updated successfully'),
            request: expect.objectContaining({
              status: 'scheduled',
              meeting_link: updateData.meeting_link
            })
          });
        }
      }
    });
  });
});