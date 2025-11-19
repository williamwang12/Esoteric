const request = require('supertest');
const app = require('../server-2fa.js');
const speakeasy = require('speakeasy');

describe('2FA Test Suite', () => {
    // Helper function to create a new user for tests
    const createTestUser = async (suffix = '') => {
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: `2fa-test-${Date.now()}-${Math.random().toString(36).substring(7)}-${suffix}@test.com`,
                password: 'password123',
                firstName: '2FA',
                lastName: 'Test'
            });
        expect(registerRes.status).toBe(201);
        return {
            token: registerRes.body.token,
            userId: registerRes.body.user.id,
            userEmail: registerRes.body.user.email
        };
    };

    describe('Core 2FA Functionality', () => {
        test('should handle complete 2FA setup and verification flow', async () => {
            const user = await createTestUser('complete-flow');
            
            // Step 1: Check initial status
            const initialStatus = await request(app)
                .get('/api/2fa/status')
                .set('Authorization', `Bearer ${user.token}`)
                .expect(200);

            expect(initialStatus.body.enabled).toBe(false);

            // Step 2: Initiate 2FA setup
            const setupResponse = await request(app)
                .post('/api/2fa/setup')
                .set('Authorization', `Bearer ${user.token}`)
                .expect(200);

            expect(setupResponse.body).toHaveProperty('manualEntryKey');
            expect(setupResponse.body).toHaveProperty('qrCode');
            expect(setupResponse.body.qrCode).toMatch(/^data:image\/png;base64,/);

            const twoFASecret = setupResponse.body.manualEntryKey;

            // Step 3: Generate valid TOTP token
            const validToken = speakeasy.totp({
                secret: twoFASecret,
                encoding: 'base32'
            });

            // Step 4: Complete 2FA setup with valid token
            const verifyResponse = await request(app)
                .post('/api/2fa/verify-setup')
                .set('Authorization', `Bearer ${user.token}`)
                .send({ token: validToken })
                .expect(200);

            expect(verifyResponse.body.message).toMatch(/successfully enabled/);
            expect(verifyResponse.body).toHaveProperty('backupCodes');
            expect(Array.isArray(verifyResponse.body.backupCodes)).toBe(true);
            expect(verifyResponse.body.backupCodes.length).toBe(10);

            // Step 5: Verify status is updated
            const finalStatus = await request(app)
                .get('/api/2fa/status')
                .set('Authorization', `Bearer ${user.token}`)
                .expect(200);

            expect(finalStatus.body.enabled).toBe(true);
            expect(finalStatus.body.backup_codes_remaining).toBe(10);

            // Step 6: Verify setup cannot be re-initiated
            const reSetupResponse = await request(app)
                .post('/api/2fa/setup')
                .set('Authorization', `Bearer ${user.token}`)
                .expect(400);

            expect(reSetupResponse.body.error).toBe('2FA is already enabled for this account');
        });

        test('should reject invalid TOTP tokens during setup', async () => {
            const user = await createTestUser('invalid-token');
            
            // Setup 2FA
            await request(app)
                .post('/api/2fa/setup')
                .set('Authorization', `Bearer ${user.token}`)
                .expect(200);

            // Try to verify with invalid token
            const response = await request(app)
                .post('/api/2fa/verify-setup')
                .set('Authorization', `Bearer ${user.token}`)
                .send({ token: '000000' })
                .expect(400);

            expect(response.body.error).toBe('Invalid verification code');
        });

        test('should validate token format', async () => {
            const user = await createTestUser('token-format');
            
            // Setup 2FA
            await request(app)
                .post('/api/2fa/setup')
                .set('Authorization', `Bearer ${user.token}`)
                .expect(200);

            // Try with invalid format (too short)
            const response = await request(app)
                .post('/api/2fa/verify-setup')
                .set('Authorization', `Bearer ${user.token}`)
                .send({ token: '12345' })
                .expect(400);

            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors.length).toBeGreaterThan(0);
        });

        test('should require authentication for 2FA endpoints', async () => {
            // Test status endpoint
            await request(app)
                .get('/api/2fa/status')
                .expect(401);

            // Test setup endpoint  
            await request(app)
                .post('/api/2fa/setup')
                .expect(401);
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed JSON gracefully', async () => {
            const user = await createTestUser('malformed-json');
            
            const response = await request(app)
                .post('/api/2fa/verify-setup')
                .set('Authorization', `Bearer ${user.token}`)
                .set('Content-Type', 'application/json')
                .send('{"token": "123456", "invalid": }');

            expect([400, 500]).toContain(response.status);
        });

        test('should handle concurrent setup requests', async () => {
            const user = await createTestUser('concurrent');
            
            // Make multiple concurrent setup requests
            const promises = Array.from({ length: 3 }, () =>
                request(app)
                    .post('/api/2fa/setup')
                    .set('Authorization', `Bearer ${user.token}`)
            );

            const responses = await Promise.all(promises);

            // All should succeed (or be handled gracefully)
            responses.forEach(response => {
                expect([200, 429]).toContain(response.status); // 429 is acceptable for rate limiting
            });
        });
    });
});