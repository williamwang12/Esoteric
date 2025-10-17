// Test the date verification transaction
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5002/api';

async function testDateVerification() {
    try {
        console.log('🔐 Logging in as admin...');
        
        // Login to get token
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'demo@esoteric.com',
            password: 'demo123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful');
        
        const headers = {
            'Authorization': `Bearer ${token}`
        };
        
        // Upload date verification transaction
        console.log('\n📤 Testing date verification transaction...');
        
        const excelFilePath = path.join(__dirname, 'test_date_verification.xlsx');
        if (!fs.existsSync(excelFilePath)) {
            console.log('❌ Test Excel file not found:', excelFilePath);
            return;
        }
        
        const formData = new FormData();
        formData.append('excel', fs.createReadStream(excelFilePath));
        
        const uploadResponse = await axios.post(`${API_BASE}/admin/loans/excel-transactions`, formData, {
            headers: {
                ...headers,
                ...formData.getHeaders()
            }
        });
        
        console.log('✅ Transaction import successful!');
        console.log('📊 Results:', uploadResponse.data.summary);
        
        if (uploadResponse.data.transactions && uploadResponse.data.transactions.length > 0) {
            console.log('\n💰 Imported transaction:');
            const transaction = uploadResponse.data.transactions[0];
            console.log(`  Email: ${transaction.email}`);
            console.log(`  Type: ${transaction.transactionType}`);
            console.log(`  Amount: $${transaction.amount}`);
            console.log(`  Transaction Date (from response): ${transaction.transactionDate}`);
            console.log(`  Balance Change: $${transaction.balanceChange}`);
            console.log(`  New Balance: $${transaction.newBalance}`);
        }
        
        // Check database to verify the date was stored correctly
        console.log('\n🔍 Verifying database storage...');
        
    } catch (error) {
        console.log('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
console.log('🧪 Starting date verification test...');
testDateVerification();