// DocuSign Setup Helper Script
require('dotenv').config();

console.log('='.repeat(60));
console.log('🚀 DOCUSIGN SETUP HELPER');
console.log('='.repeat(60));

console.log('\n✅ Integration Key found:', process.env.DOCUSIGN_INTEGRATION_KEY);

console.log('\n📋 NEXT STEPS TO COMPLETE SETUP:');
console.log('\n1. Get your remaining credentials from DocuSign Admin Console:');
console.log('   - Visit: https://admindemo.docusign.com (demo) or https://admin.docusign.com (production)');
console.log('   - Go to: Settings > Apps and Keys');
console.log('   - Find your app with Integration Key:', process.env.DOCUSIGN_INTEGRATION_KEY);

console.log('\n2. You need to collect these values:');
console.log('   📧 USER ID: Your DocuSign user ID (UUID format)');
console.log('   🏢 ACCOUNT ID: Your DocuSign account ID (UUID format)');
console.log('   🔐 CLIENT SECRET: The secret key for your app');

console.log('\n3. Generate RSA Key Pair:');
console.log('   Run these commands in your terminal:');
console.log('   ```');
console.log('   openssl genrsa -out ./keys/docusign_private_key.pem 2048');
console.log('   openssl rsa -in ./keys/docusign_private_key.pem -pubout -out ./keys/docusign_public_key.pem');
console.log('   ```');

console.log('\n4. Upload the public key to your DocuSign app');

console.log('\n📂 Current configuration status:');
console.log('   ✅ DOCUSIGN_INTEGRATION_KEY:', process.env.DOCUSIGN_INTEGRATION_KEY ? 'SET' : '❌ MISSING');
console.log('   ⏳ DOCUSIGN_CLIENT_SECRET:', process.env.DOCUSIGN_CLIENT_SECRET !== 'your_client_secret_here' ? 'SET' : '❌ MISSING');
console.log('   ⏳ DOCUSIGN_USER_ID:', process.env.DOCUSIGN_USER_ID !== 'your_user_id_here' ? 'SET' : '❌ MISSING');
console.log('   ⏳ DOCUSIGN_ACCOUNT_ID:', process.env.DOCUSIGN_ACCOUNT_ID !== 'your_account_id_here' ? 'SET' : '❌ MISSING');
console.log('   ⏳ Private Key:', require('fs').existsSync('./keys/docusign_private_key.pem') ? 'EXISTS' : '❌ MISSING');

console.log('\n💡 TIP: If you are using DocuSign\'s production environment,');
console.log('   make sure DOCUSIGN_ENVIRONMENT is set to "production" in your .env file');

console.log('\n' + '='.repeat(60));