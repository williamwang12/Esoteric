// Test DocuSign Configuration
require('dotenv').config();
const docusign = require('docusign-esign');
const fs = require('fs');
const path = require('path');

async function testDocuSignConfig() {
    try {
        console.log('🔍 Testing DocuSign Configuration...\n');
        
        // Check configuration
        const config = {
            integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY,
            clientSecret: process.env.DOCUSIGN_CLIENT_SECRET,
            userId: process.env.DOCUSIGN_USER_ID,
            accountId: process.env.DOCUSIGN_ACCOUNT_ID,
            privateKeyPath: process.env.DOCUSIGN_PRIVATE_KEY_PATH,
            environment: process.env.DOCUSIGN_ENVIRONMENT || 'production'
        };
        
        console.log('📋 Configuration Check:');
        console.log('   Integration Key:', config.integrationKey ? '✅ SET' : '❌ MISSING');
        console.log('   Client Secret:', config.clientSecret ? '✅ SET' : '❌ MISSING');
        console.log('   User ID:', config.userId ? '✅ SET' : '❌ MISSING');
        console.log('   Account ID:', config.accountId ? '✅ SET' : '❌ MISSING');
        console.log('   Environment:', config.environment);
        console.log('   Private Key:', fs.existsSync(config.privateKeyPath) ? '✅ EXISTS' : '❌ MISSING');
        
        if (!config.integrationKey || !config.clientSecret || !config.userId || !config.accountId) {
            console.log('\n❌ Missing required configuration values');
            return;
        }
        
        if (!fs.existsSync(config.privateKeyPath)) {
            console.log('\n❌ Private key file not found');
            return;
        }
        
        // Set up DocuSign API client
        const dsApiClient = new docusign.ApiClient();
        dsApiClient.setBasePath(config.environment === 'production' ? 
            'https://na1.docusign.net/restapi' : 'https://demo.docusign.net/restapi');
        
        console.log('\n🔐 Testing JWT Authentication...');
        
        // Read private key
        const privateKey = fs.readFileSync(path.resolve(config.privateKeyPath));
        
        // Attempt JWT authentication
        const jwtLifeSec = 10 * 60; // 10 minutes
        const scopes = ['signature', 'impersonation'];
        
        const results = await dsApiClient.requestJWTUserToken(
            config.integrationKey,
            config.userId,
            scopes,
            privateKey,
            jwtLifeSec
        );
        
        if (results && results.body && results.body.access_token) {
            console.log('✅ JWT Authentication Successful!');
            console.log('   Access Token Length:', results.body.access_token.length);
            console.log('   Token Type:', results.body.token_type);
            console.log('   Expires In:', results.body.expires_in, 'seconds');
            
            // Set the access token
            dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + results.body.access_token);
            
            // Test basic API call - get user info
            console.log('\n📡 Testing API Call - Get User Info...');
            const usersApi = new docusign.UsersApi(dsApiClient);
            const userInfo = await usersApi.getUserInfo(config.accountId, config.userId);
            
            if (userInfo) {
                console.log('✅ User API Call Successful!');
                console.log('   User Name:', userInfo.firstName, userInfo.lastName);
                console.log('   Email:', userInfo.email);
                console.log('   Account ID:', userInfo.accounts?.[0]?.accountId);
                
                console.log('\n🎉 DocuSign Integration is FULLY FUNCTIONAL!');
                console.log('\n📋 Next Steps:');
                console.log('   1. Make sure you uploaded the public key to your DocuSign app');
                console.log('   2. Test sending an envelope through your application');
                console.log('   3. Your document center is ready for digital signatures!');
            }
            
        } else {
            console.log('❌ JWT Authentication failed - no access token received');
        }
        
    } catch (error) {
        console.log('\n❌ DocuSign Test Failed:');
        console.error('Error:', error.message);
        
        if (error.response && error.response.body) {
            console.log('API Response:', JSON.stringify(error.response.body, null, 2));
        }
        
        console.log('\n🔧 Troubleshooting Tips:');
        console.log('   1. Verify your Integration Key is correct');
        console.log('   2. Make sure the public key is uploaded to your DocuSign app');
        console.log('   3. Check that your User ID and Account ID are correct');
        console.log('   4. Ensure you have the right permissions in DocuSign');
    }
}

testDocuSignConfig();