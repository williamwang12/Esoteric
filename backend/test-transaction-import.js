#!/usr/bin/env node

/**
 * Simple test runner for Transaction Import functionality
 * This creates a test database and runs comprehensive tests
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

// Test database configuration
const TEST_DB_NAME = 'esoteric_loans_test';
const TEST_DB_CONFIG = {
    user: process.env.DB_USER || 'williamwang',
    host: process.env.DB_HOST || 'localhost',
    database: TEST_DB_NAME,
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
};

async function setupTestDatabase() {
    console.log('🔧 Setting up test database...');
    
    // Connect to postgres database to create test database
    const adminPool = new Pool({
        ...TEST_DB_CONFIG,
        database: 'postgres'
    });

    try {
        // Drop test database if exists
        await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
        console.log(`   Dropped existing test database: ${TEST_DB_NAME}`);
        
        // Create test database
        await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
        console.log(`   Created test database: ${TEST_DB_NAME}`);
        
    } catch (error) {
        console.error('Error setting up test database:', error.message);
        process.exit(1);
    } finally {
        await adminPool.end();
    }

    // Run migrations on test database
    console.log('   Running migrations on test database...');
    try {
        // Set environment for test database
        process.env.NODE_ENV = 'test';
        process.env.TEST_DATABASE_URL = `postgresql://${TEST_DB_CONFIG.user}:${TEST_DB_CONFIG.password}@${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}/${TEST_DB_NAME}`;
        
        // Run schema setup (you'll need to create this)
        await setupSchema();
        
        console.log('   ✅ Test database setup complete');
    } catch (error) {
        console.error('Error running migrations:', error.message);
        process.exit(1);
    }
}

async function setupSchema() {
    const pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL
    });

    try {
        // Create tables schema for testing
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                phone VARCHAR(20),
                role VARCHAR(50) DEFAULT 'user',
                email_verified BOOLEAN DEFAULT false,
                account_verified BOOLEAN DEFAULT false,
                requires_2fa BOOLEAN DEFAULT false,
                temp_password VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(64) UNIQUE NOT NULL,
                is_2fa_complete BOOLEAN DEFAULT false,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS loan_accounts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                account_number VARCHAR(50) UNIQUE NOT NULL,
                principal_amount DECIMAL(12,2) DEFAULT 0,
                current_balance DECIMAL(12,2) DEFAULT 0,
                monthly_rate DECIMAL(5,4) DEFAULT 0.01,
                total_bonuses DECIMAL(12,2) DEFAULT 0,
                total_withdrawals DECIMAL(12,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS loan_transactions (
                id SERIAL PRIMARY KEY,
                loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
                amount DECIMAL(12,2) NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                description TEXT,
                transaction_date DATE DEFAULT CURRENT_DATE,
                bonus_percentage DECIMAL(5,4),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS yield_deposits (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                principal_amount DECIMAL(12,2) NOT NULL,
                annual_yield_rate DECIMAL(5,4) DEFAULT 0.12,
                start_date DATE NOT NULL,
                end_date DATE,
                status VARCHAR(20) DEFAULT 'active',
                total_paid DECIMAL(12,2) DEFAULT 0,
                last_payment_date DATE,
                next_payment_date DATE,
                created_by INTEGER REFERENCES users(id),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('   ✅ Database schema created');

    } catch (error) {
        console.error('Error creating schema:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

async function runTests() {
    console.log('🧪 Running Transaction Import tests...');
    
    try {
        // Run the tests using Jest
        execSync('npx jest tests/transaction-import.test.js --verbose --detectOpenHandles', {
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'test',
                TEST_DATABASE_URL: process.env.TEST_DATABASE_URL
            }
        });
        
        console.log('✅ All tests completed successfully!');
    } catch (error) {
        console.error('❌ Tests failed:', error.message);
        process.exit(1);
    }
}

async function cleanupTestDatabase() {
    console.log('🧹 Cleaning up test database...');
    
    const adminPool = new Pool({
        ...TEST_DB_CONFIG,
        database: 'postgres'
    });

    try {
        await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
        console.log(`   Dropped test database: ${TEST_DB_NAME}`);
    } catch (error) {
        console.error('Error cleaning up test database:', error.message);
    } finally {
        await adminPool.end();
    }
}

async function main() {
    console.log('🚀 Transaction Import Test Suite');
    console.log('==================================');
    
    try {
        await setupTestDatabase();
        await runTests();
    } finally {
        await cleanupTestDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { setupTestDatabase, runTests, cleanupTestDatabase };