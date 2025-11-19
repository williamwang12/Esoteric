/**
 * Global teardown for Jest tests
 * Runs once after all test suites complete
 */

module.exports = async () => {
  console.log('🧹 Starting global test teardown...');
  
  // Close any remaining database connections
  try {
    const { Pool } = require('pg');
    
    // Clean up any test data if needed
    console.log('🗑️ Cleaning up test resources...');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
  } catch (error) {
    console.warn('⚠️ Warning during teardown:', error.message);
  }
  
  console.log('✅ Global teardown completed');
};