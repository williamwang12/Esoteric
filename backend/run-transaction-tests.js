#!/usr/bin/env node

/**
 * Quick test runner for transaction import functionality
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

console.log('🚀 Running Transaction Import Tests');
console.log('===================================');

try {
    // Run the tests
    require('./test-transaction-import.js');
} catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
}