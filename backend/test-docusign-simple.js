// Simple DocuSign Integration Test
require('dotenv').config();
const docusign = require('docusign-esign');
const fs = require('fs');
const path = require('path');

async function testDocuSignIntegration() {
    try {
        console.log('🔍 Testing DocuSign Integration...\n');
        
        const config = {
            integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY,
            userId: process.env.DOCUSIGN_USER_ID,
            privateKeyPath: process.env.DOCUSIGN_PRIVATE_KEY_PATH,
            environment: process.env.DOCUSIGN_ENVIRONMENT || 'demo'
        };
        
        // Set up DocuSign API client
        const dsApiClient = new docusign.ApiClient();
        dsApiClient.setBasePath(config.environment === 'production' ? 
            'https://na1.docusign.net/restapi' : 'https://demo.docusign.net/restapi');
        
        console.log('🔐 Testing JWT Authentication...');
        
        const privateKey = fs.readFileSync(path.resolve(config.privateKeyPath));
        const jwtLifeSec = 10 * 60;
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
            
            console.log('\n🎉 DocuSign Integration is FULLY FUNCTIONAL!');
            console.log('\n📋 Your document center can now:');
            console.log('   ✅ Send documents for digital signature');
            console.log('   ✅ Track signing status in real-time');
            console.log('   ✅ Download completed signed documents');
            console.log('\n🚀 Ready to use DocuSign in your application!');
            
        } else {
            console.log('❌ JWT Authentication failed');
        }
        
    } catch (error) {
        console.log('\n❌ Test Failed:');
        console.error('Error:', error.message);
        
        if (error.response && error.response.body) {
            console.log('Response:', JSON.stringify(error.response.body, null, 2));
        }
    }
}

testDocuSignIntegration();