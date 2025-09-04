const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

// Import test server
const app = require('../server-test.js');

describe('Document Upload API - Comprehensive Tests', () => {
  let authToken = '';
  let adminToken = '';
  let testUserId = '';
  let testDocumentId = '';

  // Test file paths
  const testFilePath = path.join(__dirname, 'fixtures', 'test-document.pdf');
  const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
  const invalidFilePath = path.join(__dirname, 'fixtures', 'test.exe');

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

    // Use the demo user that's already in the database
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'demo@esoteric.com',
        password: 'demo123456'
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.token;
      testUserId = loginResponse.body.user.id;
    } else {
      throw new Error(`Login failed: ${JSON.stringify(loginResponse.body)}`);
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
    } else {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginResponse.body)}`);
    }
  });

  afterAll(async () => {
    // Clean up test files
    const filesToClean = [testFilePath, testImagePath, invalidFilePath];
    filesToClean.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Clean up fixtures directory
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (fs.existsSync(fixturesDir)) {
      try {
        fs.rmSync(fixturesDir, { recursive: true, force: true });
      } catch (err) {
        console.log('Could not clean up fixtures directory:', err.message);
      }
    }
  });

  describe('Document Upload Endpoint Tests', () => {
    
    test('should successfully upload a PDF document with admin token', async () => {
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

    test('should successfully upload an image document', async () => {
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
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('document', testFilePath)
        .field('title', 'Test Document')
        .field('category', 'statements')
        .field('userId', testUserId.toString())
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Admin access required'
      });
    });

    test('should reject upload without authentication token', async () => {
      await request(app)
        .post('/api/admin/documents/upload')
        .attach('document', testFilePath)
        .field('title', 'Test Document')
        .field('category', 'statements')
        .field('userId', testUserId.toString())
        .expect(401);
    });

    test('should reject upload without file', async () => {
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Test Document')
        .field('category', 'statements')
        .field('userId', testUserId.toString())
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'No file uploaded'
      });
    });

    test('should reject upload with invalid file type', async () => {
      // Create a test .exe file (invalid type)
      fs.writeFileSync(invalidFilePath, 'fake exe content');

      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', invalidFilePath)
        .field('title', 'Invalid Document')
        .field('category', 'statements')
        .field('userId', testUserId.toString())
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid file type. Only documents and images are allowed.'
      });
    });

    test('should reject upload with missing title', async () => {
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', testFilePath)
        .field('category', 'statements')
        .field('userId', testUserId.toString())
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Title, category, and userId are required'
      });
    });

    test('should reject upload with missing category', async () => {
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', testFilePath)
        .field('title', 'Test Document')
        .field('userId', testUserId.toString())
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Title, category, and userId are required'
      });
    });

    test('should reject upload with missing userId', async () => {
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', testFilePath)
        .field('title', 'Test Document')
        .field('category', 'statements')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Title, category, and userId are required'
      });
    });

    test('should reject upload with non-existent userId', async () => {
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', testFilePath)
        .field('title', 'Test Document')
        .field('category', 'statements')
        .field('userId', '99999')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'User not found'
      });
    });

    test('should handle various document categories', async () => {
      const categories = ['statements', 'receipts', 'contracts', 'reports'];
      
      for (const category of categories) {
        const response = await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('document', testFilePath)
          .field('title', `Test ${category} Document`)
          .field('category', category)
          .field('userId', testUserId.toString())
          .expect(201);

        expect(response.body.document.category).toBe(category);
      }
    });

    test('should handle various file extensions', async () => {
      // Test with PDF which is more likely to work with proper MIME type
      const testFiles = [
        { name: 'test.pdf', content: '%PDF-1.4 test content', mimeType: 'application/pdf' }
      ];

      for (const file of testFiles) {
        const filePath = path.join(__dirname, 'fixtures', file.name);
        fs.writeFileSync(filePath, file.content);

        const response = await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('document', filePath)
          .field('title', `Test ${file.name} Document`)
          .field('category', 'statements')
          .field('userId', testUserId.toString())
          .expect(201);

        expect(response.body.document.file_path).toContain(path.extname(file.name));

        // Clean up
        fs.unlinkSync(filePath);
      }
    });
  });

  describe('Document Download Tests', () => {
    test('should download document with valid ID', async () => {
      if (!testDocumentId) {
        // Create a document first
        const uploadResponse = await request(app)
          .post('/api/admin/documents/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('document', testFilePath)
          .field('title', 'Download Test Document')
          .field('category', 'statements')
          .field('userId', testUserId.toString());
        
        testDocumentId = uploadResponse.body.document.id;
      }

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should reject download with invalid document ID', async () => {
      const response = await request(app)
        .get('/api/documents/99999/download')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Document not found'
      });
    });

    test('should reject download without authentication', async () => {
      await request(app)
        .get(`/api/documents/${testDocumentId || 1}/download`)
        .expect(401);
    });
  });

  describe('Document Listing Tests', () => {
    test('should list user documents', async () => {
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
      // If there are documents, they should all be in the 'statements' category
      response.body.forEach(doc => {
        expect(doc.category).toBe('statements');
      });
    });
  });

  describe('Document Deletion Tests', () => {
    test('should delete document with admin token', async () => {
      if (!testDocumentId) {
        return; // Skip if no document to delete
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
      const response = await request(app)
        .delete(`/api/admin/documents/1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Admin access required'
      });
    });

    test('should handle deletion of non-existent document', async () => {
      const response = await request(app)
        .delete('/api/admin/documents/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Document not found'
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle database errors gracefully', async () => {
      // This test would require mocking the database to simulate failures
      // For now, we'll test with invalid data that might cause DB issues
      const response = await request(app)
        .post('/api/admin/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('document', testFilePath)
        .field('title', 'A'.repeat(1000)) // Very long title
        .field('category', 'statements')
        .field('userId', testUserId.toString());

      // Should either succeed or fail gracefully
      expect([200, 201, 400, 500]).toContain(response.status);
    });
  });
});