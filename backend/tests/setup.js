// Test setup and teardown
const { Pool } = require('pg');

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.DB_NAME = 'esoteric_loans_test';
  process.env.DB_USER = process.env.DB_USER || 'williamwang';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  
  console.log('Test setup complete');
});

// Global test teardown
afterAll(async () => {
  console.log('Test teardown complete');
});