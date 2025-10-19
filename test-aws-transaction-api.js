// Test the transaction import functionality on AWS
const axios = require('axios');

const API_BASE = 'http://esoteric-alb-67634983.us-east-1.elb.amazonaws.com/api';

async function testAWSTransactionEndpoints() {
    try {
        console.log('🔐 Testing AWS transaction import endpoints...');
        console.log('API Base:', API_BASE);
        
        // Test 1: Login to get token
        console.log('\n🔐 Logging in...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'demo@esoteric.com',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful');
        
        const headers = {
            'Authorization': `Bearer ${token}`
        };
        
        // Test 2: Check if transaction template endpoint exists
        console.log('\n📄 Testing transaction template endpoint...');
        try {
            const templateResponse = await axios.get(`${API_BASE}/admin/loans/excel-transactions-template`, {
                headers,
                responseType: 'arraybuffer'
            });
            
            if (templateResponse.status === 200) {
                console.log('✅ Transaction template endpoint is working');
                console.log('   Response size:', templateResponse.data.byteLength, 'bytes');
            }
        } catch (error) {
            console.log('❌ Transaction template endpoint failed:', error.response?.status, error.response?.data?.toString() || error.message);
        }
        
        // Test 3: Check if balance template endpoint still works
        console.log('\n📄 Testing balance template endpoint...');
        try {
            const balanceTemplateResponse = await axios.get(`${API_BASE}/admin/loans/excel-template`, {
                headers,
                responseType: 'arraybuffer'
            });
            
            if (balanceTemplateResponse.status === 200) {
                console.log('✅ Balance template endpoint is working');
                console.log('   Response size:', balanceTemplateResponse.data.byteLength, 'bytes');
            }
        } catch (error) {
            console.log('❌ Balance template endpoint failed:', error.response?.status, error.response?.data?.toString() || error.message);
        }
        
        console.log('\n🎉 AWS deployment test complete!');
        console.log('🌐 Frontend URL: http://esoteric-frontend-1760420958.s3-website-us-east-1.amazonaws.com');
        console.log('🔧 Backend URL:', API_BASE);
        
    } catch (error) {
        console.log('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testAWSTransactionEndpoints();