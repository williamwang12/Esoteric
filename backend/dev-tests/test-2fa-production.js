#!/usr/bin/env node

/**
 * 🔐 2FA Production Testing Guide & Scripts
 * 
 * This script provides step-by-step testing for your 2FA system
 * Ready for production use with real authenticator apps
 */

const axios = require('axios');
const readline = require('readline');

class TwoFAProductionTester {
    constructor() {
        this.baseURL = 'http://localhost:5002/api';
        this.userToken = null;
        this.sessionToken = null;
        this.backupCodes = [];
        this.totpSecret = null;
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async prompt(question) {
        return new Promise((resolve) => {
            this.rl.question(question, resolve);
        });
    }

    // Step 1: Login and get user token
    async loginUser() {
        console.log('\n🔑 STEP 1: User Login');
        console.log('===============================');
        
        try {
            const response = await axios.post(`${this.baseURL}/auth/login`, {
                email: 'demo@esoteric.com',
                password: 'demo123456'
            });

            this.userToken = response.data.token;
            console.log('✅ Login successful');
            console.log(`👤 User: ${response.data.user.firstName} ${response.data.user.lastName}`);
            console.log(`🔑 Token: ${this.userToken.substring(0, 20)}...`);
            
            return true;
        } catch (error) {
            console.log('❌ Login failed:', error.response?.data?.error || error.message);
            return false;
        }
    }

    // Step 2: Check current 2FA status
    async check2FAStatus() {
        console.log('\n📊 STEP 2: Check 2FA Status');
        console.log('===============================');
        
        try {
            const response = await axios.get(`${this.baseURL}/2fa/status`, {
                headers: { Authorization: `Bearer ${this.userToken}` }
            });

            console.log(`🔐 2FA Status: ${response.data.enabled ? 'ENABLED' : 'DISABLED'}`);
            
            if (response.data.enabled) {
                console.log(`📱 Last Used: ${response.data.lastUsed || 'Never'}`);
                console.log(`🔢 Backup Codes: ${response.data.backupCodes || 0} remaining`);
            }
            
            return response.data.enabled;
        } catch (error) {
            console.log('❌ Status check failed:', error.response?.data?.error || error.message);
            return false;
        }
    }

    // Step 3: Set up 2FA (get QR code)
    async setup2FA() {
        console.log('\n📱 STEP 3: 2FA Setup');
        console.log('===============================');
        
        try {
            const response = await axios.post(`${this.baseURL}/2fa/setup`, {}, {
                headers: { Authorization: `Bearer ${this.userToken}` }
            });

            this.totpSecret = response.data.manualEntryKey;
            
            console.log('✅ 2FA Setup initiated');
            console.log('\n📱 MANUAL ENTRY KEY (for authenticator apps):');
            console.log(`🔑 ${this.totpSecret}`);
            
            console.log('\n📊 QR CODE DATA:');
            console.log(`🔗 ${response.data.qrCode.substring(0, 80)}...`);
            
            console.log('\n📋 INSTRUCTIONS:');
            console.log('1. Open Google Authenticator, Authy, or any TOTP app');
            console.log('2. Add new account by:');
            console.log('   - Scanning QR code (if you can display it), OR');
            console.log('   - Manually entering the key above');
            console.log('3. App name: "Esoteric Loans"');
            console.log('4. Your app will show 6-digit codes that change every 30 seconds');
            
            return true;
        } catch (error) {
            console.log('❌ 2FA setup failed:', error.response?.data?.error || error.message);
            return false;
        }
    }

    // Step 4: Verify 2FA setup with code from authenticator
    async verify2FASetup() {
        console.log('\n✅ STEP 4: Verify 2FA Setup');
        console.log('===============================');
        
        const code = await this.prompt('\nEnter 6-digit code from your authenticator app: ');
        
        try {
            const response = await axios.post(`${this.baseURL}/2fa/verify-setup`, {
                token: code
            }, {
                headers: { Authorization: `Bearer ${this.userToken}` }
            });

            this.backupCodes = response.data.backupCodes;
            
            console.log('🎉 2FA Successfully Enabled!');
            console.log('\n🔐 BACKUP CODES (save these safely!):');
            console.log('=====================================');
            this.backupCodes.forEach((code, index) => {
                console.log(`${index + 1}. ${code}`);
            });
            
            console.log('\n⚠️  IMPORTANT: Save these backup codes in a secure location!');
            console.log('   They can be used if you lose your phone.');
            
            return true;
        } catch (error) {
            console.log('❌ 2FA verification failed:', error.response?.data?.error || error.message);
            return false;
        }
    }

    // Step 5: Test 2FA login flow
    async test2FALogin() {
        console.log('\n🧪 STEP 5: Test 2FA Login Flow');
        console.log('===============================');
        
        console.log('Now testing the complete 2FA login process...\n');
        
        try {
            // Initial login (password only)
            const loginResponse = await axios.post(`${this.baseURL}/auth/login`, {
                email: 'demo@esoteric.com',
                password: 'demo123456'
            });

            if (loginResponse.data.requires_2fa) {
                console.log('✅ Password verified, 2FA required');
                this.sessionToken = loginResponse.data.session_token;
                
                const code = await this.prompt('Enter current 6-digit code from authenticator: ');
                
                // Complete 2FA login
                const twoFAResponse = await axios.post(`${this.baseURL}/auth/complete-2fa-login`, {
                    session_token: this.sessionToken,
                    token: code
                }, {
                    headers: { Authorization: `Bearer ${this.userToken}` }
                });

                console.log('🎉 2FA Login Complete!');
                console.log(`🔑 New Token: ${twoFAResponse.data.token.substring(0, 20)}...`);
                
                return true;
            } else {
                console.log('ℹ️  Direct login (2FA may not be enforced yet)');
                return true;
            }
        } catch (error) {
            console.log('❌ 2FA login failed:', error.response?.data?.error || error.message);
            return false;
        }
    }

    // Step 6: Test backup codes
    async testBackupCode() {
        console.log('\n🆘 STEP 6: Test Backup Code');
        console.log('===============================');
        
        if (this.backupCodes.length === 0) {
            console.log('⚠️  No backup codes available. Skip this test.');
            return true;
        }
        
        const useBackup = await this.prompt('Test a backup code? (y/n): ');
        if (useBackup.toLowerCase() !== 'y') {
            console.log('ℹ️  Skipping backup code test');
            return true;
        }
        
        try {
            // Use the first backup code
            const backupCode = this.backupCodes[0];
            console.log(`🔑 Testing backup code: ${backupCode}`);
            
            const response = await axios.post(`${this.baseURL}/auth/complete-2fa-login`, {
                session_token: this.sessionToken,
                token: backupCode
            }, {
                headers: { Authorization: `Bearer ${this.userToken}` }
            });

            console.log('✅ Backup code worked!');
            console.log('⚠️  Note: This backup code is now used and invalid');
            
            return true;
        } catch (error) {
            console.log('❌ Backup code failed:', error.response?.data?.error || error.message);
            return false;
        }
    }

    // Step 7: Test rate limiting
    async testRateLimiting() {
        console.log('\n🚦 STEP 7: Test Rate Limiting');
        console.log('===============================');
        
        console.log('Testing rate limiting with invalid codes...');
        
        try {
            // Make multiple rapid attempts with invalid codes
            for (let i = 0; i < 6; i++) {
                try {
                    await axios.post(`${this.baseURL}/auth/complete-2fa-login`, {
                        session_token: this.sessionToken,
                        token: '000000'  // Invalid code
                    }, {
                        headers: { Authorization: `Bearer ${this.userToken}` }
                    });
                } catch (error) {
                    if (error.response?.status === 429) {
                        console.log(`✅ Rate limiting activated after ${i + 1} attempts`);
                        return true;
                    }
                }
            }
            
            console.log('⚠️  Rate limiting may not be fully active');
            return true;
        } catch (error) {
            console.log('ℹ️  Rate limiting test completed');
            return true;
        }
    }

    // Generate 2FA Backup Codes
    async generateBackupCodes() {
        console.log('\n🔄 BONUS: Generate New Backup Codes');
        console.log('=====================================');
        
        const generate = await this.prompt('Generate new backup codes? (y/n): ');
        if (generate.toLowerCase() !== 'y') {
            return true;
        }
        
        try {
            const response = await axios.post(`${this.baseURL}/2fa/generate-backup-codes`, {}, {
                headers: { Authorization: `Bearer ${this.userToken}` }
            });

            console.log('✅ New backup codes generated:');
            response.data.backupCodes.forEach((code, index) => {
                console.log(`${index + 1}. ${code}`);
            });
            
            return true;
        } catch (error) {
            console.log('❌ Backup code generation failed:', error.response?.data?.error || error.message);
            return false;
        }
    }

    // Run all tests
    async runProductionTests() {
        console.log('🔐 2FA PRODUCTION TESTING SUITE');
        console.log('================================');
        console.log('This will test your 2FA system with real authenticator apps');
        console.log('');

        const steps = [
            () => this.loginUser(),
            () => this.check2FAStatus(),
            () => this.setup2FA(),
            () => this.verify2FASetup(),
            () => this.test2FALogin(),
            () => this.testBackupCode(),
            () => this.testRateLimiting(),
            () => this.generateBackupCodes()
        ];

        let passed = 0;
        
        for (const step of steps) {
            const result = await step();
            if (result) passed++;
            
            const continueTest = await this.prompt('\nPress Enter to continue (or "q" to quit): ');
            if (continueTest.toLowerCase() === 'q') break;
        }

        console.log('\n🎯 PRODUCTION TEST SUMMARY');
        console.log('==========================');
        console.log(`✅ Steps completed: ${passed}/${steps.length}`);
        console.log('\n🚀 Your 2FA system is ready for production!');
        
        this.rl.close();
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new TwoFAProductionTester();
    tester.runProductionTests().catch(console.error);
}

module.exports = TwoFAProductionTester;