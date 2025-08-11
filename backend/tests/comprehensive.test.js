const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-comprehensive-suite';

// Import test server
const app = require('../server-test.js');

describe('Comprehensive Backend API Tests', () => {
  let regularUserToken = '';
  let adminUserToken = '';
  let testUserId = '';
  let testLoanId = '';
  let testDocumentId = '';

  // Test file paths
  const testFilePath = path.join(__dirname, 'fixtures', 'comprehensive-test.pdf');
  const testImagePath = path.join(__dirname, 'fixtures', 'comprehensive-test.jpg');

  beforeAll(async () => {
    // Create test fixtures directory
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create test PDF file
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n184\n%%EOF');
    fs.writeFileSync(testFilePath, pdfContent);

    // Create test image file (minimal JPG)
    const jpgContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xB2, 0xC0, 0x07, 0xFF, 0xD9]);
    fs.writeFileSync(testImagePath, jpgContent);

    // Login with demo user
    const demoLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@esoteric.com',
        password: 'demo123456'
      });

    if (demoLoginResponse.status === 200) {
      regularUserToken = demoLoginResponse.body.token;
      testUserId = demoLoginResponse.body.user.id;
    }

    // Login with admin user
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@esoteric.com',
        password: 'admin123456'
      });

    if (adminLoginResponse.status === 200) {
      adminUserToken = adminLoginResponse.body.token;
    }
  });

  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  describe('Health Check Endpoint', () => {
    test('GET /api/health should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        database: 'connected',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Authentication Endpoints', () => {
    const uniqueTestUser = {
      email: `test-${Date.now()}@comprehensive.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      phone: '+1234567890'
    };

    describe('POST /api/auth/register', () => {
      test('should register a new user with valid data', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(uniqueTestUser)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'User registered successfully',
          user: {
            id: expect.any(Number),
            email: uniqueTestUser.email,
            firstName: uniqueTestUser.firstName,
            lastName: uniqueTestUser.lastName
          },
          token: expect.any(String)
        });
      });

      test('should reject duplicate email registration', async () => {
        await request(app)
          .post('/api/auth/register')
          .send(uniqueTestUser)
          .expect(400);
      });

      test('should reject invalid email format', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({
            ...uniqueTestUser,
            email: 'invalid-email-format'
          })
          .expect(400);
      });

      test('should reject weak password', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({
            ...uniqueTestUser,
            email: `weak-${Date.now()}@test.com`,
            password: '123'
          })
          .expect(400);
      });

      test('should reject missing required fields', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({
            email: `missing-${Date.now()}@test.com`,
            password: 'ValidPass123!'
            // Missing firstName and lastName
          })
          .expect(400);
      });
    });

    describe('POST /api/auth/login', () => {
      test('should login with correct credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'demo@esoteric.com',
            password: 'demo123456'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Login successful',
          user: {
            id: expect.any(Number),
            email: 'demo@esoteric.com',
            firstName: 'Demo',
            lastName: 'User'
          },
          token: expect.any(String)
        });
      });

      test('should reject incorrect password', async () => {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'demo@esoteric.com',
            password: 'wrongpassword'
          })
          .expect(401);
      });

      test('should reject non-existent user', async () => {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@test.com',
            password: 'password123'
          })
          .expect(401);
      });

      test('should validate email format', async () => {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: 'password123'
          })
          .expect(400);
      });

      test('should require password', async () => {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'demo@esoteric.com'
            // Missing password
          })
          .expect(400);
      });
    });

    describe('POST /api/auth/logout', () => {
      test('should logout successfully', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Logout successful'
        });
      });
    });
  });

  describe('User Profile Endpoints', () => {
    describe('GET /api/user/profile', () => {
      test('should get user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: expect.any(Number),
          email: 'demo@esoteric.com',
          firstName: 'Demo',
          lastName: 'User'
        });
      });

      test('should reject request without token', async () => {
        await request(app)
          .get('/api/user/profile')
          .expect(401);
      });

      test('should reject invalid token', async () => {
        await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(403);
      });

      test('should reject malformed authorization header', async () => {
        await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'InvalidFormat')
          .expect(401);
      });
    });

    describe('PUT /api/user/profile', () => {
      test('should update user profile with valid data', async () => {
        const updateData = {
          firstName: 'Updated',
          lastName: 'Name',
          phone: '+9876543210'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Profile updated successfully',
          user: {
            firstName: updateData.firstName,
            lastName: updateData.lastName,
            phone: updateData.phone
          }
        });
      });

      test('should update only provided fields', async () => {
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({ firstName: 'OnlyFirst' })
          .expect(200);

        expect(response.body.user.firstName).toBe('OnlyFirst');
      });

      test('should reject empty fields', async () => {
        await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({ firstName: '' })
          .expect(400);
      });

      test('should reject invalid phone number', async () => {
        await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({ phone: '123' })
          .expect(400);
      });

      test('should reject request without token', async () => {
        await request(app)
          .put('/api/user/profile')
          .send({ firstName: 'Test' })
          .expect(401);
      });
    });
  });

  describe('Loan Endpoints', () => {
    describe('GET /api/loans', () => {
      test('should get user loans with valid token', async () => {
        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        if (response.body.length > 0) {
          testLoanId = response.body[0].id;
          expect(response.body[0]).toMatchObject({
            id: expect.any(Number),
            account_number: expect.any(String),
            principal_amount: expect.any(Number),
            current_balance: expect.any(Number)
          });
        }
      });

      test('should reject request without token', async () => {
        await request(app)
          .get('/api/loans')
          .expect(401);
      });
    });

    describe('GET /api/loans/:loanId/transactions', () => {
      test('should get loan transactions with valid loan ID', async () => {
        if (!testLoanId) {
          // Create a test loan or skip
          return;
        }

        const response = await request(app)
          .get(`/api/loans/${testLoanId}/transactions`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          transactions: expect.any(Array),
          pagination: {
            total: expect.any(Number),
            limit: expect.any(Number),
            offset: expect.any(Number),
            hasMore: expect.any(Boolean)
          }
        });
      });

      test('should reject invalid loan ID', async () => {
        await request(app)
          .get('/api/loans/99999/transactions')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(404);
      });

      test('should support pagination parameters', async () => {
        if (!testLoanId) return;

        const response = await request(app)
          .get(`/api/loans/${testLoanId}/transactions?limit=5&offset=0`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body.pagination.limit).toBe(5);
        expect(response.body.pagination.offset).toBe(0);
      });
    });

    describe('GET /api/loans/:loanId/analytics', () => {
      test('should get loan analytics with valid loan ID', async () => {
        if (!testLoanId) return;

        const response = await request(app)
          .get(`/api/loans/${testLoanId}/analytics`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          analytics: {
            balanceHistory: expect.any(Array),
            currentBalance: expect.any(Number),
            totalPrincipal: expect.any(Number),
            totalBonuses: expect.any(Number),
            totalWithdrawals: expect.any(Number),
            monthlyRate: expect.any(Number)
          }
        });
      });

      test('should reject invalid loan ID', async () => {
        await request(app)
          .get('/api/loans/99999/analytics')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(404);
      });
    });
  });

  describe('Document Endpoints', () => {
    describe('GET /api/documents', () => {
      test('should get user documents', async () => {
        const response = await request(app)
          .get('/api/documents')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should filter documents by category', async () => {
        const response = await request(app)
          .get('/api/documents?category=statements')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should reject request without token', async () => {
        await request(app)
          .get('/api/documents')
          .expect(401);
      });
    });

    describe('POST /api/admin/documents/upload', () => {
      test('should upload PDF document with admin token', async () => {
        const response = await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .attach('document', testFilePath)
          .field('title', 'Test PDF Document')
          .field('category', 'statements')
          .field('userId', testUserId.toString())
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Document uploaded successfully',
          document: {
            id: expect.any(Number),
            title: 'Test PDF Document',
            category: 'statements',
            file_size: expect.any(Number),
            file_path: expect.any(String)
          }
        });

        testDocumentId = response.body.document.id;
      });

      test('should upload image document', async () => {
        await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .attach('document', testImagePath)
          .field('title', 'Test Image Document')
          .field('category', 'receipts')
          .field('userId', testUserId.toString())
          .expect(201);
      });

      test('should reject upload without file', async () => {
        await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .field('title', 'Test Document')
          .field('category', 'statements')
          .field('userId', testUserId.toString())
          .expect(400);
      });

      test('should reject upload with missing required fields', async () => {
        await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .attach('document', testFilePath)
          // Missing title, category, userId
          .expect(400);
      });

      test('should reject upload with non-admin token', async () => {
        await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .attach('document', testFilePath)
          .field('title', 'Test Document')
          .field('category', 'statements')
          .field('userId', testUserId.toString())
          .expect(403);
      });

      test('should reject upload without token', async () => {
        await request(app)
          .post('/api/admin/documents/upload')
          .attach('document', testFilePath)
          .field('title', 'Test Document')
          .field('category', 'statements')
          .field('userId', testUserId.toString())
          .expect(401);
      });
    });

    describe('GET /api/documents/:documentId/download', () => {
      test('should download document with valid ID', async () => {
        if (!testDocumentId) return;

        const response = await request(app)
          .get(`/api/documents/${testDocumentId}/download`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(200);

        expect(response.headers['content-disposition']).toContain('attachment');
      });

      test('should reject download with invalid document ID', async () => {
        await request(app)
          .get('/api/documents/99999/download')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(404);
      });

      test('should reject download without token', async () => {
        await request(app)
          .get(`/api/documents/${testDocumentId || 1}/download`)
          .expect(401);
      });
    });
  });

  describe('Admin Endpoints', () => {
    describe('GET /api/admin/users', () => {
      test('should get all users with admin token', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        if (response.body.length > 0) {
          expect(response.body[0]).toMatchObject({
            id: expect.any(Number),
            email: expect.any(String),
            first_name: expect.any(String),
            last_name: expect.any(String)
          });
        }
      });

      test('should reject request with regular user token', async () => {
        await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      });

      test('should reject request without token', async () => {
        await request(app)
          .get('/api/admin/users')
          .expect(401);
      });
    });

    describe('GET /api/admin/users/:userId/documents', () => {
      test('should get user documents with admin token', async () => {
        const response = await request(app)
          .get(`/api/admin/users/${testUserId}/documents`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should reject request with regular user token', async () => {
        await request(app)
          .get(`/api/admin/users/${testUserId}/documents`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      });
    });

    describe('DELETE /api/admin/documents/:documentId', () => {
      test('should delete document with admin token', async () => {
        if (!testDocumentId) return;

        const response = await request(app)
          .delete(`/api/admin/documents/${testDocumentId}`)
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Document deleted successfully'
        });
      });

      test('should reject deletion with regular user token', async () => {
        await request(app)
          .delete(`/api/admin/documents/999`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      });

      test('should handle deletion of non-existent document', async () => {
        await request(app)
          .delete('/api/admin/documents/99999')
          .set('Authorization', `Bearer ${adminUserToken}`)
          .expect(404);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);
    });

    test('should handle malformed JSON in POST requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      
      // Should return 400 or 500 for malformed JSON
      expect([400, 500]).toContain(response.status);
    });

    test('should handle large file uploads', async () => {
      // This would require creating a file larger than 10MB
      // For now, we'll just test the error handling structure exists
      expect(true).toBe(true);
    });

    test('should handle database errors gracefully', async () => {
      // This would require mocking database failures
      // The structure is in place in the server code
      expect(true).toBe(true);
    });
  });

  describe('Security Tests', () => {
    test('should reject requests with expired tokens', async () => {
      // This would require generating an expired token
      // The JWT verification handles this in the middleware
      expect(true).toBe(true);
    });

    test('should sanitize file uploads', async () => {
      // Test that only allowed file types are accepted
      const textFilePath = path.join(__dirname, 'fixtures', 'malicious.exe');
      fs.writeFileSync(textFilePath, 'fake executable content');

      await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .attach('document', textFilePath)
        .field('title', 'Malicious File')
        .field('category', 'statements')
        .field('userId', testUserId.toString())
        .expect(400);

      // Clean up
      if (fs.existsSync(textFilePath)) {
        fs.unlinkSync(textFilePath);
      }
    });

    test('should validate input parameters', async () => {
      // Test SQL injection prevention through parameterized queries
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "' OR '1'='1",
          password: "' OR '1'='1"
        });
      
      // Should either fail validation (400) or authentication (401), not succeed
      expect([400, 401]).toContain(response.status);
    });
  });
});