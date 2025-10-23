// Detailed DocuSign Test with Error Handling
require('dotenv').config();
const docusign = require('docusign-esign');
const fs = require('fs');
const path = require('path');

async function detailedDocuSignTest() {
    try {
        console.log('🔍 Detailed DocuSign Configuration Test...\n');
        
        const config = {
            integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY,
            clientSecret: process.env.DOCUSIGN_CLIENT_SECRET,
            userId: process.env.DOCUSIGN_USER_ID,
            accountId: process.env.DOCUSIGN_ACCOUNT_ID,
            privateKeyPath: process.env.DOCUSIGN_PRIVATE_KEY_PATH,
            environment: process.env.DOCUSIGN_ENVIRONMENT || 'production'
        };
        
        console.log('📋 Configuration Values:');
        console.log('   Integration Key:', config.integrationKey);
        console.log('   User ID:', config.userId);
        console.log('   Account ID:', config.accountId);
        console.log('   Environment:', config.environment);
        console.log('   Private Key Path:', config.privateKeyPath);
        console.log('   Client Secret Length:', config.clientSecret ? config.clientSecret.length : 'MISSING');
        
        // Set up DocuSign API client
        const dsApiClient = new docusign.ApiClient();
        const basePath = config.environment === 'production' ? 
            'https://na1.docusign.net/restapi' : 'https://demo.docusign.net/restapi';
        
        console.log('\n🌐 API Base Path:', basePath);
        dsApiClient.setBasePath(basePath);
        
        // Read and validate private key
        console.log('\n🔑 Reading Private Key...');
        if (!fs.existsSync(config.privateKeyPath)) {
            throw new Error(`Private key file not found: ${config.privateKeyPath}`);
        }
        
        const privateKey = fs.readFileSync(path.resolve(config.privateKeyPath));
        console.log('   Private Key Length:', privateKey.length);
        console.log('   Private Key Preview:', privateKey.toString().substring(0, 50) + '...');
        
        console.log('\n🔐 Attempting JWT Authentication...');
        console.log('   Integration Key:', config.integrationKey);
        console.log('   User ID:', config.userId);
        console.log('   Scopes: signature, impersonation');
        
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
            console.log('   Access Token Preview:', results.body.access_token.substring(0, 20) + '...');
            console.log('   Token Type:', results.body.token_type);
            console.log('   Expires In:', results.body.expires_in, 'seconds');
            
            // Set the access token
            dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + results.body.access_token);
            
            console.log('\n🎉 DocuSign Integration is WORKING!');
            console.log('\n✅ Your DocuSign integration is now ready to use!');
            console.log('📋 You can now:');
            console.log('   1. Send documents for signature from your document center');
            console.log('   2. Track signing status in real-time');
            console.log('   3. Download completed signed documents');
            
        } else {
            console.log('❌ JWT Authentication failed - no access token received');
            console.log('Response body:', results);
        }
        
    } catch (error) {
        console.log('\n❌ DocuSign Test Failed:');
        console.log('Error Type:', error.constructor.name);
        console.log('Error Message:', error.message);
        
        if (error.response) {
            console.log('\n📡 HTTP Response Details:');
            console.log('   Status Code:', error.response.status);
            console.log('   Status Text:', error.response.statusText);
            
            if (error.response.data) {
                console.log('   Response Data:', JSON.stringify(error.response.data, null, 2));
            }
            
            if (error.response.body) {
                console.log('   Response Body:', JSON.stringify(error.response.body, null, 2));
            }
        }
        
        console.log('\n🔧 Common Issues and Solutions:');
        console.log('   1. INVALID_INTEGRATION_KEY: Check your Integration Key is correct');
        console.log('   2. USER_NOT_FOUND: Verify your User ID is correct');
        console.log('   3. ACCOUNT_NOT_FOUND: Check your Account ID format and value');
        console.log('   4. INVALID_GRANT: Usually means the RSA key pair doesn\'t match');
        console.log('   5. CONSENT_REQUIRED: You may need to grant consent first');
        
        console.log('\n💡 Try this consent URL (replace with your integration key):');
        console.log(`   https://account.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${config.integrationKey}&redirect_uri=https://www.docusign.com`);
    }
}

detailedDocuSignTest();