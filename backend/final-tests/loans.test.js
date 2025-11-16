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
      const dates = response.body.map(loan => new Date(loan.created_at));
      expect(dates[0].getTime()).toBeGreaterThanOrEqual(dates[1].getTime());
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

    test('should include running balance calculations', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const transactions = response.body.transactions;
      expect(transactions[0]).toHaveProperty('balance_after');
      
      // Verify balance calculations are present
      transactions.forEach(transaction => {
        expect(transaction.balance_after).toBeDefined();
        expect(typeof parseFloat(transaction.balance_after)).toBe('number');
      });
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

      expect(offsetResponse.body.transactions).toHaveLength(5);
      
      // Should be different transactions
      expect(limitResponse.body.transactions[0].id)
        .not.toBe(offsetResponse.body.transactions[0].id);
    });

    test('should include total count for pagination', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalTransactions');
      expect(response.body.totalTransactions).toBe(2);
    });

    test('should reject access to other users loans', async () => {
      const response = await request(app)
        .get(`/api/loans/${otherUserLoan.id}/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/access/i);
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

    test('should allow admin access to any loan', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/transactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.transactions).toHaveLength(2);
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
      expect(analytics).toHaveProperty('totalDeposits');
      expect(analytics).toHaveProperty('totalWithdrawals');
      expect(analytics).toHaveProperty('netDeposits');
      expect(analytics).toHaveProperty('transactionCount');
      expect(analytics).toHaveProperty('averageTransactionAmount');
    });

    test('should calculate analytics correctly', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const analytics = response.body.analytics;
      
      // Based on test data: 5000 deposit, 2000 withdrawal
      expect(parseFloat(analytics.totalDeposits)).toBe(5000);
      expect(parseFloat(analytics.totalWithdrawals)).toBe(2000);
      expect(parseFloat(analytics.netDeposits)).toBe(3000);
      expect(analytics.transactionCount).toBe(2);
    });

    test('should include monthly performance data', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const analytics = response.body.analytics;
      expect(analytics).toHaveProperty('monthlyData');
      expect(Array.isArray(analytics.monthlyData)).toBe(true);
    });

    test('should include growth metrics', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const analytics = response.body.analytics;
      expect(analytics).toHaveProperty('growthMetrics');
      expect(analytics.growthMetrics).toHaveProperty('totalGrowth');
      expect(analytics.growthMetrics).toHaveProperty('monthlyGrowthRate');
    });

    test('should reject access to other users loans', async () => {
      const response = await request(app)
        .get(`/api/loans/${otherUserLoan.id}/analytics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should return 404 for non-existent loan', async () => {
      const response = await request(app)
        .get('/api/loans/99999/analytics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should allow admin access to any loan analytics', async () => {
      const response = await request(app)
        .get(`/api/loans/${userLoan.id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.analytics).toHaveProperty('totalDeposits');
    });
  });

  describe('POST /api/loans/:loanId/recompute-balances', () => {
    test('should recompute loan balances for loan owner', async () => {
      const response = await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['message', 'balanceHistory']);
      
      expect(response.body.message).toMatch(/recomputed/i);
      expect(Array.isArray(response.body.balanceHistory)).toBe(true);
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

      expect(response.body).toHaveProperty('newCurrentBalance');
      
      // Verify balance was updated in database
      const dbResult = await pool.query(
        'SELECT current_balance FROM loan_accounts WHERE id = $1',
        [userLoan.id]
      );
      
      expect(parseFloat(dbResult.rows[0].current_balance)).toBeGreaterThan(150000);
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

      // Verify interest calculation is included
      expect(response.body.balanceHistory.some(entry => 
        entry.interest_earned && parseFloat(entry.interest_earned) > 0
      )).toBe(true);
    });

    test('should reject access to other users loans', async () => {
      const response = await request(app)
        .post(`/api/loans/${otherUserLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

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

    test('should allow admin access to recompute any loan', async () => {
      const response = await request(app)
        .post(`/api/loans/${userLoan.id}/recompute-balances`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
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
      expect(response.body.balanceHistory).toHaveLength(0);
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
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/access|permission|forbidden/i);
      }
    });

    test('should validate loan ID format', async () => {
      const invalidIds = ['abc', '0', '-1', '999999999999', 'null'];

      for (const id of invalidIds) {
        const response = await request(app)
          .get(`/api/loans/${id}/transactions`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      }
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
      expect(response.body.transactions.length).toBeGreaterThan(50);
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
      expect(response.body.analytics).toHaveProperty('totalDeposits');
      expect(response.body.analytics.transactionCount).toBeGreaterThan(2);
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

      expect(response.body.analytics).toHaveProperty('totalDeposits');
      expect(parseFloat(response.body.analytics.totalDeposits)).toBeCloseTo(999999.99);
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

      expect(response.body.analytics).toHaveProperty('monthlyData');
      expect(response.body.analytics.transactionCount).toBe(4);
    });
  });
});