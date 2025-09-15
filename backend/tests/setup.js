// Enhanced test setup with production database protection
require('dotenv').config({ path: '.env.test' });
const { Pool } = require('pg');
const SafeTestDatabase = require('./helpers/dbSafety');

// Production database protection
const PRODUCTION_DATABASES = [
  'esoteric_loans',
  'production', 
  'prod',
  'live'
];

// Global test database instance
let testDatabase;

// Global test setup
beforeAll(async () => {
  // CRITICAL: Ensure we're in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests can only run in TEST environment! Set NODE_ENV=test');
  }

  // CRITICAL: Validate database name before any operations
  const dbName = process.env.DB_NAME || 'esoteric_loans_test';
  if (PRODUCTION_DATABASES.includes(dbName.toLowerCase())) {
    throw new Error(`🚨 DANGER: Attempted to run tests against production database: ${dbName}`);
  }

  // Force test environment configuration
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = 'esoteric_loans_test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.DB_USER = process.env.DB_USER || 'williamwang';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  
  // File upload test settings
  process.env.UPLOAD_PATH = './test-uploads';
  process.env.MAX_FILE_SIZE = '10485760';
  
  // Disable external services in tests
  process.env.DISABLE_EMAILS = 'true';

  console.log(`✅ Test environment verified - using database: ${process.env.DB_NAME}`);
  
  // Initialize test database helper
  try {
    testDatabase = new SafeTestDatabase();
    console.log('✅ Safe test database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error.message);
    throw error;
  }
  
  console.log('✅ Test setup complete');
});

// Global test teardown
afterAll(async () => {
  if (testDatabase) {
    await testDatabase.close();
    console.log('✅ Test database connection closed');
  }
  console.log('✅ Test teardown complete');
});

// Export test database for use in tests
module.exports = {
  getTestDatabase: () => {
    if (!testDatabase) {
      throw new Error('Test database not initialized. Ensure tests are running in test environment.');
    }
    return testDatabase;
  }
};