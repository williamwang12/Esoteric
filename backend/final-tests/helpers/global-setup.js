/**
 * Global Test Setup
 * 
 * Runs once before all tests to set up the test environment
 * including database creation and initial configuration.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🚀 Starting global test setup...');

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = 'esoteric_loans_test_final';
  
  // Database connection for admin operations
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres' // Connect to default postgres database
  });

  try {
    // Terminate existing connections to test database
    await adminPool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `, [process.env.DB_NAME]);

    // Drop test database if exists and create fresh one
    await adminPool.query(`DROP DATABASE IF EXISTS ${process.env.DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
    
    console.log(`✅ Test database '${process.env.DB_NAME}' created successfully`);
    
  } catch (error) {
    console.error('❌ Failed to setup test database:', error.message);
    throw error;
  } finally {
    await adminPool.end();
  }

  // Connect to the test database and set up schema
  const testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME
  });

  try {
    // Read and execute schema migration
    const migrationPath = path.join(__dirname, '..', '..', 'migrations', 'final_migration.sql');
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf8');
      await testPool.query(migration);
      console.log('✅ Database schema created successfully');
    } else {
      throw new Error('Migration file not found');
    }

    // Set sequence values to avoid ID conflicts
    await testPool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1000');
    await testPool.query('ALTER SEQUENCE loan_accounts_id_seq RESTART WITH 1000');
    await testPool.query('ALTER SEQUENCE loan_transactions_id_seq RESTART WITH 1000');
    await testPool.query('ALTER SEQUENCE documents_id_seq RESTART WITH 1000');
    await testPool.query('ALTER SEQUENCE yield_deposits_id_seq RESTART WITH 1000');
    
    console.log('✅ Database sequences initialized');
    
  } catch (error) {
    console.error('❌ Failed to setup database schema:', error.message);
    throw error;
  } finally {
    await testPool.end();
  }

  console.log('🎉 Global test setup completed successfully');
};