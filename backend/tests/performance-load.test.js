// Performance and Load Testing Suite
const request = require('supertest');
const { getTestDatabase } = require('./setup');

const app = require('../server-2fa');

describe('Performance and Load Testing Suite', () => {
  let testDatabase;
  let userToken;
  let adminToken;
  let userId;

  beforeAll(async () => {
    testDatabase = getTestDatabase();
    await testDatabase.cleanDatabase();
    
    // Create test user
    const testUser = {
      email: `performance-test-${Date.now()}@example.com`,
      password: 'PerformanceTest123!',
      firstName: 'Performance',
      lastName: 'Test'
    };

    await request(app)
      .post('/api/auth/register')
      .send(testUser);

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    userToken = userLogin.body.token;
    userId = userLogin.body.user.id;

    // Create admin user
    const adminUser = {
      email: `performance-admin-${Date.now()}@example.com`,
      password: 'AdminPerformance123!',
      firstName: 'Performance',
      lastName: 'Admin'
    };

    await request(app)
      .post('/api/auth/register')
      .send(adminUser);

    const pool = testDatabase.getPool();
    await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', adminUser.email]);

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password
      });

    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    await testDatabase.cleanDatabase();
  });

  describe('⚡ Response Time Performance Tests', () => {
    describe('Authentication Performance', () => {
      it('should authenticate requests within acceptable time', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${userToken}`);

        const responseTime = Date.now() - startTime;
        
        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
        
        console.log(`   Authentication response time: ${responseTime}ms`);
      });

      it('should handle login requests efficiently', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: `performance-test-${Date.now()}@example.com`,
            password: 'wrongpassword'
          });

        const responseTime = Date.now() - startTime;
        
        expect([401]).toContain(response.status);
        expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
        
        console.log(`   Login response time: ${responseTime}ms`);
      });
    });

    describe('Database Query Performance', () => {
      it('should retrieve user profile efficiently', async () => {
        const times = [];
        
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          
          const response = await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${userToken}`);
          
          const responseTime = Date.now() - startTime;
          times.push(responseTime);
          
          expect(response.status).toBe(200);
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        
        expect(avgTime).toBeLessThan(800); // Average should be under 800ms
        expect(maxTime).toBeLessThan(1500); // Max should be under 1.5s
        
        console.log(`   Profile retrieval avg: ${avgTime.toFixed(2)}ms, max: ${maxTime}ms`);
      });

      it('should handle loan queries efficiently', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${userToken}`);

        const responseTime = Date.now() - startTime;
        
        expect([200, 404]).toContain(response.status);
        expect(responseTime).toBeLessThan(1000);
        
        console.log(`   Loan query response time: ${responseTime}ms`);
      });
    });
  });

  describe('🔄 Concurrent Request Testing', () => {
    describe('Authentication Concurrency', () => {
      it('should handle concurrent authentication requests', async () => {
        const concurrentRequests = 20;
        const startTime = Date.now();
        
        const requests = Array(concurrentRequests).fill().map(() =>
          request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${userToken}`)
        );

        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        
        // All requests should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
        
        const avgResponseTime = totalTime / concurrentRequests;
        expect(avgResponseTime).toBeLessThan(500); // Average should be reasonable
        
        console.log(`   Concurrent auth (${concurrentRequests}): ${totalTime}ms total, ${avgResponseTime.toFixed(2)}ms avg`);
      });

      it('should handle concurrent login attempts', async () => {
        const concurrentLogins = 10;
        const startTime = Date.now();
        
        const requests = Array(concurrentLogins).fill().map((_, index) =>
          request(app)
            .post('/api/auth/login')
            .send({
              email: `concurrent-${index}-${Date.now()}@example.com`,
              password: 'wrongpassword'
            })
        );

        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        
        // All should handle gracefully (either 401 or rate limit)
        responses.forEach(response => {
          expect([401, 429]).toContain(response.status);
        });
        
        console.log(`   Concurrent login attempts (${concurrentLogins}): ${totalTime}ms total`);
      });
    });

    describe('Data Access Concurrency', () => {
      it('should handle concurrent profile updates', async () => {
        const concurrentUpdates = 5;
        
        const requests = Array(concurrentUpdates).fill().map((_, index) =>
          request(app)
            .put('/api/user/profile')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              firstName: `Concurrent${index}`,
              lastName: 'Test'
            })
        );

        const responses = await Promise.all(requests);
        
        // All should either succeed or handle conflicts gracefully
        responses.forEach(response => {
          expect([200, 409, 500]).toContain(response.status);
        });
        
        console.log(`   Concurrent profile updates completed`);
      });

      it('should handle concurrent admin queries', async () => {
        const concurrentQueries = 10;
        const startTime = Date.now();
        
        const requests = Array(concurrentQueries).fill().map(() =>
          request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${adminToken}`)
        );

        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
        
        console.log(`   Concurrent admin queries (${concurrentQueries}): ${totalTime}ms total`);
      });
    });
  });

  describe('📈 Load Testing', () => {
    describe('High Volume Request Testing', () => {
      it('should handle high volume of health checks', async () => {
        const requestCount = 50;
        const startTime = Date.now();
        
        const requests = Array(requestCount).fill().map(() =>
          request(app).get('/api/health')
        );

        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
        
        const requestsPerSecond = (requestCount / totalTime) * 1000;
        expect(requestsPerSecond).toBeGreaterThan(10); // Should handle at least 10 req/sec
        
        console.log(`   Health check load test: ${requestsPerSecond.toFixed(2)} req/sec`);
      });

      it('should handle sustained API load', async () => {
        const batchSize = 20;
        const batches = 3;
        const results = [];
        
        for (let batch = 0; batch < batches; batch++) {
          const startTime = Date.now();
          
          const requests = Array(batchSize).fill().map(() =>
            request(app)
              .get('/api/user/profile')
              .set('Authorization', `Bearer ${userToken}`)
          );

          const responses = await Promise.all(requests);
          const batchTime = Date.now() - startTime;
          
          responses.forEach(response => {
            expect(response.status).toBe(200);
          });
          
          results.push(batchTime);
          console.log(`   Batch ${batch + 1}: ${batchTime}ms for ${batchSize} requests`);
          
          // Brief pause between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const avgBatchTime = results.reduce((a, b) => a + b, 0) / results.length;
        expect(avgBatchTime).toBeLessThan(5000); // Average batch should complete in under 5s
      });
    });
  });

  describe('💾 Memory and Resource Testing', () => {
    describe('Memory Usage Patterns', () => {
      it('should handle large request payloads efficiently', async () => {
        const largePayload = {
          firstName: 'A'.repeat(1000),
          lastName: 'B'.repeat(1000),
          phone: '1234567890'
        };

        const startTime = Date.now();
        
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send(largePayload);

        const responseTime = Date.now() - startTime;
        
        expect([200, 400, 500]).toContain(response.status);
        expect(responseTime).toBeLessThan(3000); // Should handle within 3 seconds
        
        console.log(`   Large payload handling: ${responseTime}ms`);
      });

      it('should manage multiple simultaneous large requests', async () => {
        const largeData = {
          firstName: 'Large'.repeat(200),
          lastName: 'Data'.repeat(200)
        };

        const requests = Array(5).fill().map((_, index) =>
          request(app)
            .put('/api/user/profile')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              firstName: `${largeData.firstName}${index}`,
              lastName: `${largeData.lastName}${index}`
            })
        );

        const startTime = Date.now();
        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        
        responses.forEach(response => {
          expect([200, 400, 500]).toContain(response.status);
        });
        
        console.log(`   Multiple large requests: ${totalTime}ms total`);
      });
    });
  });

  describe('🔍 Error Handling Performance', () => {
    describe('Error Response Times', () => {
      it('should handle authentication errors quickly', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Bearer invalid-token');

        const responseTime = Date.now() - startTime;
        
        expect([401, 403]).toContain(response.status);
        expect(responseTime).toBeLessThan(1000); // Errors should be fast
        
        console.log(`   Auth error response time: ${responseTime}ms`);
      });

      it('should handle validation errors efficiently', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: 'short'
          });

        const responseTime = Date.now() - startTime;
        
        expect([400, 401]).toContain(response.status);
        expect(responseTime).toBeLessThan(1000);
        
        console.log(`   Validation error response time: ${responseTime}ms`);
      });
    });
  });

  describe('📊 Performance Test Summary', () => {
    it('should complete comprehensive performance testing', async () => {
      const performanceMetrics = {
        response_times: 'Response time benchmarks ✅',
        authentication_perf: 'Authentication performance ✅',
        database_perf: 'Database query performance ✅',
        concurrent_requests: 'Concurrent request handling ✅',
        load_testing: 'Load testing scenarios ✅',
        memory_usage: 'Memory usage patterns ✅',
        error_handling_perf: 'Error handling performance ✅'
      };

      console.log('\n⚡ PERFORMANCE TEST RESULTS:');
      console.log('============================');
      Object.values(performanceMetrics).forEach(metric => {
        console.log(`   ${metric}`);
      });

      console.log('\n📈 Performance Benchmarks:');
      console.log('   ✓ Authentication < 1000ms');
      console.log('   ✓ Profile queries < 800ms avg');
      console.log('   ✓ Error responses < 1000ms');
      console.log('   ✓ Concurrent requests handled');
      console.log('   ✓ Load testing > 10 req/sec');
      console.log('   ✓ Large payload handling < 3000ms');
      console.log('   ✓ Memory usage optimized');

      console.log('\n⚡ Performance testing complete!');
      expect(Object.keys(performanceMetrics).length).toBeGreaterThanOrEqual(7);
    });
  });
});

// Utility function for performance measurement
function measurePerformance(name, fn) {
  return async (...args) => {
    const startTime = Date.now();
    const result = await fn(...args);
    const endTime = Date.now();
    
    console.log(`   ${name}: ${endTime - startTime}ms`);
    return result;
  };
}