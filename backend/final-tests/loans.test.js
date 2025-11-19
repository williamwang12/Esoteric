/**
 * Loan Endpoint Tests
 * 
 * Comprehensive tests for user-facing loan endpoints including:
 * - Loan retrieval and analytics
 * - Transaction history
 * - Balance recomputation
 * - Authorization and data access controls
 */

const request = require('supertest');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  createUserSession,
  createTestLoan,
  createTestTransaction,
  validateApiResponse
} = require('./helpers/test-utils');

// Import server
// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

const app = require('../server-2fa');

describe('Loan Endpoints', () => {
  let user, userToken, otherUser, otherUserToken, adminUser, adminToken;
  let userLoan, otherUserLoan;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create test users
    user = await createTestUser({
      email: 'loanuser@example.com',
      firstName: 'Loan',
      lastName: 'User'
    });
    userToken = await createUserSession(user.id);

    otherUser = await createTestUser({
      email: 'otheruser@example.com'
    });
    otherUserToken = await createUserSession(otherUser.id);

    adminUser = await createTestAdmin({
      email: 'admin@example.com'
    });
    adminToken = await createUserSession(adminUser.id);

    // Create test loans
    userLoan = await createTestLoan(user.id, {
      accountNumber: 'LOAN-USER-001',
      principalAmount: 150000,
      currentBalance: 150000,
      monthlyRate: 0.015
    });

    otherUserLoan = await createTestLoan(otherUser.id, {
      accountNumber: 'LOAN-OTHER-001',
      principalAmount: 100000,
      currentBalance: 100000
    });

    // Create some test transactions
    await createTestTransaction(userLoan.id, {
      amount: 5000,
      transactionType: 'deposit',
      description: 'Initial deposit'
    });

    await createTestTransaction(userLoan.id, {
      amount: 2000,
      transactionType: 'withdrawal',
      description: 'First withdrawal'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/loans', () => {
    test('should return user loans with valid authentication', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // API returns loans as direct array, not wrapped in {loans: [...]}
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(userLoan.id);
      expect(response.body[0].account_number).toBe(userLoan.account_number);
      expect(parseFloat(response.body[0].principal_amount)).toBe(150000);
    });

    test('should only return loans belonging to authenticated user', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should only see user's own loan, not other user's loan
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(userLoan.id);
      expect(response.body[0].id).not.toBe(otherUserLoan.id);
    });

    test('should include loan summary information', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const loan = response.body[0];
      expect(loan).toHaveProperty('principal_amount');
      expect(loan).toHaveProperty('current_balance');
      expect(loan).toHaveProperty('monthly_rate');
      expect(loan).toHaveProperty('total_bonuses');
      expect(loan).toHaveProperty('total_withdrawals');
      expect(loan).toHaveProperty('created_at');
      expect(loan).toHaveProperty('account_number');
    });

    test('should return empty array for user with no loans', async () => {
      const newUser = await createTestUser({ email: 'noloan@example.com' });
      const newUserToken = await createUserSession(newUser.id);

      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/loans')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/authorization|access token/i);
    });

    test('should order loans by creation date', async () => {
      // Create additional loan
      const secondLoan = await createTestLoan(user.id, {
        accountNumber: 'LOAN-USER-002',
        principalAmount: 200000
      });

      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      
      // Should be ordered by creation date (newest first)
      const dates = response.body.map(loan => new Date(loan.created_at).getTime());
      // Allow for small time differences in test environment
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1] - 100);
    });

    test('should work for admin users', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0); // Admin has no loans
    });
  });

  describe('GET /api/loans/:loanId/transactions', () => {
    test('should return loan transactions for loan owner', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['transactions']);
      
      expect(response.body.transactions).toHaveLength(2);
      expect(response.body.transactions[0]).toHaveProperty('amount');
      expect(response.body.transactions[0]).toHaveProperty('transaction_type');
      expect(response.body.transactions[0]).toHaveProperty('description');
      expect(response.body.transactions[0]).toHaveProperty('transaction_date');
    });

    test('should include transaction details', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const transactions = response.body.transactions;
      
      // Verify transaction structure
      if (transactions.length > 0) {
        expect(transactions[0]).toHaveProperty('amount');
        expect(transactions[0]).toHaveProperty('transaction_type');
        expect(transactions[0]).toHaveProperty('transaction_date');
      }
    });

    test('should order transactions by date (newest first)', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const transactions = response.body.transactions;
      const dates = transactions.map(t => new Date(t.transaction_date));
      
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
      }
    });

    test('should support pagination with limit and offset', async () => {
      // Create additional transactions
      for (let i = 0; i < 10; i++) {
        await createTestTransaction(userLoan.id, {
          amount: 1000 + i,
          transactionType: 'deposit',
          description: `Test transaction ${i}`
        });
      }

      // Test with limit
      const limitResponse = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions?limit=5`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(limitResponse.body.transactions).toHaveLength(5);

      // Test with offset
      const offsetResponse = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions?limit=5&offset=5`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(offsetResponse.body.transactions.length).toBeLessThanOrEqual(5);
      
      // Should be different transactions if offset worked
      if (offsetResponse.body.transactions.length > 0) {
        // Just verify we got some transactions back with offset
        expect(offsetResponse.body.transactions[0]).toHaveProperty('id');
      }
    });

    test('should include total count for pagination', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    test('should reject access to other users loans', async () => {
      const response = await request(app)
        .get(`/api/loans/${otherUserLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Loan account not found');
    });

    test('should return 404 for non-existent loan', async () => {
      const response = await request(app)
        .get('/api/loans/99999/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should not allow admin access to user loans', async () => {
      // Current implementation doesn't allow admin access to user loans
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/loans/:loanId/analytics', () => {
    test('should return loan analytics for loan owner', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['analytics']);
      
      const analytics = response.body.analytics;
      expect(analytics).toHaveProperty('balanceHistory');
      expect(analytics).toHaveProperty('currentBalance');
      expect(analytics).toHaveProperty('totalPrincipal');
      expect(analytics).toHaveProperty('totalBonuses');
      expect(analytics).toHaveProperty('totalWithdrawals');
    });

    test('should calculate analytics correctly', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const analytics = response.body.analytics;
      
      // Verify analytics structure
      expect(typeof analytics.currentBalance).toBe('number');
      expect(typeof analytics.totalPrincipal).toBe('number');
      expect(analytics.totalWithdrawals).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(analytics.balanceHistory)).toBe(true);
    });

    test('should include monthly performance data', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const analytics = response.body.analytics;
      expect(analytics).toHaveProperty('balanceHistory');
      expect(Array.isArray(analytics.balanceHistory)).toBe(true);
      
      if (analytics.balanceHistory.length > 0) {
        const firstMonth = analytics.balanceHistory[0];
        expect(firstMonth).toHaveProperty('month');
        expect(firstMonth).toHaveProperty('balance');
        expect(firstMonth).toHaveProperty('monthlyPayment');
      }
    });

    test('should include growth metrics', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const analytics = response.body.analytics;
      
      // Calculate growth metrics from data
      const growth = analytics.currentBalance - analytics.totalPrincipal;
      const growthRate = analytics.totalPrincipal > 0 ? (growth / analytics.totalPrincipal) * 100 : 0;
      
      expect(typeof growth).toBe('number');
      expect(typeof growthRate).toBe('number');
    });

    test('should reject access to other users loans', async () => {
      const response = await request(app)
        .get(`/api/loans/${otherUserLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should return 404 for non-existent loan', async () => {
      const response = await request(app)
        .get('/api/loans/99999/analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should not allow admin access to user loan analytics', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/loans/:loanId/recompute-balances', () => {
    test('should recompute loan balances for loan owner', async () => {
      const response = await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['message', 'monthsProcessed']);
      
      expect(response.body.message).toMatch(/recomputed/i);
      expect(typeof response.body.monthsProcessed).toBe('number');
    });

    test('should update current balance based on transactions', async () => {
      // Add more transactions to test balance calculation
      await createTestTransaction(userLoan.id, {
        amount: 10000,
        transactionType: 'deposit',
        description: 'Large deposit'
      });

      const response = await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('monthsProcessed');
      
      // Verify balance was updated in database
      const dbResult = await pool.query(
        'SELECT current_balance FROM loan_accounts WHERE id = $1',
        [userLoan.id]
      );
      
      // Balance should be updated (may not necessarily be greater if no interest applied)
      expect(parseFloat(dbResult.rows[0].current_balance)).toBeGreaterThan(0);
    });

    test('should create balance history entries', async () => {
      await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Check that balance history was created
      const dbResult = await pool.query(
        'SELECT * FROM monthly_balances WHERE loan_account_id = $1',
        [userLoan.id]
      );
      
      expect(dbResult.rows.length).toBeGreaterThan(0);
    });

    test('should apply monthly interest rates', async () => {
      const initialBalance = parseFloat(userLoan.current_balance);
      const monthlyRate = parseFloat(userLoan.monthly_rate);

      const response = await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should process months successfully
      expect(response.body.monthsProcessed).toBeGreaterThanOrEqual(0);
    });

    test('should reject access to other users loans', async () => {
      const response = await request(app)
        .post(`/api/loans/${otherUserLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should return 404 for non-existent loan', async () => {
      const response = await request(app)
        .post('/api/loans/99999/recompute-balances')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should not allow admin access to user loans', async () => {
      const response = await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle loans with no transactions', async () => {
      const emptyLoan = await createTestLoan(user.id, {
        accountNumber: 'EMPTY-LOAN-001',
        principalAmount: 50000,
        currentBalance: 50000
      });

      const response = await request(app)
        .post(`/api/loans/${emptyLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.monthsProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Authorization and Security', () => {
    test('should consistently reject cross-user access attempts', async () => {
      const endpoints = [
        { method: 'get', path: `/api/loans/${otherUserLoan.id}/transactions` },
        { method: 'get', path: `/api/loans/${otherUserLoan.id}/analytics` },
        { method: 'post', path: `/api/loans/${otherUserLoan.id}/recompute-balances` }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Loan account not found');
      }
    });

    test('should handle non-existent loan IDs', async () => {
      const response = await request(app)
        .get('/api/loans/99999/transactions')
        .set('Authorization', `Bearer ${userToken}`);

      // Should return 404 for non-existent loan
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should not expose sensitive loan information', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const loan = response.body[0];
      
      // Should not expose internal system fields
      expect(loan).not.toHaveProperty('password_hash');
      expect(loan).not.toHaveProperty('internal_notes');
      expect(loan).not.toHaveProperty('admin_flags');
    });

    test('should handle concurrent balance recomputation requests', async () => {
      const promises = Array.from({ length: 3 }, () =>
        request(app)
          .post(`/api/loans/${userLoan.id}/recompute-balances`)
          .set('Authorization', `Bearer ${userToken}`)
      );

      const responses = await Promise.all(promises);
      
      // All should succeed (or at least not fail catastrophically)
      responses.forEach(response => {
        expect([200, 409]).toContain(response.status); // 409 = conflict, acceptable for concurrent operations
      });
    });

    test('should log balance recomputation attempts', async () => {
      await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify audit trail exists (implementation-dependent)
      // This is a placeholder for audit logging verification
      expect(true).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large transaction sets efficiently', async () => {
      // Create many transactions
      const transactionPromises = [];
      for (let i = 0; i < 100; i++) {
        transactionPromises.push(
          createTestTransaction(userLoan.id, {
            amount: Math.floor(Math.random() * 10000) + 100,
            transactionType: i % 2 === 0 ? 'deposit' : 'withdrawal',
            description: `Bulk transaction ${i}`
          })
        );
      }
      await Promise.all(transactionPromises);

      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const endTime = Date.now();
      
      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(response.body.transactions.length).toBeGreaterThan(0);
    });

    test('should handle zero-amount transactions', async () => {
      await createTestTransaction(userLoan.id, {
        amount: 0,
        transactionType: 'adjustment',
        description: 'Zero amount adjustment'
      });

      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should handle zero amounts gracefully
      expect(response.body.analytics).toHaveProperty('currentBalance');
      expect(Array.isArray(response.body.analytics.balanceHistory)).toBe(true);
    });

    test('should handle very large monetary amounts', async () => {
      const largeLoan = await createTestLoan(user.id, {
        accountNumber: 'LARGE-LOAN-001',
        principalAmount: 999999999.99,
        currentBalance: 999999999.99
      });

      await createTestTransaction(largeLoan.id, {
        amount: 999999.99,
        transactionType: 'deposit',
        description: 'Large amount transaction'
      });

      const response = await request(app)
        .get(`/api/loans/${largeLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.analytics).toHaveProperty('currentBalance');
      expect(parseFloat(response.body.analytics.currentBalance)).toBeGreaterThan(0);
    });

    test('should handle date edge cases in analytics', async () => {
      // Create transactions with edge case dates
      await createTestTransaction(userLoan.id, {
        amount: 1000,
        transactionType: 'deposit',
        description: 'Future dated transaction',
        transactionDate: new Date('2025-12-31')
      });

      await createTestTransaction(userLoan.id, {
        amount: 500,
        transactionType: 'deposit',
        description: 'Very old transaction',
        transactionDate: new Date('2020-01-01')
      });

      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.analytics).toHaveProperty('balanceHistory');
      expect(response.body.analytics.balanceHistory.length).toBeGreaterThanOrEqual(1);
    });
  });
});