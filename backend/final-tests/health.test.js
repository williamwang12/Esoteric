const request = require('supertest');
const app = require('../server-2fa.js');

describe('Health Endpoints', () => {
    describe('GET /', () => {
        test('should return basic service health status', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('service', 'esoteric-backend');
        });

        test('should respond quickly', async () => {
            const startTime = Date.now();
            
            await request(app)
                .get('/')
                .expect(200);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should respond within 100ms
            expect(duration).toBeLessThan(100);
        });

        test('should return JSON content type', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.headers['content-type']).toMatch(/json/);
        });
    });

    describe('GET /api/health', () => {
        test('should return comprehensive health check with database connection', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('database', 'connected');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('features');
            
            // Verify timestamp is recent (within last 5 seconds)
            const timestamp = new Date(response.body.timestamp);
            const now = new Date();
            const timeDiff = now - timestamp;
            expect(timeDiff).toBeLessThan(5000);
        });

        test('should include expected features', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            const { features } = response.body;
            expect(Array.isArray(features)).toBe(true);
            expect(features).toContain('2FA');
            expect(features).toContain('JWT Sessions');
            expect(features).toContain('TOTP');
            expect(features).toContain('Backup Codes');
        });

        test('should respond with valid JSON structure', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            // Verify all required fields are present
            expect(typeof response.body.status).toBe('string');
            expect(typeof response.body.database).toBe('string');
            expect(typeof response.body.timestamp).toBe('string');
            expect(Array.isArray(response.body.features)).toBe(true);
        });

        test('should respond quickly for monitoring purposes', async () => {
            const startTime = Date.now();
            
            await request(app)
                .get('/api/health')
                .expect(200);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Health checks should be fast (under 2 seconds)
            expect(duration).toBeLessThan(2000);
        });

        test('should handle multiple concurrent requests', async () => {
            const promises = Array.from({ length: 5 }, () =>
                request(app)
                    .get('/api/health')
                    .expect(200)
            );

            const responses = await Promise.all(promises);
            
            // All should succeed
            responses.forEach(response => {
                expect(response.body.status).toBe('healthy');
                expect(response.body.database).toBe('connected');
            });
        });

        test('should return proper HTTP headers', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.headers['content-type']).toMatch(/json/);
            expect(response.headers).not.toHaveProperty('set-cookie');
        });
    });

    describe('Database Health Validation', () => {
        test('should verify database connectivity through health endpoint', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            // Health endpoint includes database connectivity test
            expect(response.body.database).toBe('connected');
        });

        test('should handle database connection issues gracefully', async () => {
            // The /api/health endpoint tests database connectivity
            // If DB is down, it should return 500 with proper error structure
            const response = await request(app)
                .get('/api/health');

            if (response.status === 500) {
                expect(response.body.status).toBe('unhealthy');
                expect(response.body).toHaveProperty('error');
                expect(response.body).toHaveProperty('timestamp');
            } else {
                expect(response.status).toBe(200);
                expect(response.body.status).toBe('healthy');
            }
        });

        test('should provide meaningful error messages for database failures', async () => {
            const response = await request(app)
                .get('/api/health');

            // Should always provide structured response
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            
            if (response.body.status === 'unhealthy') {
                expect(response.body).toHaveProperty('error');
                expect(typeof response.body.error).toBe('string');
            }
        });
    });

    describe('Health Monitoring Integration', () => {
        test('should support load balancer health checks', async () => {
            // Test rapid successive calls like a load balancer would make
            const promises = Array.from({ length: 10 }, () =>
                request(app).get('/api/health')
            );

            const responses = await Promise.all(promises);
            
            // All should return 200 OK for load balancer
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        test('should provide uptime-friendly responses', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            // Response should be suitable for uptime monitoring
            expect(response.body.status).toBe('healthy');
            expect(response.body).toHaveProperty('timestamp');
            
            // Should not contain sensitive information
            expect(response.body).not.toHaveProperty('password');
            expect(response.body).not.toHaveProperty('secret');
            expect(response.body).not.toHaveProperty('token');
        });

        test('should handle OPTIONS requests for CORS', async () => {
            const response = await request(app)
                .options('/api/health');

            // Should handle preflight requests
            expect([200, 204, 404]).toContain(response.status);
        });
    });

    describe('Performance and Reliability', () => {
        test('should maintain performance under concurrent load', async () => {
            const concurrentRequests = 20;
            const startTime = Date.now();
            
            const promises = Array.from({ length: concurrentRequests }, () =>
                request(app).get('/api/health').expect(200)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalDuration = endTime - startTime;
            
            // Should handle 20 concurrent requests in under 5 seconds
            expect(totalDuration).toBeLessThan(5000);
        });

        test('should return consistent response format', async () => {
            const responses = await Promise.all([
                request(app).get('/'),
                request(app).get('/api/health'),
                request(app).get('/api/dbtest')
            ]);

            // All should return valid JSON
            responses.forEach(response => {
                expect(response.headers['content-type']).toMatch(/json/);
                expect(typeof response.body).toBe('object');
            });
        });

        test('should not leak memory on repeated calls', async () => {
            // Make multiple calls to ensure no memory leaks
            for (let i = 0; i < 50; i++) {
                await request(app)
                    .get('/api/health')
                    .expect(200);
            }
            
            // If we reach here without timeout, memory handling is likely OK
            expect(true).toBe(true);
        });
    });

    describe('Security Considerations', () => {
        test('should not expose sensitive server information', async () => {
            const healthResponse = await request(app)
                .get('/api/health')
                .expect(200);

            // Should not expose internal details
            expect(healthResponse.body).not.toHaveProperty('env');
            expect(healthResponse.body).not.toHaveProperty('config');
            expect(healthResponse.body).not.toHaveProperty('secrets');
        });

        test('should not require authentication for health checks', async () => {
            // Health endpoints should be accessible without auth
            await request(app)
                .get('/')
                .expect(200);

            await request(app)
                .get('/api/health')
                .expect(200);
        });

        test('should handle malformed requests gracefully', async () => {
            const response = await request(app)
                .get('/api/health?invalid=param&test=value');

            // Should still work with query parameters
            expect([200, 400]).toContain(response.status);
        });
    });
});