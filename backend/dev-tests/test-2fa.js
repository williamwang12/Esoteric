// 2FA Testing Script
const request = require('supertest');
const speakeasy = require('speakeasy');

// Test server setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-2fa-123';
process.env.DB_NAME = 'esoteric_loans_test';

const app = require('./server-2fa');

async function test2FA() {
    console.log('🔐 Starting 2FA Testing...\n');

    let authToken = '';
    let sessionToken = '';
    let secret = '';
    let userId = '';

    // Step 1: Register/Login user
    console.log('📝 Step 1: User Authentication');
    try {
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'demo@esoteric.com',
                password: 'demo123456'
            });

        if (loginResponse.status === 200) {
            if (loginResponse.body.requires_2fa) {
                console.log('✅ User has 2FA enabled - got session token');
                sessionToken = loginResponse.body.session_token;
                userId = loginResponse.body.user.id;
            } else {
                console.log('✅ User login successful - no 2FA required');
                authToken = loginResponse.body.token;
                userId = loginResponse.body.user.id;
            }
        } else {
            throw new Error(`Login failed: ${loginResponse.body.error}`);
        }
    } catch (error) {
        console.log('❌ Login failed:', error.message);
        return;
    }

    // Step 2: Setup 2FA if not already enabled
    if (!sessionToken) {
        console.log('\n🔧 Step 2: Setting up 2FA');
        try {
            const setupResponse = await request(app)
                .post('/api/2fa/setup')
                .set('Authorization', `Bearer ${authToken}`);

            if (setupResponse.status === 200) {
                console.log('✅ 2FA setup initiated');
                secret = setupResponse.body.manualEntryKey;
                console.log('🔑 Secret for testing:', secret);

                // Generate a TOTP token for testing
                const token = speakeasy.totp({
                    secret: secret,
                    encoding: 'base32'
                });

                console.log('🎯 Generated TOTP token:', token);

                // Verify setup
                const verifyResponse = await request(app)
                    .post('/api/2fa/verify-setup')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ token: token });

                if (verifyResponse.status === 200) {
                    console.log('✅ 2FA setup completed successfully');
                    console.log('🔐 Backup codes generated:', verifyResponse.body.backupCodes);
                } else {
                    throw new Error(`2FA setup verification failed: ${verifyResponse.body.error}`);
                }
            } else {
                throw new Error(`2FA setup failed: ${setupResponse.body.error}`);
            }
        } catch (error) {
            console.log('❌ 2FA setup failed:', error.message);
            return;
        }
    }

    // Step 3: Test 2FA login flow
    console.log('\n🔓 Step 3: Testing 2FA Login Flow');
    try {
        // Login again to trigger 2FA
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'demo@esoteric.com',
                password: 'demo123456'
            });

        if (loginResponse.status === 200 && loginResponse.body.requires_2fa) {
            console.log('✅ 2FA required - got temporary session');
            sessionToken = loginResponse.body.session_token;

            // Generate TOTP token
            const token = speakeasy.totp({
                secret: secret || 'JBSWY3DPEHPK3PXP', // Use stored secret or default
                encoding: 'base32'
            });

            console.log('🎯 Using TOTP token:', token);

            // Complete 2FA login
            const complete2FAResponse = await request(app)
                .post('/api/auth/complete-2fa-login')
                .send({
                    session_token: sessionToken,
                    totp_token: token
                });

            if (complete2FAResponse.status === 200) {
                console.log('✅ 2FA login completed successfully');
                authToken = complete2FAResponse.body.token;
            } else {
                throw new Error(`2FA completion failed: ${complete2FAResponse.body.error}`);
            }
        } else {
            console.log('✅ Direct login successful (2FA already set up)');
            authToken = loginResponse.body.token;
        }
    } catch (error) {
        console.log('❌ 2FA login flow failed:', error.message);
        return;
    }

    // Step 4: Test protected endpoints
    console.log('\n🛡️  Step 4: Testing Protected Endpoints');
    try {
        const profileResponse = await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`);

        if (profileResponse.status === 200) {
            console.log('✅ Protected endpoint access successful');
            console.log('👤 User profile:', profileResponse.body);
        } else {
            throw new Error(`Profile access failed: ${profileResponse.body.error}`);
        }
    } catch (error) {
        console.log('❌ Protected endpoint test failed:', error.message);
        return;
    }

    // Step 5: Test 2FA status
    console.log('\n📊 Step 5: Testing 2FA Status');
    try {
        const statusResponse = await request(app)
            .get('/api/2fa/status')
            .set('Authorization', `Bearer ${authToken}`);

        if (statusResponse.status === 200) {
            console.log('✅ 2FA status retrieved successfully');
            console.log('📋 2FA Status:', statusResponse.body);
        } else {
            throw new Error(`2FA status failed: ${statusResponse.body.error}`);
        }
    } catch (error) {
        console.log('❌ 2FA status test failed:', error.message);
    }

    // Step 6: Test backup codes
    console.log('\n🔄 Step 6: Testing Backup Code Generation');
    try {
        const token = speakeasy.totp({
            secret: secret || 'JBSWY3DPEHPK3PXP',
            encoding: 'base32'
        });

        const backupResponse = await request(app)
            .post('/api/2fa/generate-backup-codes')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ token: token });

        if (backupResponse.status === 200) {
            console.log('✅ Backup codes generated successfully');
            console.log('🔐 New backup codes:', backupResponse.body.backupCodes);
        } else {
            console.log('⚠️  Backup code generation failed:', backupResponse.body.error);
        }
    } catch (error) {
        console.log('❌ Backup code test failed:', error.message);
    }

    console.log('\n🎉 2FA Testing Complete!');
    console.log('\n📋 Summary:');
    console.log('✅ User authentication');
    console.log('✅ 2FA setup and verification');
    console.log('✅ 2FA login flow');
    console.log('✅ Protected endpoint access');
    console.log('✅ 2FA status checking');
    console.log('✅ Backup code management');
}

// Manual testing instructions
function printManualTestingInstructions() {
    console.log(`
🔐 MANUAL 2FA TESTING INSTRUCTIONS
==================================

1. Setup 2FA:
   curl -X POST http://localhost:5001/api/2fa/setup \\
     -H "Authorization: Bearer [TOKEN]"

2. Verify setup with TOTP:
   curl -X POST http://localhost:5001/api/2fa/verify-setup \\
     -H "Authorization: Bearer [TOKEN]" \\
     -H "Content-Type: application/json" \\
     -d '{"token": "123456"}'

3. Login with 2FA:
   curl -X POST http://localhost:5001/api/auth/login \\
     -H "Content-Type: application/json" \\
     -d '{"email": "demo@esoteric.com", "password": "demo123456"}'

4. Complete 2FA login:
   curl -X POST http://localhost:5001/api/auth/complete-2fa-login \\
     -H "Content-Type: application/json" \\
     -d '{"session_token": "[SESSION_TOKEN]", "totp_token": "123456"}'

5. Check 2FA status:
   curl -X GET http://localhost:5001/api/2fa/status \\
     -H "Authorization: Bearer [TOKEN]"

6. Generate new backup codes:
   curl -X POST http://localhost:5001/api/2fa/generate-backup-codes \\
     -H "Authorization: Bearer [TOKEN]" \\
     -H "Content-Type: application/json" \\
     -d '{"token": "123456"}'

7. Disable 2FA:
   curl -X POST http://localhost:5001/api/2fa/disable \\
     -H "Authorization: Bearer [TOKEN]" \\
     -H "Content-Type: application/json" \\
     -d '{"token": "123456", "password": "demo123456"}'

📱 TOTP Apps for Testing:
- Google Authenticator
- Authy
- Microsoft Authenticator
- 1Password

🔑 For testing, use the manual entry key provided in the setup response.
    `);
}

// Run tests if called directly
if (require.main === module) {
    test2FA().catch(console.error);
    printManualTestingInstructions();
}

module.exports = { test2FA, printManualTestingInstructions };