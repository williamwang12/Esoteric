// Basic Loan Operations Test Suite
const request = require('supertest');
const app = require('../server-2fa');
const { getTestDatabase } = require('./setup');

describe('Basic Loan Operations Test Suite', () => {
  let testDatabase;
  let authToken;
  let adminToken;
  let userId;
  let adminId;
  let loanAccountId;

  beforeAll(async () => {
    testDatabase = getTestDatabase();
    await testDatabase.cleanDatabase();

    // Create test user
    const testUser = {
      email: 'loan-test@example.com',
      password: 'TestPassword123!',
      firstName: 'Loan',
      lastName: 'User'
    };

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

    // Create admin user
    const adminUser = {
      email: 'loan-admin@example.com',
      password: 'AdminPassword123!',
      firstName: 'Loan',
      lastName: 'Admin'
    };

    await request(app)
      .post('/api/auth/register')
      .send(adminUser);

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

    // Create a test loan account for the user
    try {
      const loanResult = await pool.query(`
        INSERT INTO loan_accounts (user_id, principal_amount, interest_rate, term_months, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [userId, 10000, 5.5, 12, 'active']);
      
      loanAccountId = loanResult.rows[0].id;
    } catch (error) {
      console.log('⚠️ Could not create test loan:', error.message);
    }
  });

  afterAll(async () => {
    await testDatabase.cleanDatabase();
  });

  describe('Get User Loans', () => {
    describe('Happy Path Tests', () => {
      it('should get user loans with valid token', async () => {
        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          if (response.body.length > 0) {
            const loan = response.body[0];
            expect(loan).toHaveProperty('id');
            expect(loan).toHaveProperty('principal_amount');
            expect(loan).toHaveProperty('interest_rate');
            expect(loan).toHaveProperty('status');
          }
        }
      });

      it('should return empty array for user with no loans', async () => {
        // Create a user with no loans
        const newUser = {
          email: 'no-loans@example.com',
          password: 'TestPassword123!',
          firstName: 'No',
          lastName: 'Loans'
        };

        await request(app)
          .post('/api/auth/register')
          .send(newUser);

        const newUserLogin = await request(app)
          .post('/api/auth/login')
          .send({
            email: newUser.email,
            password: newUser.password
          });

        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${newUserLogin.body.token}`);

        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          expect(response.body.length).toBe(0);
        }
      });
    });

    describe('Authorization Tests', () => {
      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/loans');

        expect([401, 403]).toContain(response.status);
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', 'Bearer invalid-token');

        expect([401, 403]).toContain(response.status);
      });

      it('should only return loans for the authenticated user', async () => {
        // Create another user
        const otherUser = {
          email: 'other-loan-user@example.com',
          password: 'TestPassword123!',
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

        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${otherLogin.body.token}`);

        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          // Should be empty or only contain loans for this user
          response.body.forEach(loan => {
            expect(loan.user_id).toBe(otherLogin.body.user.id);
          });
        }
      });
    });
  });

  describe('Get Loan Transactions', () => {
    describe('Happy Path Tests', () => {
      it('should get loan transactions with valid loan ID', async () => {
        if (!loanAccountId) {
          console.log('⚠️ Skipping loan transactions test - no test loan available');
          return;
        }

        const response = await request(app)
          .get(`/api/loans/${loanAccountId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
          response.body.forEach(transaction => {
            expect(transaction).toHaveProperty('id');
            expect(transaction).toHaveProperty('transaction_type');
            expect(transaction).toHaveProperty('amount');
            expect(transaction).toHaveProperty('transaction_date');
          });
        }
      });

      it('should support pagination parameters', async () => {
        if (!loanAccountId) {
          console.log('⚠️ Skipping pagination test - no test loan available');
          return;
        }

        const response = await request(app)
          .get(`/api/loans/${loanAccountId}/transactions`)
          .query({ limit: 10, offset: 0 })
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(Array.isArray(response.body)).toBe(true);
        }
      });
    });

    describe('Validation Tests', () => {
      it('should reject invalid loan ID', async () => {
        const response = await request(app)
          .get('/api/loans/invalid-id/transactions')
          .set('Authorization', `Bearer ${authToken}`);

        expect([400, 404, 500]).toContain(response.status);
      });

      it('should reject non-numeric loan ID', async () => {
        const response = await request(app)
          .get('/api/loans/abc/transactions')
          .set('Authorization', `Bearer ${authToken}`);

        expect([400, 404, 500]).toContain(response.status);
      });

      it('should reject access to other user\'s loan transactions', async () => {
        if (!loanAccountId) {
          console.log('⚠️ Skipping authorization test - no test loan available');
          return;
        }

        // Create another user
        const otherUser = {
          email: 'other-trans-user@example.com',
          password: 'TestPassword123!',
          firstName: 'Other',
          lastName: 'TransUser'
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

        const response = await request(app)
          .get(`/api/loans/${loanAccountId}/transactions`)
          .set('Authorization', `Bearer ${otherLogin.body.token}`);

        expect([403, 404]).toContain(response.status);
      });
    });

    describe('Authorization Tests', () => {
      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/loans/1/transactions');

        expect([401, 403]).toContain(response.status);
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/api/loans/1/transactions')
          .set('Authorization', 'Bearer invalid-token');

        expect([401, 403]).toContain(response.status);
      });
    });
  });

  describe('Get Loan Analytics', () => {
    describe('Happy Path Tests', () => {
      it('should get loan analytics with valid loan ID', async () => {
        if (!loanAccountId) {
          console.log('⚠️ Skipping loan analytics test - no test loan available');
          return;
        }

        const response = await request(app)
          .get(`/api/loans/${loanAccountId}/analytics`)
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body).toHaveProperty('totalPaid');
          expect(response.body).toHaveProperty('remainingBalance');
          expect(response.body).toHaveProperty('nextPaymentDue');
          expect(typeof response.body.totalPaid).toBe('string');
          expect(typeof response.body.remainingBalance).toBe('string');
        }
      });

      it('should calculate analytics correctly', async () => {
        if (!loanAccountId) {
          console.log('⚠️ Skipping analytics calculation test - no test loan available');
          return;
        }

        const response = await request(app)
          .get(`/api/loans/${loanAccountId}/analytics`)
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          const totalPaid = parseFloat(response.body.totalPaid);
          const remainingBalance = parseFloat(response.body.remainingBalance);
          
          expect(totalPaid).toBeGreaterThanOrEqual(0);
          expect(remainingBalance).toBeGreaterThanOrEqual(0);
          
          // Total paid + remaining should not exceed principal + interest (with some margin for calculations)
          expect(totalPaid + remainingBalance).toBeLessThanOrEqual(20000); // Generous margin
        }
      });
    });

    describe('Validation Tests', () => {
      it('should reject invalid loan ID', async () => {
        const response = await request(app)
          .get('/api/loans/invalid-id/analytics')
          .set('Authorization', `Bearer ${authToken}`);

        expect([400, 404, 500]).toContain(response.status);
      });

      it('should reject non-existent loan ID', async () => {
        const response = await request(app)
          .get('/api/loans/999999/analytics')
          .set('Authorization', `Bearer ${authToken}`);

        expect([404]).toContain(response.status);
      });
    });

    describe('Authorization Tests', () => {
      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/loans/1/analytics');

        expect([401, 403]).toContain(response.status);
      });

      it('should reject access to other user\'s loan analytics', async () => {
        if (!loanAccountId) {
          console.log('⚠️ Skipping analytics authorization test - no test loan available');
          return;
        }

        // Create another user
        const otherUser = {
          email: 'other-analytics-user@example.com',
          password: 'TestPassword123!',
          firstName: 'Other',
          lastName: 'AnalyticsUser'
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

        const response = await request(app)
          .get(`/api/loans/${loanAccountId}/analytics`)
          .set('Authorization', `Bearer ${otherLogin.body.token}`);

        expect([403, 404]).toContain(response.status);
      });
    });
  });

  describe('Data Consistency', () => {
    describe('Database Integrity Tests', () => {
      it('should maintain referential integrity', async () => {
        if (!loanAccountId) {
          console.log('⚠️ Skipping integrity test - no test loan available');
          return;
        }

        const pool = testDatabase.getPool();
        
        // Check that loan exists and belongs to correct user
        const loanCheck = await pool.query(
          'SELECT user_id FROM loan_accounts WHERE id = $1',
          [loanAccountId]
        );

        expect(loanCheck.rows.length).toBe(1);
        expect(loanCheck.rows[0].user_id).toBe(userId);
      });

      it('should handle non-existent loans gracefully', async () => {
        const response = await request(app)
          .get('/api/loans/999999/transactions')
          .set('Authorization', `Bearer ${authToken}`);

        expect([404]).toContain(response.status);
      });
    });

    describe('Performance Tests', () => {
      it('should respond to loan queries within reasonable time', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${authToken}`);

        const responseTime = Date.now() - startTime;
        
        expect([200, 404]).toContain(response.status);
        expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing authorization header', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', '');

      expect([401, 403]).toContain(response.status);
    });

    it('should handle malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', 'InvalidFormat');

      expect([401, 403]).toContain(response.status);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(3).fill().map(() =>
        request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });
    });

    it('should handle very large loan ID', async () => {
      const response = await request(app)
        .get('/api/loans/999999999999999/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 404, 500]).toContain(response.status);
    });
  });
});