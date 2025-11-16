// Quick script to inspect actual API responses
// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

const request = require('supertest');
const { createTestUser, createUserSession, cleanDatabase } = require('./final-tests/helpers/test-utils');
const app = require('./server-2fa');

async function inspectAPI() {
  try {
    console.log('Setting up test data...');
    await cleanDatabase();
    
    // Get the test pool for test data setup
    const { pool } = require('./final-tests/helpers/test-utils');
    
    console.log('Test DB_NAME environment:', process.env.DB_NAME);
    console.log('Server should now be using test database');
    
    const user = await createTestUser({
      email: 'inspect@example.com',
      firstName: 'Inspect',
      lastName: 'User',
      accountVerified: false // Test with unverified user first
    });
    const token = await createUserSession(user.id);
    
    console.log('Created user ID:', user.id);
    
    // Let's check what's in the database
    const dbUser = await pool.query('SELECT id, email, first_name FROM users WHERE id = $1', [user.id]);
    console.log('User in DB:', dbUser.rows[0]);
    
    const session = await pool.query('SELECT user_id, expires_at > NOW() as valid FROM user_sessions WHERE user_id = $1', [user.id]);
    console.log('Session in DB:', session.rows[0]);
    
    console.log('\n=== Testing GET /api/user/profile ===');
    
    // Test the profile endpoint without modifying the server
    const profileResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
    
    console.log('Status:', profileResponse.status);
    console.log('Body:', JSON.stringify(profileResponse.body, null, 2));
    
    // Let's also check what the auth middleware found
    if (profileResponse.status !== 200) {
      console.log('Profile request failed. Checking auth middleware behavior...');
      
      // Check if our session hash calculation matches what auth middleware expects
      const crypto = require('crypto');
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
      console.log('Expected session hash:', expectedHash);
      
      const sessionCheck = await pool.query(`
        SELECT us.user_id, us.is_2fa_complete, u.requires_2fa, u.email, u.first_name, u.last_name
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        WHERE us.token_hash = $1 AND us.expires_at > NOW()
      `, [expectedHash]);
      
      console.log('Session check result:', sessionCheck.rows);
      
      // Test what the profile endpoint sees
      const directUserQuery = await pool.query(
        'SELECT id, email, first_name, last_name, phone, role, requires_2fa, last_login, created_at, account_verified FROM users WHERE id = $1',
        [user.id]
      );
      console.log('Direct user query result:', directUserQuery.rows);
    }
    
    console.log('\n=== Testing PUT /api/user/profile (empty body) ===');
    const updateEmptyResponse = await request(app)
      .put('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    
    console.log('Status:', updateEmptyResponse.status);
    console.log('Body:', JSON.stringify(updateEmptyResponse.body, null, 2));
    
    console.log('\n=== Testing PUT /api/user/profile (valid update) ===');
    const updateValidResponse = await request(app)
      .put('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+1234567890'
      });
    
    console.log('Valid update status:', updateValidResponse.status);
    console.log('Valid update body:', JSON.stringify(updateValidResponse.body, null, 2));
    
    console.log('\n=== Testing PUT /api/user/profile (invalid phone) ===');
    const updateInvalidResponse = await request(app)
      .put('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Test',
        lastName: 'User',
        phone: 'invalid-phone'
      });
    
    console.log('Status:', updateInvalidResponse.status);
    console.log('Body:', JSON.stringify(updateInvalidResponse.body, null, 2));
    
    console.log('\n=== Testing account verification request ===');
    const verificationResponse = await request(app)
      .post('/api/user/request-account-verification')
      .set('Authorization', `Bearer ${token}`);
    
    console.log('Verification status:', verificationResponse.status);
    console.log('Verification body:', JSON.stringify(verificationResponse.body, null, 2));
    
    // Test verification request for already verified user
    const verifiedUser = await createTestUser({
      email: 'verified@example.com',
      firstName: 'Verified',
      lastName: 'User',
      accountVerified: true
    });
    const verifiedToken = await createUserSession(verifiedUser.id);
    
    console.log('\n=== Testing account verification request (already verified) ===');
    const verifiedVerificationResponse = await request(app)
      .post('/api/user/request-account-verification')
      .set('Authorization', `Bearer ${verifiedToken}`);
    
    console.log('Already verified status:', verifiedVerificationResponse.status);
    console.log('Already verified body:', JSON.stringify(verifiedVerificationResponse.body, null, 2));
    
    console.log('\n=== Testing invalid token ===');
    const invalidTokenResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', 'Bearer invalid-token');
    
    console.log('Status:', invalidTokenResponse.status);
    console.log('Body:', JSON.stringify(invalidTokenResponse.body, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectAPI();