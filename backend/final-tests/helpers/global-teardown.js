/**
 * Global Test Teardown
 * 
 * Runs once after all tests complete to clean up the test environment
 * including database removal and cleanup.
 */

const { Pool } = require('pg');

module.exports = async () => {
  console.log('🧹 Starting global test teardown...');

  // Only run teardown if in test environment
  if (process.env.NODE_ENV !== 'test') {
    console.log('⚠️  Skipping teardown - not in test environment');
    return;
  }

  const testDbName = process.env.DB_NAME || 'esoteric_loans_test_final';

  // Database connection for admin operations
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres' // Connect to default postgres database
  });

  try {
    // Terminate all connections to test database
    await adminPool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `, [testDbName]);

    // Drop test database
    await adminPool.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    
    console.log(`✅ Test database '${testDbName}' cleaned up successfully`);
    
  } catch (error) {
    console.error('❌ Failed to cleanup test database:', error.message);
    // Don't throw error during teardown to avoid masking test failures
  } finally {
    await adminPool.end();
  }

  console.log('✨ Global test teardown completed');
};