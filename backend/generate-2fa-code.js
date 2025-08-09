#!/usr/bin/env node
// 2FA Code Generator for Esoteric Enterprises
// This script generates current TOTP codes for users with 2FA enabled

require('dotenv').config();
const { Pool } = require('pg');
const speakeasy = require('speakeasy');

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'esoteric_loans',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function generateCodeForUser(email) {
    try {
        // Get user's 2FA secret
        const result = await pool.query(`
            SELECT u.email, u.first_name, u.last_name, u2fa.secret, u2fa.is_enabled, u2fa.backup_codes
            FROM users u
            LEFT JOIN user_2fa u2fa ON u.id = u2fa.user_id
            WHERE u.email = $1
        `, [email]);

        if (result.rows.length === 0) {
            console.log(`❌ User not found: ${email}`);
            return;
        }

        const user = result.rows[0];
        
        if (!user.is_enabled) {
            console.log(`❌ 2FA is not enabled for user: ${email}`);
            return;
        }

        if (!user.secret) {
            console.log(`❌ No 2FA secret found for user: ${email}`);
            return;
        }

        // Generate current TOTP code
        const token = speakeasy.totp({
            secret: user.secret,
            encoding: 'base32'
        });

        // Calculate time remaining for this code
        const timeStep = 30; // TOTP time step in seconds
        const timeRemaining = timeStep - (Math.floor(Date.now() / 1000) % timeStep);

        console.log(`\n🔐 2FA Code for ${user.first_name} ${user.last_name} (${user.email})`);
        console.log(`📱 Current TOTP Code: ${token}`);
        console.log(`⏰ Valid for: ${timeRemaining} seconds`);
        
        if (user.backup_codes && user.backup_codes.length > 0) {
            console.log(`🔑 Backup Codes Available: ${user.backup_codes.length}`);
            console.log(`📋 First 3 backup codes: ${user.backup_codes.slice(0, 3).join(', ')}`);
        }
        
        console.log(`\n✅ Use this code to complete your 2FA login process.`);

    } catch (error) {
        console.error('❌ Error generating 2FA code:', error.message);
    }
}

async function listAllUsers() {
    try {
        const result = await pool.query(`
            SELECT u.email, u.first_name, u.last_name, u2fa.is_enabled, u2fa.backup_codes
            FROM users u
            LEFT JOIN user_2fa u2fa ON u.id = u2fa.user_id
            ORDER BY u.email
        `);

        console.log('\n👥 Users in the system:');
        console.log('════════════════════════════════════════════════════════════════');
        
        result.rows.forEach(user => {
            const status = user.is_enabled ? '✅ 2FA Enabled' : '❌ 2FA Disabled';
            const backupCount = user.backup_codes ? user.backup_codes.length : 0;
            
            console.log(`📧 ${user.email} - ${user.first_name} ${user.last_name}`);
            console.log(`   ${status} | Backup codes: ${backupCount}`);
            console.log('────────────────────────────────────────────────────────────────');
        });

    } catch (error) {
        console.error('❌ Error listing users:', error.message);
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🔐 Esoteric Enterprises 2FA Code Generator
═══════════════════════════════════════════

Usage:
  node generate-2fa-code.js <email>     Generate code for specific user
  node generate-2fa-code.js --list      List all users
  node generate-2fa-code.js --help      Show this help

Examples:
  node generate-2fa-code.js demo@esoteric.com
  node generate-2fa-code.js --list
        `);
        return;
    }

    if (args[0] === '--list') {
        await listAllUsers();
    } else if (args[0] === '--help') {
        console.log(`
🔐 Esoteric Enterprises 2FA Code Generator
═══════════════════════════════════════════

This tool generates Time-based One-Time Passwords (TOTP) for users with 2FA enabled.
Each code is valid for 30 seconds and can be used to complete the login process.

Commands:
  <email>    Generate current TOTP code for the specified user
  --list     Show all users and their 2FA status  
  --help     Display this help message

Security Notes:
- Codes are generated using the same algorithm as authenticator apps
- Each code is only valid for 30 seconds
- Backup codes are also available as an alternative
- Only use this tool for legitimate access to your own accounts
        `);
    } else {
        await generateCodeForUser(args[0]);
    }

    await pool.end();
}

// Handle script execution
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateCodeForUser, listAllUsers };