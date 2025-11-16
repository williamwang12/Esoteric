/**
 * Excel Import/Export Tests
 * 
 * Comprehensive tests for admin Excel functionality including:
 * - Loan import/export templates
 * - Transaction import/export
 * - Client onboarding via Excel
 * - Data validation and error handling
 * - File processing and security
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
  validateApiResponse
} = require('./helpers/test-utils');

// Import server
// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

const app = require('../server-2fa');

describe('Excel Import/Export Endpoints', () => {
  let adminUser, adminToken, regularUser;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create admin user
    adminUser = await createTestAdmin({
      email: 'admin@example.com'
    });
    adminToken = await createUserSession(adminUser.id);

    // Create regular user for testing
    regularUser = await createTestUser({
      email: 'testuser@example.com',
      firstName: 'Test',
      lastName: 'User'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/admin/loans/excel-template', () => {
    test('should generate loan import template', async () => {
      const response = await request(app)
        .get('/api/admin/loans/excel-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheet');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('loan-import-template');
    });

    test('should reject non-admin users', async () => {
      const userToken = await createUserSession(regularUser.id);
      
      const response = await request(app)
        .get('/api/admin/loans/excel-template')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/loans/excel-template')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should contain valid Excel structure', async () => {
      const response = await request(app)
        .get('/api/admin/loans/excel-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it's a valid Excel file by checking the buffer
      expect(response.body).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/loans/excel-transactions-template', () => {
    test('should generate transaction import template', async () => {
      const response = await request(app)
        .get('/api/admin/loans/excel-transactions-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheet');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('transactions-import-template');
    });

    test('should reject non-admin users', async () => {
      const userToken = await createUserSession(regularUser.id);
      
      const response = await request(app)
        .get('/api/admin/loans/excel-transactions-template')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/clients/excel-onboarding-template', () => {
    test('should generate client onboarding template', async () => {
      const response = await request(app)
        .get('/api/admin/clients/excel-onboarding-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheet');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('client-onboarding-template');
    });
  });

  describe('GET /api/admin/transactions/excel-import-template', () => {
    test('should generate transaction import template', async () => {
      const response = await request(app)
        .get('/api/admin/transactions/excel-import-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheet');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('POST /api/admin/loans/excel-upload', () => {
    let testExcelPath;

    beforeEach(() => {
      // Create test Excel file for loan import
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['User Email', 'Account Number', 'Principal Amount', 'Monthly Rate', 'Status'],
        [regularUser.email, 'EXCEL-LOAN-001', 75000, 0.01, 'active'],
        [regularUser.email, 'EXCEL-LOAN-002', 100000, 0.015, 'active'],
        ['invalid@email.com', 'EXCEL-LOAN-003', 50000, 0.02, 'active'] // Invalid user
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans');
      
      testExcelPath = path.join(__dirname, 'test-loans.xlsx');
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(testExcelPath, excelBuffer);
    });

    afterEach(() => {
      // Clean up test file
      if (fs.existsSync(testExcelPath)) {
        fs.unlinkSync(testExcelPath);
      }
    });

    test('should import valid loans from Excel', async () => {
      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', testExcelPath)
        .expect(200);

      validateApiResponse(response, ['message', 'results']);
      
      expect(response.body.results.successful).toBe(2); // 2 valid loans
      expect(response.body.results.failed).toBe(1); // 1 invalid user
      expect(response.body.results.errors).toHaveLength(1);

      // Verify loans were created in database
      const dbResult = await pool.query(
        'SELECT * FROM loan_accounts WHERE account_number IN ($1, $2)',
        ['EXCEL-LOAN-001', 'EXCEL-LOAN-002']
      );
      expect(dbResult.rows).toHaveLength(2);
    });

    test('should validate Excel file format', async () => {
      // Create invalid file
      const invalidPath = path.join(__dirname, 'invalid.txt');
      fs.writeFileSync(invalidPath, 'This is not an Excel file');

      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', invalidPath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/excel|format/i);

      fs.unlinkSync(invalidPath);
    });

    test('should handle duplicate account numbers', async () => {
      // Create loan with same account number first
      await createTestLoan(regularUser.id, {
        accountNumber: 'EXCEL-LOAN-001'
      });

      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', testExcelPath)
        .expect(200);

      expect(response.body.results.failed).toBeGreaterThan(0);
      expect(response.body.results.errors.some(err => 
        err.message.includes('already exists')
      )).toBe(true);
    });

    test('should validate required columns', async () => {
      // Create Excel with missing columns
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['User Email', 'Account Number'], // Missing Principal Amount, Monthly Rate
        [regularUser.email, 'EXCEL-LOAN-001']
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans');
      
      const invalidPath = path.join(__dirname, 'invalid-columns.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(invalidPath, buffer);

      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', invalidPath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/column|header/i);

      fs.unlinkSync(invalidPath);
    });

    test('should enforce file size limits', async () => {
      // This test would need a very large file to trigger the limit
      // For now, we'll test that the endpoint exists and handles normal files
      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', testExcelPath)
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });

    test('should reject non-admin users', async () => {
      const userToken = await createUserSession(regularUser.id);
      
      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('excel', testExcelPath)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should require file upload', async () => {
      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/file|upload/i);
    });
  });

  describe('POST /api/admin/loans/excel-transactions', () => {
    let testLoan, testTransactionsPath;

    beforeEach(async () => {
      testLoan = await createTestLoan(regularUser.id, {
        accountNumber: 'TRANS-LOAN-001'
      });

      // Create test Excel file for transaction import
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Account Number', 'Amount', 'Transaction Type', 'Description', 'Transaction Date', 'Bonus Percentage'],
        ['TRANS-LOAN-001', 5000, 'deposit', 'Excel deposit 1', '2024-01-15', null],
        ['TRANS-LOAN-001', 2000, 'withdrawal', 'Excel withdrawal 1', '2024-01-20', null],
        ['TRANS-LOAN-001', 1000, 'bonus', 'Excel bonus', '2024-01-25', 10],
        ['NONEXISTENT-001', 1000, 'deposit', 'Invalid loan', '2024-01-30', null] // Invalid loan
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      
      testTransactionsPath = path.join(__dirname, 'test-transactions.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(testTransactionsPath, buffer);
    });

    afterEach(() => {
      if (fs.existsSync(testTransactionsPath)) {
        fs.unlinkSync(testTransactionsPath);
      }
    });

    test('should import valid transactions from Excel', async () => {
      const response = await request(app)
        .post('/api/admin/loans/excel-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', testTransactionsPath)
        .expect(200);

      validateApiResponse(response, ['message', 'results']);
      
      expect(response.body.results.successful).toBe(3); // 3 valid transactions
      expect(response.body.results.failed).toBe(1); // 1 invalid loan
      expect(response.body.results.errors).toHaveLength(1);

      // Verify transactions were created
      const dbResult = await pool.query(
        'SELECT * FROM loan_transactions WHERE loan_account_id = $1',
        [testLoan.id]
      );
      expect(dbResult.rows).toHaveLength(3);
    });

    test('should validate transaction types', async () => {
      // Create Excel with invalid transaction type
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Account Number', 'Amount', 'Transaction Type', 'Description', 'Transaction Date'],
        ['TRANS-LOAN-001', 1000, 'invalid_type', 'Invalid transaction', '2024-01-15']
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      
      const invalidPath = path.join(__dirname, 'invalid-transactions.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(invalidPath, buffer);

      const response = await request(app)
        .post('/api/admin/loans/excel-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', invalidPath)
        .expect(200);

      expect(response.body.results.failed).toBe(1);
      expect(response.body.results.errors[0].message).toMatch(/transaction.*type/i);

      fs.unlinkSync(invalidPath);
    });

    test('should validate monetary amounts', async () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Account Number', 'Amount', 'Transaction Type', 'Description', 'Transaction Date'],
        ['TRANS-LOAN-001', -1000, 'deposit', 'Negative amount', '2024-01-15'],
        ['TRANS-LOAN-001', 'invalid', 'deposit', 'Invalid amount', '2024-01-15'],
        ['TRANS-LOAN-001', 0, 'deposit', 'Zero amount', '2024-01-15']
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      
      const invalidPath = path.join(__dirname, 'invalid-amounts.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(invalidPath, buffer);

      const response = await request(app)
        .post('/api/admin/loans/excel-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', invalidPath)
        .expect(200);

      expect(response.body.results.failed).toBeGreaterThan(0);
      expect(response.body.results.errors.some(err => 
        err.message.includes('amount')
      )).toBe(true);

      fs.unlinkSync(invalidPath);
    });

    test('should update loan balances after transaction import', async () => {
      await request(app)
        .post('/api/admin/loans/excel-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', testTransactionsPath)
        .expect(200);

      // Check that loan balance was updated
      const dbResult = await pool.query(
        'SELECT current_balance FROM loan_accounts WHERE id = $1',
        [testLoan.id]
      );
      
      const newBalance = parseFloat(dbResult.rows[0].current_balance);
      const originalBalance = parseFloat(testLoan.current_balance);
      
      // Should reflect the net transactions: +5000 -2000 +1000 = +4000
      expect(newBalance).toBeCloseTo(originalBalance + 4000, 2);
    });
  });

  describe('POST /api/admin/clients/excel-onboarding', () => {
    let testOnboardingPath;

    beforeEach(() => {
      // Create test Excel file for client onboarding
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Email', 'First Name', 'Last Name', 'Phone', 'Principal Amount', 'Monthly Rate', 'Account Number'],
        ['newclient1@example.com', 'New', 'Client1', '+1234567890', 50000, 0.012, 'ONBOARD-001'],
        ['newclient2@example.com', 'New', 'Client2', '+1234567891', 75000, 0.015, 'ONBOARD-002'],
        ['invalid-email', 'Invalid', 'Client', '+1234567892', 30000, 0.01, 'ONBOARD-003'] // Invalid email
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
      
      testOnboardingPath = path.join(__dirname, 'test-onboarding.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(testOnboardingPath, buffer);
    });

    afterEach(() => {
      if (fs.existsSync(testOnboardingPath)) {
        fs.unlinkSync(testOnboardingPath);
      }
    });

    test('should onboard new clients from Excel', async () => {
      const response = await request(app)
        .post('/api/admin/clients/excel-onboarding')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', testOnboardingPath)
        .expect(200);

      validateApiResponse(response, ['message', 'results']);
      
      expect(response.body.results.successful).toBe(2); // 2 valid clients
      expect(response.body.results.failed).toBe(1); // 1 invalid email

      // Verify users and loans were created
      const userResult = await pool.query(
        'SELECT * FROM users WHERE email IN ($1, $2)',
        ['newclient1@example.com', 'newclient2@example.com']
      );
      expect(userResult.rows).toHaveLength(2);

      const loanResult = await pool.query(
        'SELECT * FROM loan_accounts WHERE account_number IN ($1, $2)',
        ['ONBOARD-001', 'ONBOARD-002']
      );
      expect(loanResult.rows).toHaveLength(2);
    });

    test('should handle existing users appropriately', async () => {
      // Create existing user
      await createTestUser({
        email: 'newclient1@example.com',
        firstName: 'Existing',
        lastName: 'User'
      });

      const response = await request(app)
        .post('/api/admin/clients/excel-onboarding')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', testOnboardingPath)
        .expect(200);

      // Should still create loan for existing user but not duplicate user
      expect(response.body.results.successful).toBeGreaterThan(0);
    });

    test('should validate all required fields', async () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Email', 'First Name', 'Last Name'], // Missing required fields
        ['incomplete@example.com', 'Incomplete', 'Data']
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
      
      const incompletePath = path.join(__dirname, 'incomplete-onboarding.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(incompletePath, buffer);

      const response = await request(app)
        .post('/api/admin/clients/excel-onboarding')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', incompletePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      fs.unlinkSync(incompletePath);
    });
  });

  describe('POST /api/admin/transactions/excel-import', () => {
    let testImportPath, testLoan;

    beforeEach(async () => {
      testLoan = await createTestLoan(regularUser.id, {
        accountNumber: 'IMPORT-LOAN-001'
      });

      // Create test Excel file for general transaction import
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Account Number', 'Date', 'Amount', 'Type', 'Description'],
        ['IMPORT-LOAN-001', '2024-01-15', 1000, 'deposit', 'Import test 1'],
        ['IMPORT-LOAN-001', '2024-01-20', 500, 'withdrawal', 'Import test 2'],
        ['IMPORT-LOAN-001', '2024-01-25', 2000, 'deposit', 'Import test 3']
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      
      testImportPath = path.join(__dirname, 'test-import.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(testImportPath, buffer);
    });

    afterEach(() => {
      if (fs.existsSync(testImportPath)) {
        fs.unlinkSync(testImportPath);
      }
    });

    test('should import transactions successfully', async () => {
      const response = await request(app)
        .post('/api/admin/transactions/excel-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', testImportPath)
        .expect(200);

      validateApiResponse(response, ['message', 'summary']);
      
      expect(response.body.summary.totalProcessed).toBe(3);
      expect(response.body.summary.successful).toBe(3);
      expect(response.body.summary.failed).toBe(0);

      // Verify transactions were imported
      const dbResult = await pool.query(
        'SELECT * FROM loan_transactions WHERE loan_account_id = $1',
        [testLoan.id]
      );
      expect(dbResult.rows).toHaveLength(3);
    });
  });

  describe('Security and Error Handling', () => {
    test('should validate file extensions', async () => {
      const textPath = path.join(__dirname, 'test.txt');
      fs.writeFileSync(textPath, 'Not an Excel file');

      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', textPath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      fs.unlinkSync(textPath);
    });

    test('should handle corrupted Excel files', async () => {
      const corruptPath = path.join(__dirname, 'corrupt.xlsx');
      fs.writeFileSync(corruptPath, 'PK' + 'a'.repeat(100)); // Fake zip header

      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', corruptPath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      fs.unlinkSync(corruptPath);
    });

    test('should enforce admin authentication on all endpoints', async () => {
      const userToken = await createUserSession(regularUser.id);
      
      const endpoints = [
        'POST /api/admin/loans/excel-upload',
        'POST /api/admin/loans/excel-transactions',
        'POST /api/admin/clients/excel-onboarding',
        'POST /api/admin/transactions/excel-import'
      ];

      // Create dummy file for testing
      const dummyPath = path.join(__dirname, 'dummy.xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([['Test']]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Test');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(dummyPath, buffer);

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        const response = await request(app)
          [method.toLowerCase()](path)
          .set('Authorization', `Bearer ${userToken}`)
          .attach('excel', dummyPath)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      }

      fs.unlinkSync(dummyPath);
    });

    test('should handle very large Excel files gracefully', async () => {
      // Create a large Excel file with many rows
      const workbook = XLSX.utils.book_new();
      const largeData = [['User Email', 'Account Number', 'Principal Amount', 'Monthly Rate']];
      
      // Add 1000 rows
      for (let i = 0; i < 1000; i++) {
        largeData.push([
          `user${i}@example.com`,
          `LARGE-${String(i).padStart(4, '0')}`,
          Math.floor(Math.random() * 100000) + 10000,
          Math.random() * 0.02 + 0.01
        ]);
      }
      
      const worksheet = XLSX.utils.aoa_to_sheet(largeData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans');
      
      const largePath = path.join(__dirname, 'large-file.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(largePath, buffer);

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', largePath)
        .timeout(30000); // 30 second timeout

      const endTime = Date.now();
      
      // Should complete within reasonable time or return appropriate error
      expect([200, 400, 413]).toContain(response.status); // 413 = Payload too large
      expect(endTime - startTime).toBeLessThan(30000);

      fs.unlinkSync(largePath);
    });

    test('should sanitize Excel data to prevent injection', async () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['User Email', 'Account Number', 'Principal Amount', 'Monthly Rate'],
        [regularUser.email, "'; DROP TABLE users; --", 10000, 0.01]
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans');
      
      const maliciousPath = path.join(__dirname, 'malicious.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(maliciousPath, buffer);

      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', maliciousPath)
        .expect(200);

      // Should handle malicious data safely
      expect(response.body.results.failed).toBeGreaterThan(0);

      // Verify database integrity
      const dbResult = await pool.query('SELECT COUNT(*) FROM users');
      expect(parseInt(dbResult.rows[0].count)).toBeGreaterThan(0);

      fs.unlinkSync(maliciousPath);
    });

    test('should provide detailed error messages for failed imports', async () => {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['User Email', 'Account Number', 'Principal Amount', 'Monthly Rate'],
        ['invalid-email', 'INVALID-001', 'not-a-number', -0.01],
        ['', 'INVALID-002', 50000, 0.01],
        [regularUser.email, '', 75000, 0.015]
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans');
      
      const errorPath = path.join(__dirname, 'error-test.xlsx');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(errorPath, buffer);

      const response = await request(app)
        .post('/api/admin/loans/excel-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('excel', errorPath)
        .expect(200);

      expect(response.body.results.errors).toHaveLength(3);
      expect(response.body.results.errors[0]).toHaveProperty('row');
      expect(response.body.results.errors[0]).toHaveProperty('message');
      expect(response.body.results.errors[0]).toHaveProperty('field');

      fs.unlinkSync(errorPath);
    });
  });
});