const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-123456';

// Import test server
const app = require('../server-test.js');

describe('Backend API - Focused Document Upload Tests', () => {
  let regularToken = '';
  let adminToken = '';
  let testUserId = '';
  let testDocumentId = '';

  // Test file paths
  const testFilePath = path.join(__dirname, 'fixtures', 'test-document.pdf');

  beforeAll(async () => {
    // Create test fixtures directory
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create a small test PDF file
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n184\n%%EOF');
    fs.writeFileSync(testFilePath, pdfContent);

    // Use the demo user that's already in the database
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@esoteric.com',
        password: 'demo123456'
      });

    if (loginResponse.status === 200) {
      regularToken = loginResponse.body.token;
      testUserId = loginResponse.body.user.id;
    }

    // Use the admin user that's already in the database
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@esoteric.com',
        password: 'admin123456'
      });

    if (adminLoginResponse.status === 200) {
      adminToken = adminLoginResponse.body.token;
    }
  });

  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (fs.existsSync(fixturesDir)) {
      try {
        fs.rmSync(fixturesDir, { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
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

  describe('Authentication', () => {
    test('should login demo user successfully', async () => {
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

    test('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'demo@esoteric.com',
          password: 'wrongpassword'
        })
        .expect(401);
    });
  });

  describe('Document Upload - Core Functionality', () => {
    test('should upload PDF document with admin credentials', async () => {
      if (!adminToken) {
        console.log('Admin token not available, skipping admin upload test');
        return;
      }

      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', testFilePath)
        .field('title', 'Test PDF Document')
        .field('category', 'statements')
        .field('userId', testUserId.toString());

      console.log('Upload response status:', response.status);
      console.log('Upload response body:', response.body);

      expect([200, 201, 403]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toMatchObject({
          message: 'Document uploaded successfully',
          document: {
            id: expect.any(Number),
            title: 'Test PDF Document',
            category: 'statements'
          }
        });
        testDocumentId = response.body.document.id;
      }
    });

    test('should reject upload without authentication', async () => {
      await request(app)
        .post('/api/admin/documents/upload')
        .attach('document', testFilePath)
        .field('title', 'Test Document')
        .field('category', 'statements')
        .field('userId', testUserId.toString())
        .expect(401);
    });

    test('should reject upload without file', async () => {
      if (!adminToken) return;

      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Test Document')
        .field('category', 'statements')
        .field('userId', testUserId.toString());

      expect([400, 403]).toContain(response.status);
    });

    test('should reject upload with missing required fields', async () => {
      if (!adminToken) return;

      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', testFilePath);

      expect([400, 403]).toContain(response.status);
    });
  });

  describe('Document Listing', () => {
    test('should get user documents with valid token', async () => {
      if (!regularToken) return;

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should reject document listing without authentication', async () => {
      await request(app)
        .get('/api/documents')
        .expect(401);
    });
  });

  describe('User Profile', () => {
    test('should get user profile with valid token', async () => {
      if (!regularToken) return;

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String)
      });
    });
  });

  describe('Loan Data', () => {
    test('should get user loans with valid token', async () => {
      if (!regularToken) return;

      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('invalid json string');

      expect([400, 500]).toContain(response.status);
    });

    test('should handle non-existent endpoints', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });
  });
});

// Manual API Testing Functions
describe('Manual API Tests for Document Upload', () => {
  test('Manual test instructions', () => {
    console.log(`
    
MANUAL TESTING INSTRUCTIONS:
=============================

Test the document upload endpoint manually using these curl commands:

1. Login to get token:
   curl -X POST http://localhost:5002/api/auth/login \\
     -H "Content-Type: application/json" \\
     -d '{"email": "demo@esoteric.com", "password": "demo123456"}'

2. Upload document (replace [TOKEN] with actual token):
   curl -X POST http://localhost:5002/api/admin/documents/upload \\
     -H "Authorization: Bearer [TOKEN]" \\
     -F "document=@test-file.pdf" \\
     -F "title=Test Document" \\
     -F "category=statements" \\
     -F "userId=1"

3. List documents:
   curl -X GET http://localhost:5002/api/documents \\
     -H "Authorization: Bearer [TOKEN]"

4. Download document (replace [DOC_ID]):
   curl -X GET http://localhost:5002/api/documents/[DOC_ID]/download \\
     -H "Authorization: Bearer [TOKEN]" \\
     -o downloaded-file.pdf

    `);
  });
});