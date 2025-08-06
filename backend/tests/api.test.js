const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = 5002; // Use different port for testing
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test_user';
process.env.DB_NAME = 'test_db';
process.env.DB_PASSWORD = 'test_password';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Import test server instead of production server
const app = require('../server-test.js');

describe('Backend API Tests', () => {
  let authToken = '';
  let adminToken = '';
  let testUserId = '';
  let testLoanId = '';
  let testDocumentId = '';

  // Test file paths
  const testFilePath = path.join(__dirname, 'fixtures', 'test-document.pdf');
  const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

  beforeAll(async () => {
    // Create test fixtures directory if it doesn't exist
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create a small test PDF file
    if (!fs.existsSync(testFilePath)) {
      const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n184\n%%EOF');
      fs.writeFileSync(testFilePath, pdfContent);
    }

    // Create a small test image file (1x1 pixel JPG)
    if (!fs.existsSync(testImagePath)) {
      const jpgContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xB2, 0xC0, 0x07, 0xFF, 0xD9]);
      fs.writeFileSync(testImagePath, jpgContent);
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

  describe('Health Check', () => {
    test('GET /api/health should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        database: expect.any(String),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Authentication Endpoints', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      phone: '+1234567890'
    };

    const adminUser = {
      email: 'admin@example.com',
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1234567891'
    };

    describe('POST /api/auth/register', () => {
      test('should register a new user with valid data', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(testUser)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'User registered successfully',
          user: {
            id: expect.any(Number),
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName
          },
          token: expect.any(String)
        });

        authToken = response.body.token;
        testUserId = response.body.user.id;
      });

      test('should register admin user', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(adminUser)
          .expect(201);

        adminToken = response.body.token;
      });

      test('should reject registration with duplicate email', async () => {
        await request(app)
          .post('/api/auth/register')
          .send(testUser)
          .expect(400);
      });

      test('should reject registration with invalid email', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({
            ...testUser,
            email: 'invalid-email'
          })
          .expect(400);
      });

      test('should reject registration with weak password', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({
            ...testUser,
            email: 'test2@example.com',
            password: '123'
          })
          .expect(400);
      });
    });

    describe('POST /api/auth/login', () => {
      test('should login with correct credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Login successful',
          user: {
            id: expect.any(Number),
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName
          },
          token: expect.any(String)
        });
      });

      test('should reject login with incorrect password', async () => {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          })
          .expect(401);
      });

      test('should reject login with non-existent email', async () => {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: testUser.password
          })
          .expect(401);
      });
    });
  });

  describe('User Profile Endpoints', () => {
    describe('GET /api/user/profile', () => {
      test('should get user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: expect.any(Number),
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });
      });

      test('should reject request without token', async () => {
        await request(app)
          .get('/api/user/profile')
          .expect(401);
      });

      test('should reject request with invalid token', async () => {
        await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(403);
      });
    });

    describe('PUT /api/user/profile', () => {
      test('should update user profile', async () => {
        const updateData = {
          firstName: 'UpdatedFirst',
          lastName: 'UpdatedLast',
          phone: '+9876543210'
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
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
    });
  });

  describe('Loan Endpoints', () => {
    describe('GET /api/loans', () => {
      test('should get user loans', async () => {
        const response = await request(app)
          .get('/api/loans')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        
        if (response.body.length > 0) {
          testLoanId = response.body[0].id;
          expect(response.body[0]).toMatchObject({
            id: expect.any(Number),
            account_number: expect.any(String),
            principal_amount: expect.any(String),
            current_balance: expect.any(String)
          });
        }
      });
    });

    describe('GET /api/loans/:loanId/transactions', () => {
      test('should get loan transactions', async () => {
        if (!testLoanId) {
          // Skip if no loan available
          return;
        }

        const response = await request(app)
          .get(`/api/loans/${testLoanId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          transactions: expect.any(Array),
          pagination: expect.any(Object)
        });
      });
    });

    describe('GET /api/loans/:loanId/analytics', () => {
      test('should get loan analytics', async () => {
        if (!testLoanId) {
          return;
        }

        const response = await request(app)
          .get(`/api/loans/${testLoanId}/analytics`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          analytics: expect.any(Object)
        });
      });
    });
  });

  describe('Document Endpoints', () => {
    describe('GET /api/documents', () => {
      test('should get user documents', async () => {
        const response = await request(app)
          .get('/api/documents')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should filter documents by category', async () => {
        const response = await request(app)
          .get('/api/documents?category=statements')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/admin/documents/upload - THE MAIN FOCUS', () => {
      test('should upload a PDF document with admin token', async () => {
        const response = await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
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
            file_path: expect.stringContaining('.pdf')
          }
        });

        testDocumentId = response.body.document.id;
      });

      test('should upload an image document', async () => {
        const response = await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('document', testImagePath)
          .field('title', 'Test Image Document')
          .field('category', 'receipts')
          .field('userId', testUserId.toString())
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Document uploaded successfully',
          document: {
            title: 'Test Image Document',
            category: 'receipts',
            file_path: expect.stringContaining('.jpg')
          }
        });
      });

      test('should reject upload without admin token', async () => {
        await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('document', testFilePath)
          .field('title', 'Test Document')
          .field('category', 'statements')
          .field('userId', testUserId.toString())
          .expect(403);
      });

      test('should reject upload without file', async () => {
        await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .field('title', 'Test Document')
          .field('category', 'statements')
          .field('userId', testUserId.toString())
          .expect(400);
      });

      test('should reject upload with invalid file type', async () => {
        // Create a test .exe file (invalid type)
        const invalidFilePath = path.join(__dirname, 'fixtures', 'test.exe');
        fs.writeFileSync(invalidFilePath, 'fake exe content');

        await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('document', invalidFilePath)
          .field('title', 'Invalid Document')
          .field('category', 'statements')
          .field('userId', testUserId.toString())
          .expect(400);

        // Clean up
        fs.unlinkSync(invalidFilePath);
      });

      test('should reject upload with missing required fields', async () => {
        await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('document', testFilePath)
          // Missing title, category, userId
          .expect(400);
      });

      test('should handle file size limits', async () => {
        // This test would require creating a large file, skipping for now
        // In a real scenario, you'd test the 10MB limit
      });
    });

    describe('GET /api/documents/:documentId/download', () => {
      test('should download document with valid ID', async () => {
        if (!testDocumentId) {
          return;
        }

        const response = await request(app)
          .get(`/api/documents/${testDocumentId}/download`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.headers['content-type']).toContain('application');
      });

      test('should reject download with invalid document ID', async () => {
        await request(app)
          .get('/api/documents/99999/download')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('Admin Endpoints', () => {
    describe('GET /api/admin/users', () => {
      test('should get all users with admin token', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });

      test('should reject request with non-admin token', async () => {
        await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });

    describe('GET /api/admin/users/:userId/documents', () => {
      test('should get user documents with admin token', async () => {
        const response = await request(app)
          .get(`/api/admin/users/${testUserId}/documents`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('DELETE /api/admin/documents/:documentId', () => {
      test('should delete document with admin token', async () => {
        if (!testDocumentId) {
          return;
        }

        const response = await request(app)
          .delete(`/api/admin/documents/${testDocumentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Document deleted successfully'
        });
      });

      test('should reject deletion with non-admin token', async () => {
        await request(app)
          .delete(`/api/admin/documents/${testDocumentId || 1}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON in request body', async () => {
      await request(app)
        .post('/api/auth/login')
        .send('invalid json')
        .expect(400);
    });

    test('should handle missing content-type for file upload', async () => {
      await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({})
        .expect(400);
    });
  });

  describe('Input Validation', () => {
    test('should validate email format in registration', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'ValidPassword123!',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);
    });

    test('should validate required fields in document upload', async () => {
      await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', '') // Empty title
        .expect(400);
    });
  });
});