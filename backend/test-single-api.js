// Test single transaction import to verify recent updates display
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5002/api';

async function testSingleTransaction() {
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
        
        // Get current balance before import
        console.log('\n💰 Checking current balance...');
        try {
            const loansResponse = await axios.get(`${API_BASE}/loans`, { headers });
            if (loansResponse.data && loansResponse.data.length > 0) {
                console.log('Current balance:', loansResponse.data[0].current_balance);
            }
        } catch (error) {
            console.log('Could not get current balance');
        }
        
        // Upload single transaction file
        console.log('\n📤 Testing single transaction import...');
        
        const excelFilePath = path.join(__dirname, 'test_single_transaction.xlsx');
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
            console.log(`  Balance Change: $${transaction.balanceChange}`);
            console.log(`  New Balance: $${transaction.newBalance}`);
            console.log(`  Account: ${transaction.accountNumber}`);
        }
        
        // Verify database was updated
        console.log('\n🔍 Verifying database update...');
        try {
            const loansResponse = await axios.get(`${API_BASE}/loans`, { headers });
            if (loansResponse.data && loansResponse.data.length > 0) {
                console.log('New balance:', loansResponse.data[0].current_balance);
            }
        } catch (error) {
            console.log('Could not verify new balance');
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
console.log('🧪 Starting single transaction import test...');
testSingleTransaction();