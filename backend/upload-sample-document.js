const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function uploadSampleDocument() {
    try {
        console.log('🔍 Uploading sample loan agreement for DocuSign testing...\n');
        
        // Get auth token (you'll need to replace this with your actual token)
        // For now, we'll use a demo user token
        const authToken = 'your_auth_token_here'; // You'll need to get this from your login
        
        // Create form data
        const form = new FormData();
        form.append('document', fs.createReadStream('/Users/williamwang/Esoteric/backend/sample_loan_agreement.pdf'));
        form.append('title', 'Sample Loan Agreement.pdf');
        form.append('category', 'loan_agreement');
        form.append('description', 'Sample loan agreement document for DocuSign testing');
        
        // Upload the document
        const response = await fetch('http://localhost:5002/api/documents/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                ...form.getHeaders()
            },
            body: form
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Sample document uploaded successfully!');
            console.log('📋 Document details:');
            console.log('   Title:', result.title);
            console.log('   Category:', result.category);
            console.log('   ID:', result.id);
            console.log('\n🎉 You should now see a "Send for Signature" button on this document!');
        } else {
            const error = await response.text();
            console.log('❌ Upload failed:', response.status, error);
        }
        
    } catch (error) {
        console.error('Error uploading document:', error.message);
    }
}

// Note: You'll need to run this after logging in to get an auth token
console.log('📝 To upload the sample document:');
console.log('1. Log in to your app at http://localhost:3000');
console.log('2. Open browser developer tools (F12)');
console.log('3. Go to Application > Local Storage > http://localhost:3000');
console.log('4. Copy the "authToken" value');
console.log('5. Replace "your_auth_token_here" in this script with your token');
console.log('6. Run: node upload-sample-document.js\n');

// uploadSampleDocument();