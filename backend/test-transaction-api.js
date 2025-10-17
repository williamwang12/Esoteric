// Test the transaction import API endpoints
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5002/api';

async function testTransactionImport() {
    try {
        console.log('🔐 Logging in as admin...');
        
        // Login to get token
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'demo@esoteric.com',
            password: 'demo123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful, token received');
        
        const headers = {
            'Authorization': `Bearer ${token}`
        };
        
        // Test 1: Download transaction template
        console.log('\n📄 Testing transaction template download...');
        try {
            const templateResponse = await axios.get(`${API_BASE}/admin/loans/excel-transactions-template`, {
                headers,
                responseType: 'arraybuffer'
            });
            
            if (templateResponse.status === 200) {
                console.log('✅ Transaction template downloaded successfully');
                fs.writeFileSync('downloaded_transaction_template.xlsx', templateResponse.data);
                console.log('📁 Template saved as: downloaded_transaction_template.xlsx');
            }
        } catch (error) {
            console.log('❌ Template download failed:', error.response?.data || error.message);
        }
        
        // Test 2: Upload transaction file
        console.log('\n📤 Testing transaction import...');
        
        const excelFilePath = path.join(__dirname, 'test_transactions.xlsx');
        if (!fs.existsSync(excelFilePath)) {
            console.log('❌ Test Excel file not found:', excelFilePath);
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('excel', fs.createReadStream(excelFilePath));
            
            const uploadResponse = await axios.post(`${API_BASE}/admin/loans/excel-transactions`, formData, {
                headers: {
                    ...headers,
                    ...formData.getHeaders()
                }
            });
            
            console.log('✅ Transaction import successful!');
            console.log('📊 Results:', {
                totalRows: uploadResponse.data.summary.totalRows,
                successfulTransactions: uploadResponse.data.summary.successfulTransactions,
                errors: uploadResponse.data.summary.errors
            });
            
            if (uploadResponse.data.transactions && uploadResponse.data.transactions.length > 0) {
                console.log('\n💰 Imported transactions:');
                uploadResponse.data.transactions.forEach((transaction, index) => {
                    console.log(`  ${index + 1}. ${transaction.email} - ${transaction.transactionType} - $${transaction.amount} (Balance: $${transaction.newBalance})`);
                });
            }
            
            if (uploadResponse.data.errors && uploadResponse.data.errors.length > 0) {
                console.log('\n❌ Errors:');
                uploadResponse.data.errors.forEach((error, index) => {
                    console.log(`  ${index + 1}. ${error}`);
                });
            }
            
        } catch (error) {
            console.log('❌ Transaction import failed:', error.response?.data || error.message);
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
console.log('🧪 Starting transaction import API test...');
testTransactionImport();