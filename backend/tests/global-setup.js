/**
 * Global setup for Jest tests
 * Runs once before all test suites
 */

module.exports = async () => {
  console.log('🚀 Starting global test setup...');
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Set consistent timezone
  process.env.TZ = 'UTC';
  
  // Disable console output for cleaner test results (optional)
  if (process.env.CI) {
    console.log('🤖 CI environment detected - reducing log output');
  }
  
  console.log('✅ Global setup completed');
};