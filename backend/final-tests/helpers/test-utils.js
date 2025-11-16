/**
 * Test Utilities
 * 
 * Comprehensive utility functions for testing the Esoteric backend application.
 * Includes database helpers, authentication utilities, test data generation,
 * and common testing patterns.
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const path = require('path');
const fs = require('fs');

/**
 * Database connection pool for tests
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'williamwang',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'esoteric_loans_test',
  ssl: false
});

/**
 * Clean all tables in the database and uploaded files
 */
async function cleanDatabase() {
  const tables = [
    'yield_payouts',
    'yield_deposits',
    'withdrawal_requests',
    'meeting_requests',
    'account_verification_requests',
    'user_2fa_attempts',
    'user_sessions',
    'user_2fa',
    'loan_transactions',
    'monthly_balances',
    'payment_schedule',
    'documents',
    'loan_accounts',
    'users'
  ];

  for (const table of tables) {
    await pool.query(`DELETE FROM ${table}`);
  }

  // Reset sequences
  await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1000');
  await pool.query('ALTER SEQUENCE loan_accounts_id_seq RESTART WITH 1000');
  await pool.query('ALTER SEQUENCE loan_transactions_id_seq RESTART WITH 1000');
  await pool.query('ALTER SEQUENCE documents_id_seq RESTART WITH 1000');
  await pool.query('ALTER SEQUENCE yield_deposits_id_seq RESTART WITH 1000');

  // Clean up test upload files
  cleanTestUploads();
}

/**
 * Clean up test files from uploads directory
 */
function cleanTestUploads() {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      // Only delete test files (files that start with 'test-' or 'document-' followed by timestamp)
      if (file.match(/^(test-|document-)\d+/) || file.includes('test')) {
        const filePath = path.join(uploadsDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not clean test upload files:', error.message);
  }
}

/**
 * Create test user with optional parameters
 */
async function createTestUser(options = {}) {
  const defaults = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    phone: '+1234567890',
    role: 'user',
    accountVerified: true,
    emailVerified: true,
    requires2fa: false
  };

  const userData = { ...defaults, ...options };
  const passwordHash = await bcrypt.hash(userData.password, 12);

  const result = await pool.query(
    `INSERT INTO users (
      email, password_hash, first_name, last_name, phone, role,
      account_verified, email_verified, requires_2fa, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) 
    RETURNING *`,
    [
      userData.email,
      passwordHash,
      userData.firstName,
      userData.lastName,
      userData.phone,
      userData.role,
      userData.accountVerified,
      userData.emailVerified,
      userData.requires2fa
    ]
  );

  const user = result.rows[0];
  user.password = userData.password; // Include plain password for testing
  return user;
}

/**
 * Create test admin user
 */
async function createTestAdmin(options = {}) {
  return createTestUser({
    ...options,
    role: 'admin',
    email: options.email || `admin-${Date.now()}@example.com`
  });
}

/**
 * Generate JWT token for user
 */
function generateJwtToken(userId, is2faComplete = true) {
  return jwt.sign(
    { 
      userId, 
      is2faComplete,
      sessionId: crypto.randomBytes(16).toString('hex')
    },
    process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
    { expiresIn: '1h' }
  );
}

/**
 * Create user session in database matching the auth middleware expectations
 */
async function createUserSession(userId, is2faComplete = true) {
  const token = generateJwtToken(userId, is2faComplete);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  await pool.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at, is_2fa_complete, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
    [
      userId,
      tokenHash,
      new Date(Date.now() + 3600000), // 1 hour from now
      is2faComplete,
      '127.0.0.1'
    ]
  );

  return token;
}

/**
 * Setup 2FA for user
 */
async function setup2FA(userId) {
  const secret = speakeasy.generateSecret({
    name: 'Esoteric Test',
    length: 20
  });

  const backupCodes = Array.from({ length: 10 }, () => 
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  await pool.query(
    `INSERT INTO user_2fa (user_id, secret, is_enabled, backup_codes, created_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [userId, secret.base32, true, backupCodes]
  );

  return { secret: secret.base32, backupCodes };
}

/**
 * Generate TOTP token for 2FA
 */
function generate2FAToken(secret) {
  return speakeasy.totp({
    secret: secret,
    encoding: 'base32'
  });
}

/**
 * Create test loan account
 */
async function createTestLoan(userId, options = {}) {
  const defaults = {
    accountNumber: `LOAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    principalAmount: 100000.00,
    currentBalance: 100000.00,
    monthlyRate: 0.01,
    totalBonuses: 0.00,
    totalWithdrawals: 0.00
  };

  const loanData = { ...defaults, ...options };

  const result = await pool.query(
    `INSERT INTO loan_accounts (
      user_id, account_number, principal_amount, current_balance,
      monthly_rate, total_bonuses, total_withdrawals, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    RETURNING *`,
    [
      userId,
      loanData.accountNumber,
      loanData.principalAmount,
      loanData.currentBalance,
      loanData.monthlyRate,
      loanData.totalBonuses,
      loanData.totalWithdrawals
    ]
  );

  return result.rows[0];
}

/**
 * Create test loan transaction
 */
async function createTestTransaction(loanAccountId, options = {}) {
  const defaults = {
    amount: 1000.00,
    transactionType: 'deposit',
    description: 'Test transaction',
    transactionDate: new Date(),
    bonusPercentage: null,
    referenceId: null
  };

  const transactionData = { ...defaults, ...options };

  const result = await pool.query(
    `INSERT INTO loan_transactions (
      loan_account_id, amount, transaction_type, bonus_percentage,
      description, transaction_date, reference_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    RETURNING *`,
    [
      loanAccountId,
      transactionData.amount,
      transactionData.transactionType,
      transactionData.bonusPercentage,
      transactionData.description,
      transactionData.transactionDate,
      transactionData.referenceId
    ]
  );

  return result.rows[0];
}

/**
 * Create test document
 */
async function createTestDocument(userId, options = {}) {
  const defaults = {
    title: 'Test Document',
    fileName: 'test-document.pdf',
    fileSize: 1024,
    category: 'loan_agreement'
  };

  const documentData = { ...defaults, ...options };
  const filePath = `/uploads/test-${Date.now()}-${documentData.fileName}`;

  const result = await pool.query(
    `INSERT INTO documents (
      user_id, title, file_path, file_size, category, upload_date
    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *`,
    [
      userId,
      documentData.title,
      filePath,
      documentData.fileSize,
      documentData.category
    ]
  );

  return result.rows[0];
}

/**
 * Create test yield deposit
 */
async function createTestYieldDeposit(userId, options = {}) {
  const defaults = {
    principalAmount: 50000.00,
    annualYieldRate: 0.12,
    startDate: new Date().toISOString().split('T')[0],
    status: 'active',
    notes: 'Test yield deposit'
  };

  const depositData = { ...defaults, ...options };

  const result = await pool.query(
    `INSERT INTO yield_deposits (
      user_id, principal_amount, annual_yield_rate, start_date,
      status, created_at, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)
    RETURNING *`,
    [
      userId,
      depositData.principalAmount,
      depositData.annualYieldRate,
      depositData.startDate,
      depositData.status,
      depositData.notes,
      options.createdBy || userId
    ]
  );

  return result.rows[0];
}

/**
 * Create test withdrawal request
 */
async function createTestWithdrawalRequest(userId, loanAccountId, options = {}) {
  const defaults = {
    amount: 5000.00,
    reason: 'Test withdrawal request',
    urgency: 'normal',
    status: 'pending'
  };

  const requestData = { ...defaults, ...options };

  const result = await pool.query(
    `INSERT INTO withdrawal_requests (
      user_id, loan_account_id, amount, reason, urgency,
      status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    RETURNING *`,
    [
      userId,
      loanAccountId,
      requestData.amount,
      requestData.reason,
      requestData.urgency,
      requestData.status
    ]
  );

  return result.rows[0];
}

/**
 * Create test meeting request
 */
async function createTestMeetingRequest(userId, options = {}) {
  const defaults = {
    purpose: 'Test meeting purpose',
    preferredDate: new Date().toISOString().split('T')[0],
    preferredTime: '14:00:00',
    meetingType: 'video',
    urgency: 'normal',
    status: 'pending'
  };

  const requestData = { ...defaults, ...options };

  const result = await pool.query(
    `INSERT INTO meeting_requests (
      user_id, purpose, preferred_date, preferred_time, meeting_type,
      urgency, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    RETURNING *`,
    [
      userId,
      requestData.purpose,
      requestData.preferredDate,
      requestData.preferredTime,
      requestData.meetingType,
      requestData.urgency,
      requestData.status
    ]
  );

  return result.rows[0];
}

/**
 * Create test file with automatic cleanup tracking
 */
function createTestFile(fileName = 'test-file.txt', content = 'Test file content') {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Ensure test files have identifiable names
  const timestamp = Date.now();
  const testFileName = fileName.startsWith('test-') ? fileName : `test-${timestamp}-${fileName}`;
  const filePath = path.join(uploadsDir, testFileName);
  
  fs.writeFileSync(filePath, content);
  
  return {
    path: filePath,
    originalname: testFileName,
    mimetype: 'text/plain',
    size: Buffer.byteLength(content),
    cleanup: () => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  };
}

/**
 * Wait for a specified amount of time
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random test data
 */
function generateRandomData() {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    accountNumber: `ACC-${timestamp}-${Math.floor(Math.random() * 1000)}`,
    amount: Math.floor(Math.random() * 100000) + 1000
  };
}

/**
 * Validate response structure
 */
function validateApiResponse(response, expectedFields = []) {
  expect(response).toBeDefined();
  expect(response.status).toBeDefined();
  
  if (response.body) {
    expectedFields.forEach(field => {
      expect(response.body).toHaveProperty(field);
    });
  }
}

/**
 * Close database connections (only if not already closed)
 */
async function closeDatabase() {
  if (!pool.ended) {
    await pool.end();
  }
}

module.exports = {
  pool,
  cleanDatabase,
  cleanTestUploads,
  createTestUser,
  createTestAdmin,
  generateJwtToken,
  createUserSession,
  setup2FA,
  generate2FAToken,
  createTestLoan,
  createTestTransaction,
  createTestDocument,
  createTestYieldDeposit,
  createTestWithdrawalRequest,
  createTestMeetingRequest,
  createTestFile,
  delay,
  generateRandomData,
  validateApiResponse,
  closeDatabase
};