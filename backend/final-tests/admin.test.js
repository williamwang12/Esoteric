/**
 * Admin Endpoint Tests
 * 
 * Comprehensive tests for admin-only endpoints including:
 * - User management and verification
 * - Loan administration  
 * - Transaction management
 * - Document administration
 * - Withdrawal request handling
 * - Meeting request management
 * - Excel import/export operations
 * - Yield deposit administration
 * - Authorization and permission checks
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  createUserSession,
  createTestLoan,
  createTestTransaction,
  createTestDocument,
  createTestYieldDeposit,
  createTestWithdrawalRequest,
  createTestMeetingRequest,
  createTestFile,
  generateRandomData,
  validateApiResponse
} = require('./helpers/test-utils');

// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

// Import server
const app = require('../server-2fa');

describe('Admin Endpoints', () => {
  let adminUser, adminToken, regularUser, regularUserToken;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create admin user
    adminUser = await createTestAdmin({
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User'
    });
    adminToken = await createUserSession(adminUser.id);

    // Create regular user
    regularUser = await createTestUser({
      email: 'user@example.com'
    });
    regularUserToken = await createUserSession(regularUser.id);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Authorization Checks', () => {
    test('should reject non-admin users from admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/admin/i);
    });

    test('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should allow admin users to access admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
    });
  });

  describe('GET /api/admin/users', () => {
    test('should return list of all users', async () => {
      // Create additional test users
      await createTestUser({ email: 'user1@example.com' });
      await createTestUser({ email: 'user2@example.com' });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['users']);
      
      expect(response.body.users).toHaveLength(4); // admin + regular + 2 new users
      expect(response.body.users[0]).toHaveProperty('id');
      expect(response.body.users[0]).toHaveProperty('email');
      expect(response.body.users[0]).not.toHaveProperty('password_hash');
    });

    test('should include user statistics and loan information', async () => {
      const user = await createTestUser();
      await createTestLoan(user.id);

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const userWithLoan = response.body.users.find(u => u.id === user.id);
      expect(userWithLoan).toBeDefined();
      expect(userWithLoan).toHaveProperty('loan_count');
      expect(userWithLoan.loan_count).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/admin/users/:userId/clear-temp-password', () => {
    test('should clear temporary password for user', async () => {
      // Set temporary password for user
      await pool.query(
        'UPDATE users SET temp_password = $1 WHERE id = $2',
        ['temp123', regularUser.id]
      );

      const response = await request(app)
        .put(`/api/admin/users/${regularUser.id}/clear-temp-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify temp_password was cleared
      const dbResult = await pool.query(
        'SELECT temp_password FROM users WHERE id = $1',
        [regularUser.id]
      );
      expect(dbResult.rows[0].temp_password).toBeNull();
    });

    test('should reject clearing temp password for non-existent user', async () => {
      const response = await request(app)
        .put('/api/admin/users/99999/clear-temp-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/admin/users/:userId', () => {
    test('should delete user and associated data', async () => {
      const userToDelete = await createTestUser({ email: 'delete@example.com' });
      const loan = await createTestLoan(userToDelete.id);
      await createTestTransaction(loan.id);
      await createTestDocument(userToDelete.id);

      const response = await request(app)
        .delete(`/api/admin/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/deleted/i);

      // Verify user was deleted
      const dbResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userToDelete.id]
      );
      expect(dbResult.rows).toHaveLength(0);
    });

    test('should not delete admin users', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/admin/i);
    });
  });

  describe('PUT /api/admin/users/:userId/verify', () => {
    test('should verify user account', async () => {
      const userToVerify = await createTestUser({ 
        accountVerified: false,
        email: 'verify@example.com' 
      });

      const response = await request(app)
        .put(`/api/admin/users/${userToVerify.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ verified: true })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify user was marked as verified
      const dbResult = await pool.query(
        'SELECT account_verified, verified_by_admin, verified_at FROM users WHERE id = $1',
        [userToVerify.id]
      );
      
      const user = dbResult.rows[0];
      expect(user.account_verified).toBe(true);
      expect(user.verified_by_admin).toBe(adminUser.id);
      expect(user.verified_at).toBeDefined();
    });

    test('should unverify user account', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUser.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ verified: false })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify user was marked as unverified
      const dbResult = await pool.query(
        'SELECT account_verified FROM users WHERE id = $1',
        [regularUser.id]
      );
      expect(dbResult.rows[0].account_verified).toBe(false);
    });
  });

  describe('POST /api/admin/create-loan', () => {
    test('should create loan for user', async () => {
      const loanData = {
        userId: regularUser.id,
        accountNumber: 'TEST-LOAN-001',
        principalAmount: 150000,
        monthlyRate: 0.015
      };

      const response = await request(app)
        .post('/api/admin/create-loan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(loanData)
        .expect(201);

      validateApiResponse(response, ['message', 'loan']);
      
      expect(response.body.loan).toHaveProperty('id');
      expect(response.body.loan.account_number).toBe(loanData.accountNumber);
      expect(parseFloat(response.body.loan.principal_amount)).toBe(loanData.principalAmount);

      // Verify loan in database
      const dbResult = await pool.query(
        'SELECT * FROM loan_accounts WHERE account_number = $1',
        [loanData.accountNumber]
      );
      expect(dbResult.rows).toHaveLength(1);
    });

    test('should reject creating loan with duplicate account number', async () => {
      const loanData = {
        userId: regularUser.id,
        accountNumber: 'DUPLICATE-001',
        principalAmount: 100000
      };

      // Create first loan
      await request(app)
        .post('/api/admin/create-loan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(loanData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/admin/create-loan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(loanData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/already exists/i);
    });

    test('should validate loan data', async () => {
      const response = await request(app)
        .post('/api/admin/create-loan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUser.id,
          // Missing required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('PUT /api/admin/loans/:loanId', () => {
    test('should update loan details', async () => {
      const loan = await createTestLoan(regularUser.id);
      const updateData = {
        principalAmount: 200000,
        monthlyRate: 0.02
      };

      const response = await request(app)
        .put(`/api/admin/loans/${loan.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify loan was updated
      const dbResult = await pool.query(
        'SELECT * FROM loan_accounts WHERE id = $1',
        [loan.id]
      );
      
      const updatedLoan = dbResult.rows[0];
      expect(parseFloat(updatedLoan.principal_amount)).toBe(updateData.principalAmount);
      expect(parseFloat(updatedLoan.monthly_rate)).toBe(updateData.monthlyRate);
    });
  });

  describe('DELETE /api/admin/loans/:loanId', () => {
    test('should delete loan and associated transactions', async () => {
      const loan = await createTestLoan(regularUser.id);
      await createTestTransaction(loan.id);

      const response = await request(app)
        .delete(`/api/admin/loans/${loan.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify loan was deleted
      const loanResult = await pool.query(
        'SELECT * FROM loan_accounts WHERE id = $1',
        [loan.id]
      );
      expect(loanResult.rows).toHaveLength(0);

      // Verify transactions were deleted
      const transactionResult = await pool.query(
        'SELECT * FROM loan_transactions WHERE loan_account_id = $1',
        [loan.id]
      );
      expect(transactionResult.rows).toHaveLength(0);
    });
  });

  describe('POST /api/admin/loans/:loanId/transactions', () => {
    test('should add transaction to loan', async () => {
      const loan = await createTestLoan(regularUser.id);
      const transactionData = {
        amount: 5000,
        transactionType: 'deposit',
        description: 'Admin deposit',
        transactionDate: '2024-01-01'
      };

      const response = await request(app)
        .post(`/api/admin/loans/${loan.id}/transactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transactionData)
        .expect(201);

      validateApiResponse(response, ['message', 'transaction']);
      
      expect(response.body.transaction).toHaveProperty('id');
      expect(parseFloat(response.body.transaction.amount)).toBe(transactionData.amount);
    });

    test('should update loan balance after transaction', async () => {
      const loan = await createTestLoan(regularUser.id, { currentBalance: 100000 });
      
      await request(app)
        .post(`/api/admin/loans/${loan.id}/transactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 10000,
          transactionType: 'deposit',
          description: 'Test deposit',
          transactionDate: '2024-01-01'
        })
        .expect(201);

      // Verify balance was updated
      const dbResult = await pool.query(
        'SELECT current_balance FROM loan_accounts WHERE id = $1',
        [loan.id]
      );
      expect(parseFloat(dbResult.rows[0].current_balance)).toBe(110000);
    });
  });

  describe('Withdrawal Request Management', () => {
    test('should get all withdrawal requests', async () => {
      const loan = await createTestLoan(regularUser.id);
      await createTestWithdrawalRequest(regularUser.id, loan.id);

      const response = await request(app)
        .get('/api/admin/withdrawal-requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['requests']);
      expect(response.body.requests).toHaveLength(1);
    });

    test('should update withdrawal request status', async () => {
      const loan = await createTestLoan(regularUser.id);
      const request_data = await createTestWithdrawalRequest(regularUser.id, loan.id);

      const response = await request(app)
        .put(`/api/admin/withdrawal-requests/${request_data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'approved',
          adminNotes: 'Request approved for processing'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify status was updated
      const dbResult = await pool.query(
        'SELECT status, admin_notes, reviewed_by FROM withdrawal_requests WHERE id = $1',
        [request_data.id]
      );
      
      const updatedRequest = dbResult.rows[0];
      expect(updatedRequest.status).toBe('approved');
      expect(updatedRequest.admin_notes).toBe('Request approved for processing');
      expect(updatedRequest.reviewed_by).toBe(adminUser.id);
    });

    test('should complete withdrawal request', async () => {
      const loan = await createTestLoan(regularUser.id, { currentBalance: 50000 });
      const withdrawal = await createTestWithdrawalRequest(regularUser.id, loan.id, {
        amount: 5000,
        status: 'approved'
      });

      const response = await request(app)
        .post(`/api/admin/withdrawal-requests/${withdrawal.id}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify withdrawal was completed and loan balance updated
      const loanResult = await pool.query(
        'SELECT current_balance, total_withdrawals FROM loan_accounts WHERE id = $1',
        [loan.id]
      );
      
      const updatedLoan = loanResult.rows[0];
      expect(parseFloat(updatedLoan.current_balance)).toBe(45000);
      expect(parseFloat(updatedLoan.total_withdrawals)).toBe(5000);
    });
  });

  describe('Meeting Request Management', () => {
    test('should get all meeting requests', async () => {
      await createTestMeetingRequest(regularUser.id);

      const response = await request(app)
        .get('/api/admin/meeting-requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['requests']);
      expect(response.body.requests).toHaveLength(1);
    });

    test('should update meeting request', async () => {
      const meeting = await createTestMeetingRequest(regularUser.id);

      const response = await request(app)
        .put(`/api/admin/meeting-requests/${meeting.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'scheduled',
          scheduledDate: '2024-02-01',
          scheduledTime: '15:00:00',
          meetingLink: 'https://zoom.us/j/123456789',
          adminNotes: 'Meeting scheduled'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify meeting was updated
      const dbResult = await pool.query(
        'SELECT status, scheduled_date, meeting_link FROM meeting_requests WHERE id = $1',
        [meeting.id]
      );
      
      const updatedMeeting = dbResult.rows[0];
      expect(updatedMeeting.status).toBe('scheduled');
      expect(updatedMeeting.meeting_link).toBe('https://zoom.us/j/123456789');
    });
  });

  describe('Document Management', () => {
    test('should upload document for user', async () => {
      const testFile = createTestFile('admin-upload.pdf', 'Admin uploaded document');

      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', testFile.path)
        .field('userId', regularUser.id)
        .field('title', 'Admin Document')
        .field('category', 'loan_agreement')
        .expect(201);

      validateApiResponse(response, ['message', 'document']);
      
      expect(response.body.document).toHaveProperty('id');
      expect(response.body.document.title).toBe('Admin Document');

      testFile.cleanup();
    });

    test('should get user documents', async () => {
      await createTestDocument(regularUser.id);

      const response = await request(app)
        .get(`/api/admin/users/${regularUser.id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['documents']);
      expect(response.body.documents).toHaveLength(1);
    });

    test('should delete document', async () => {
      const document = await createTestDocument(regularUser.id);

      const response = await request(app)
        .delete(`/api/admin/documents/${document.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify document was deleted
      const dbResult = await pool.query(
        'SELECT * FROM documents WHERE id = $1',
        [document.id]
      );
      expect(dbResult.rows).toHaveLength(0);
    });
  });

  describe('Excel Import/Export', () => {
    test('should generate Excel template for loan import', async () => {
      const response = await request(app)
        .get('/api/admin/loans/excel-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheet');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should generate Excel template for transaction import', async () => {
      const response = await request(app)
        .get('/api/admin/loans/excel-transactions-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheet');
    });

    test('should import loans from Excel', async () => {
      // Create test Excel file
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['User Email', 'Account Number', 'Principal Amount', 'Monthly Rate'],
        [regularUser.email, 'EXCEL-001', 75000, 0.01],
        [regularUser.email, 'EXCEL-002', 100000, 0.015]
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans');
      
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const excelPath = path.join(__dirname, 'temp-loans.xlsx');
      fs.writeFileSync(excelPath, excelBuffer);

      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', excelPath)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('results');
      expect(response.body.results.successful).toBe(2);

      // Clean up
      fs.unlinkSync(excelPath);

      // Verify loans were created
      const dbResult = await pool.query(
        'SELECT * FROM loan_accounts WHERE account_number IN ($1, $2)',
        ['EXCEL-001', 'EXCEL-002']
      );
      expect(dbResult.rows).toHaveLength(2);
    });
  });

  describe('Yield Deposit Management', () => {
    test('should get all yield deposits', async () => {
      await createTestYieldDeposit(regularUser.id);

      const response = await request(app)
        .get('/api/admin/yield-deposits')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['deposits']);
      expect(response.body.deposits).toHaveLength(1);
    });

    test('should create new yield deposit', async () => {
      const depositData = {
        userId: regularUser.id,
        principalAmount: 75000,
        annualYieldRate: 0.15,
        startDate: '2024-01-01',
        notes: 'Admin created deposit'
      };

      const response = await request(app)
        .post('/api/admin/yield-deposits')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(depositData)
        .expect(201);

      validateApiResponse(response, ['message', 'deposit']);
      
      expect(response.body.deposit).toHaveProperty('id');
      expect(parseFloat(response.body.deposit.principal_amount)).toBe(depositData.principalAmount);
    });

    test('should update yield deposit', async () => {
      const deposit = await createTestYieldDeposit(regularUser.id);
      const updateData = {
        principalAmount: 60000,
        annualYieldRate: 0.13,
        status: 'inactive'
      };

      const response = await request(app)
        .put(`/api/admin/yield-deposits/${deposit.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify deposit was updated
      const dbResult = await pool.query(
        'SELECT * FROM yield_deposits WHERE id = $1',
        [deposit.id]
      );
      
      const updatedDeposit = dbResult.rows[0];
      expect(parseFloat(updatedDeposit.principal_amount)).toBe(updateData.principalAmount);
      expect(updatedDeposit.status).toBe(updateData.status);
    });

    test('should delete yield deposit', async () => {
      const deposit = await createTestYieldDeposit(regularUser.id);

      const response = await request(app)
        .delete(`/api/admin/yield-deposits/${deposit.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify deposit was deleted
      const dbResult = await pool.query(
        'SELECT * FROM yield_deposits WHERE id = $1',
        [deposit.id]
      );
      expect(dbResult.rows).toHaveLength(0);
    });

    test('should process yield deposit payout', async () => {
      const deposit = await createTestYieldDeposit(regularUser.id, {
        principalAmount: 50000,
        annualYieldRate: 0.12,
        startDate: '2024-01-01'
      });

      const response = await request(app)
        .post(`/api/admin/yield-deposits/${deposit.id}/payout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      
      // Verify payout was recorded
      const payoutResult = await pool.query(
        'SELECT * FROM yield_payouts WHERE deposit_id = $1',
        [deposit.id]
      );
      expect(payoutResult.rows).toHaveLength(1);

      // Verify last_payout_date was updated
      const depositResult = await pool.query(
        'SELECT last_payout_date, total_paid_out FROM yield_deposits WHERE id = $1',
        [deposit.id]
      );
      expect(depositResult.rows[0].last_payout_date).toBeDefined();
      expect(parseFloat(depositResult.rows[0].total_paid_out)).toBeGreaterThan(0);
    });
  });

  describe('Analytics and Reporting', () => {
    test('should get loan analytics', async () => {
      const loan = await createTestLoan(regularUser.id);
      await createTestTransaction(loan.id, { amount: 1000, transactionType: 'deposit' });
      await createTestTransaction(loan.id, { amount: 500, transactionType: 'withdrawal' });

      const response = await request(app)
        .get(`/api/loans/${loan.id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['analytics']);
      expect(response.body.analytics).toHaveProperty('totalDeposits');
      expect(response.body.analytics).toHaveProperty('totalWithdrawals');
      expect(response.body.analytics).toHaveProperty('transactionCount');
    });

    test('should get user transaction history', async () => {
      const loan = await createTestLoan(regularUser.id);
      await createTestTransaction(loan.id);

      const response = await request(app)
        .get(`/api/admin/users/${regularUser.id}/transactions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['transactions']);
      expect(response.body.transactions).toHaveLength(1);
    });

    test('should get all loans with pagination', async () => {
      // Create multiple loans
      for (let i = 0; i < 15; i++) {
        const user = await createTestUser({ email: `user${i}@example.com` });
        await createTestLoan(user.id);
      }

      const response = await request(app)
        .get('/api/admin/loans?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      validateApiResponse(response, ['loans', 'totalLoans', 'totalPages']);
      expect(response.body.loans).toHaveLength(10);
      expect(response.body.totalPages).toBeGreaterThan(1);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce stricter rate limiting on admin endpoints', async () => {
      // Make multiple rapid requests
      const promises = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const responses = await Promise.all(promises);
      
      // Should have some rate limited responses
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});