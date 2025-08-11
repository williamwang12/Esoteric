#!/usr/bin/env node

/**
 * Simple 2FA Test Script
 * Generates a valid TOTP code for testing
 */

const speakeasy = require('speakeasy');

// Your 2FA secret from the setup
const secret = 'KJMDW5CNKNFXUS2JFZUWS2Z6KMYCIZJXOZEWO4JEMZNXGZSDJZNA';

// Generate current TOTP token
const token = speakeasy.totp({
    secret: secret,
    encoding: 'base32'
});

console.log('🔑 Current 6-digit TOTP code:', token);
console.log('⏰ Valid for ~30 seconds');
console.log('');
console.log('Use this code to verify 2FA setup:');
console.log(`curl -X POST http://localhost:5002/api/2fa/verify-setup \\`);
console.log(`  -H "Authorization: Bearer YOUR_TOKEN" \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"token":"${token}"}'`);