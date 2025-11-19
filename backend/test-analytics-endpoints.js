const request = require('supertest');
const app = require('./server-2fa.js');

async function testAnalyticsEndpoints() {
    try {
        console.log('🔐 Logging in as regular user...');
        
        // First, let's create a regular user
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: `analytics-test-${Date.now()}@test.com`,
                password: 'password123',
                firstName: 'Analytics',
                lastName: 'Test'
            });

        if (!registerRes.body.token) {
            console.log('❌ Registration failed:', registerRes.body);
            return;
        }

        const token = registerRes.body.token;
        const userId = registerRes.body.user.id;
        console.log('✅ User created with ID:', userId);

        // Test all user-facing endpoints that might be used in Analytics tab
        console.log('\n📊 Testing potential Analytics endpoints...');

        const endpoints = [
            '/api/user/profile',
            '/api/loans',
            '/api/documents',
            '/api/withdrawal-requests',
            '/api/meeting-requests',
            '/api/calendly/user',
            '/api/calendly/scheduled-events'
        ];

        for (const endpoint of endpoints) {
            try {
                const res = await request(app)
                    .get(endpoint)
                    .set('Authorization', `Bearer ${token}`);
                
                console.log(`${endpoint}: ${res.status} - ${res.body ? 'Has data' : 'No data'}`);
                if (res.status === 200 && res.body) {
                    console.log(`  Data structure: ${Array.isArray(res.body) ? 'Array' : 'Object'} with ${Array.isArray(res.body) ? res.body.length + ' items' : Object.keys(res.body).length + ' properties'}`);
                }
            } catch (error) {
                console.log(`${endpoint}: ERROR - ${error.message}`);
            }
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        process.exit(1);
    }
}

testAnalyticsEndpoints();