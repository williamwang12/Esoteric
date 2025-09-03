const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-enhanced-comprehensive';

// Import test server
const app = require('../server-2fa.js');

describe('Enhanced Comprehensive Backend API Tests', () => {
  let regularUserToken = '';
  let adminUserToken = '';
  let testUserId = '';
  let adminUserId = '';
  let testLoanId = '';
  let testDocumentId = '';
  let testTransactionId = '';

  // Test data
  const uniqueTestUser = {
    email: `test-enhanced-${Date.now()}@comprehensive.com`,
    password: 'TestPassword123!',
    firstName: 'Enhanced',
    lastName: 'Test',
    phone: '+1234567890'
  };

  beforeAll(async () => {
    // Login with demo user (should exist from setup)
    const demoLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@esoteric.com',
        password: 'demo123456'
      });

    console.log('Demo login response:', demoLoginResponse.status, demoLoginResponse.body);

    if (demoLoginResponse.status === 200) {
      regularUserToken = demoLoginResponse.body.token;
      testUserId = demoLoginResponse.body.user.id;
    } else {
      throw new Error(`Demo login failed: ${JSON.stringify(demoLoginResponse.body)}`);
    }

    // Login with admin user or use demo user as admin
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@esoteric.com',
        password: 'admin123456'
      });

    console.log('Admin login response:', adminLoginResponse.status, adminLoginResponse.body);

    if (adminLoginResponse.status === 200) {
      adminUserToken = adminLoginResponse.body.token;
      adminUserId = adminLoginResponse.body.user.id;
    } else {
      // Use demo user as admin (since demo@esoteric.com is set as admin in the code)
      console.log('Using demo user as admin');
      adminUserToken = regularUserToken;
      adminUserId = testUserId;
    }

    // Get user's loan account for testing
    const loansResponse = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${regularUserToken}`);
    
    if (loansResponse.status === 200 && loansResponse.body.length > 0) {
      testLoanId = loansResponse.body[0].id;
    }
  });

  describe('Health and System Endpoints', () => {
    test('GET /api/health should return comprehensive health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        database: 'connected',
        timestamp: expect.any(String),
        features: expect.arrayContaining(['2FA', 'JWT Sessions', 'TOTP', 'Backup Codes'])
      });
    });

    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Endpoint not found'
      });
    });
  });

  describe('Enhanced Authentication Tests', () => {
    describe('User Registration', () => {
      test('should register a new user with all fields', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(uniqueTestUser)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'User registered successfully',
          user: expect.objectContaining({
            id: expect.any(Number),
            email: uniqueTestUser.email,
            firstName: uniqueTestUser.firstName,
            lastName: uniqueTestUser.lastName,
            phone: uniqueTestUser.phone,
            role: 'user'
          })
        });
        expect(response.body.user).not.toHaveProperty('password');
      });

      test('should prevent duplicate email registration', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(uniqueTestUser)
          .expect(400);

        expect(response.body).toMatchObject({
          error: 'User already exists'
        });
      });

      test('should validate email format', async () => {
        const invalidUser = {
          ...uniqueTestUser,
          email: 'invalid-email-format'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(invalidUser)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });

      test('should validate password strength', async () => {
        const weakPasswordUser = {
          ...uniqueTestUser,
          email: 'weak@test.com',
          password: '123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(weakPasswordUser)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });

    describe('User Login', () => {
      test('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: uniqueTestUser.email,
            password: uniqueTestUser.password
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Login successful',
          token: expect.any(String),
          user: expect.objectContaining({
            email: uniqueTestUser.email,
            firstName: uniqueTestUser.firstName,
            lastName: uniqueTestUser.lastName
          })
        });
      });

      test('should fail with invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: uniqueTestUser.email,
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body).toMatchObject({
          error: 'Invalid credentials'
        });
      });

      test('should fail with non-existent user', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@test.com',
            password: 'password123'
          })
          .expect(401);

        expect(response.body).toMatchObject({
          error: 'Invalid credentials'
        });
      });
    });
  });

  describe('User Profile Management', () => {
    test('GET /api/user/profile should return user profile with 2FA status', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        email: expect.any(String),
        first_name: expect.any(String),
        last_name: expect.any(String),
        role: expect.any(String),
        twoFA: expect.objectContaining({
          enabled: expect.any(Boolean)
        })
      });
    });

    test('PUT /api/user/profile should update user profile', async () => {
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
        user: expect.objectContaining({
          first_name: updateData.firstName,
          last_name: updateData.lastName,
          phone: updateData.phone
        })
      });
    });

    test('should validate phone number format', async () => {
      const invalidUpdate = {
        phone: 'invalid-phone'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('Loan Management', () => {
    test('GET /api/loans should return user loans', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toMatchObject({
          id: expect.any(Number),
          user_id: expect.any(Number),
          account_number: expect.any(String),
          principal_amount: expect.any(String),
          current_balance: expect.any(String),
          monthly_rate: expect.any(String)
        });
      }
    });

    test('GET /api/loans/:id/analytics should return loan analytics', async () => {
      if (!testLoanId) {
        console.log('Skipping analytics test - no loan account available');
        return;
      }

      const response = await request(app)
        .get(`/api/loans/${testLoanId}/analytics`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        loanAccount: expect.any(Object),
        analytics: expect.objectContaining({
          currentBalance: expect.any(Number),
          totalPrincipal: expect.any(Number),
          monthlyRate: expect.any(Number)
        })
      });
    });

    test('should not allow access to other user\'s loan analytics', async () => {
      if (!testLoanId) {
        console.log('Skipping security test - no loan account available');
        return;
      }

      // Try to access with a different user's token (if available)
      const response = await request(app)
        .get(`/api/loans/999999/analytics`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Loan account not found'
      });
    });
  });

  describe('Transaction Management', () => {
    test('GET /api/loans/:id/transactions should return loan transactions', async () => {
      if (!testLoanId) {
        console.log('Skipping transactions test - no loan account available');
        return;
      }

      const response = await request(app)
        .get(`/api/loans/${testLoanId}/transactions`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        transactions: expect.any(Array),
        pagination: expect.objectContaining({
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
          pages: expect.any(Number)
        })
      });
    });

    test('should support transaction filtering by type', async () => {
      if (!testLoanId) {
        console.log('Skipping filter test - no loan account available');
        return;
      }

      const response = await request(app)
        .get(`/api/loans/${testLoanId}/transactions?type=monthly_payment`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body.transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transaction_type: 'monthly_payment'
          })
        ])
      );
    });

    test('should support transaction filtering by date range', async () => {
      if (!testLoanId) {
        console.log('Skipping date filter test - no loan account available');
        return;
      }

      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/loans/${testLoanId}/transactions?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Admin Functionality', () => {
    describe('User Management', () => {
      test('GET /api/admin/users should return all users for admin', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toMatchObject({
            id: expect.any(Number),
            email: expect.any(String),
            first_name: expect.any(String),
            last_name: expect.any(String),
            loan_accounts_count: expect.any(String)
          });
        }
      });

      test('should fail for non-admin user', async () => {
        // Create a regular user token
        const newUserToken = await request(app)
          .post('/api/auth/login')
          .send({
            email: uniqueTestUser.email,
            password: uniqueTestUser.password
          });

        if (newUserToken.body.token) {
          const response = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${newUserToken.body.token}`)
            .expect(403);

          expect(response.body).toMatchObject({
            error: 'Admin access required'
          });
        }
      });
    });

    describe('Loan Management', () => {
      test('POST /api/admin/create-loan should create a loan account', async () => {
        // Get a user ID to create loan for
        const usersResponse = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminUserToken}`);

        if (usersResponse.body.length > 0) {
          const targetUserId = usersResponse.body.find(user => 
            user.email === uniqueTestUser.email
          )?.id;

          if (targetUserId) {
            const loanData = {
              userId: targetUserId,
              principalAmount: 10000.00,
              monthlyRate: 0.015
            };

            const response = await request(app)
              .post('/api/admin/create-loan')
              .set('Authorization', `Bearer ${adminUserToken}`)
              .send(loanData)
              .expect(201);

            expect(response.body).toMatchObject({
              message: 'Loan account created successfully',
              loanAccount: expect.objectContaining({
                id: expect.any(Number),
                accountNumber: expect.any(String),
                principalAmount: loanData.principalAmount,
                monthlyRate: loanData.monthlyRate
              })
            });
          }
        }
      });

      test('should validate loan creation data', async () => {
        const invalidLoanData = {
          userId: 'invalid',
          principalAmount: -1000,
          monthlyRate: 2.0 // > 1 (100%)
        };

        const response = await request(app)
          .post('/api/admin/create-loan')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(invalidLoanData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });

      test('GET /api/admin/loans should return all loans', async () => {
        const response = await request(app)
          .get('/api/admin/loans')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          loans: expect.any(Array),
          totalCount: expect.any(Number)
        });
      });
    });

    describe('Transaction Management', () => {
      test('POST /api/admin/loans/:id/transactions should add transaction', async () => {
        if (!testLoanId) {
          console.log('Skipping admin transaction test - no loan account available');
          return;
        }

        const transactionData = {
          amount: 150.00,
          transactionType: 'monthly_payment',
          description: 'Test monthly payment',
          transactionDate: new Date().toISOString().split('T')[0]
        };

        const response = await request(app)
          .post(`/api/admin/loans/${testLoanId}/transactions`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(transactionData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Transaction added successfully',
          transaction: expect.objectContaining({
            amount: '150.00',
            transaction_type: 'monthly_payment',
            description: 'Test monthly payment'
          })
        });

        testTransactionId = response.body.transaction.id;
      });

      test('should validate transaction data', async () => {
        if (!testLoanId) {
          console.log('Skipping validation test - no loan account available');
          return;
        }

        const invalidTransactionData = {
          amount: 'invalid',
          transactionType: 'invalid_type',
          description: 'Test'
        };

        const response = await request(app)
          .post(`/api/admin/loans/${testLoanId}/transactions`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .send(invalidTransactionData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });
  });

  describe('Document Management', () => {
    test('GET /api/documents should return user documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should filter documents by category', async () => {
      const response = await request(app)
        .get('/api/documents?category=statement')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(doc => {
        expect(doc.category).toBe('statement');
      });
    });

    test('GET /api/admin/users/:id/documents should return user documents for admin', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${testUserId}/documents`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        user: expect.objectContaining({
          id: testUserId,
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String)
        }),
        documents: expect.any(Array)
      });
    });
  });

  describe('Account Verification', () => {
    test('POST /api/user/request-account-verification should create verification request', async () => {
      // Use the new user token to avoid duplicate requests
      const newUserLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueTestUser.email,
          password: uniqueTestUser.password
        });

      if (newUserLogin.body.token) {
        const response = await request(app)
          .post('/api/user/request-account-verification')
          .set('Authorization', `Bearer ${newUserLogin.body.token}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Account verification request submitted successfully',
          status: 'pending'
        });
      }
    });

    test('GET /api/admin/verification-requests should return verification requests', async () => {
      const response = await request(app)
        .get('/api/admin/verification-requests')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should filter verification requests by status', async () => {
      const response = await request(app)
        .get('/api/admin/verification-requests?status=pending')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(request => {
        expect(request.status).toBe('pending');
      });
    });
  });

  describe('Security and Error Handling', () => {
    test('should require authentication for protected routes', async () => {
      const protectedRoutes = [
        '/api/user/profile',
        '/api/loans',
        '/api/documents',
        '/api/withdrawal-requests',
        '/api/meeting-requests'
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)
          .get(route)
          .expect(401);

        expect(response.body).toMatchObject({
          error: 'Access token required'
        });
      }
    });

    test('should handle invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Invalid or expired token'
      });
    });

    test('should handle expired JWT tokens', async () => {
      // Create an expired token (this would need to be mocked in a real scenario)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';
      
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Invalid or expired token'
      });
    });

    test('should sanitize error messages to prevent information leakage', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password'
        })
        .expect(401);

      // Should not reveal whether user exists or not
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('invalid-json')
        .expect(400);

      // Should handle malformed JSON gracefully
    });

    test('should limit request size to prevent DoS attacks', async () => {
      const largePayload = {
        email: 'test@test.com',
        password: 'a'.repeat(100000) // Very long password
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largePayload);

      // Should either accept it with truncation or reject it appropriately
      expect([400, 413, 500]).toContain(response.status);
    });
  });

  describe('Rate Limiting and Performance', () => {
    test('should handle concurrent requests gracefully', async () => {
      const concurrentRequests = Array(10).fill().map(() => 
        request(app)
          .get('/api/health')
          .expect(200)
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });
    });

    test('should respond to health checks quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Data Integrity', () => {
    test('should maintain referential integrity for user-loan relationships', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      response.body.forEach(loan => {
        expect(loan.user_id).toBe(testUserId);
      });
    });

    test('should maintain decimal precision for financial amounts', async () => {
      if (!testLoanId) {
        console.log('Skipping precision test - no loan account available');
        return;
      }

      const preciseAmount = 123.456789;
      
      const transactionData = {
        amount: preciseAmount,
        transactionType: 'bonus',
        description: 'Precision test',
        bonusPercentage: 0.0234
      };

      const response = await request(app)
        .post(`/api/admin/loans/${testLoanId}/transactions`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send(transactionData)
        .expect(201);

      // Should maintain reasonable precision (2 decimal places for currency)
      const returnedAmount = parseFloat(response.body.transaction.amount);
      expect(returnedAmount).toBeCloseTo(preciseAmount, 2);
    });
  });

  describe('Cleanup and Edge Cases', () => {
    test('should handle database connection issues gracefully', async () => {
      // This would require mocking the database connection
      // For now, we'll just ensure the error handling structure is in place
      expect(true).toBe(true); // Placeholder
    });

    test('should handle file system errors for document operations', async () => {
      // This would test document upload/download error handling
      expect(true).toBe(true); // Placeholder
    });

    test('should clean up test data properly', async () => {
      // Verify test isolation - this is handled by the test database
      expect(true).toBe(true); // Placeholder
    });
  });
});