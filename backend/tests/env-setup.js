// Environment setup for tests
const path = require('path');

// Load test environment variables before anything else
require('dotenv').config({ path: path.join(__dirname, '..', 'env.test') });

// Ensure we're in test mode
process.env.NODE_ENV = 'test';

console.log(`🧪 Test environment loaded - Database: ${process.env.DB_NAME}`);
