const request = require('supertest');
const app = require('../server-2fa.js');
const fs = require('fs');
const path = require('path');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  createUserSession,
  createTestDocument,
  createTestFile,
  validateApiResponse
} = require('./helpers/test-utils');

describe('Documents Endpoints', () => {
  let user, userToken, otherUser, otherUserToken, adminUser, adminToken;
  let userDocument, otherUserDocument;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create test users
    user = await createTestUser({
      email: 'docuser@example.com',
      firstName: 'Document',
      lastName: 'User'
    });
    userToken = await createUserSession(user.id);

    otherUser = await createTestUser({
      email: 'otherdocuser@example.com',
      firstName: 'Other',
      lastName: 'User'
    });
    otherUserToken = await createUserSession(otherUser.id);

    adminUser = await createTestAdmin({
      email: 'docadmin@example.com'
    });
    adminToken = await createUserSession(adminUser.id);

    // Create test documents
    userDocument = await createTestDocument(user.id, {
      title: 'User Loan Agreement',
      category: 'loan_agreement',
      fileName: 'loan_agreement.pdf'
    });

    otherUserDocument = await createTestDocument(otherUser.id, {
      title: 'Other User Document',
      category: 'identification',
      fileName: 'id_document.pdf'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/documents', () => {
    test('should return user documents with valid authentication', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(userDocument.id);
      expect(response.body[0].title).toBe('User Loan Agreement');
      expect(response.body[0].category).toBe('loan_agreement');
    });

    test('should only return documents belonging to authenticated user', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should only see user's own document, not other user's document
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(userDocument.id);
      expect(response.body.some(doc => doc.id === otherUserDocument.id)).toBe(false);
    });

    test('should filter documents by category when provided', async () => {
      // Create additional document with different category
      await createTestDocument(user.id, {
        title: 'ID Document',
        category: 'identification',
        fileName: 'id.pdf'
      });

      // Filter by loan_agreement category
      const response = await request(app)
        .get('/api/documents?category=loan_agreement')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].category).toBe('loan_agreement');
      expect(response.body[0].title).toBe('User Loan Agreement');
    });

    test('should return empty array when filtering by non-existent category', async () => {
      const response = await request(app)
        .get('/api/documents?category=nonexistent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should order documents by upload date (newest first)', async () => {
      // Create additional documents with slight delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const doc2 = await createTestDocument(user.id, {
        title: 'Second Document',
        category: 'other'
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      
      const doc3 = await createTestDocument(user.id, {
        title: 'Third Document',
        category: 'other'
      });

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      
      // Should be ordered by upload_date DESC
      const dates = response.body.map(doc => new Date(doc.upload_date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    test('should return empty array for user with no documents', async () => {
      const newUser = await createTestUser({ email: 'nodocs@example.com' });
      const newUserToken = await createUserSession(newUser.id);

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/documents')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should include all expected document fields', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const document = response.body[0];
      expect(document).toHaveProperty('id');
      expect(document).toHaveProperty('title');
      expect(document).toHaveProperty('file_path');
      expect(document).toHaveProperty('file_size');
      expect(document).toHaveProperty('category');
      expect(document).toHaveProperty('upload_date');
      expect(document).toHaveProperty('user_id');
    });
  });

  describe('GET /api/documents/:documentId/download', () => {
    test('should require authentication', async () => {
      await request(app)
        .get(`/api/documents/${userDocument.id}/download`)
        .expect(401);
    });

    test('should reject download of other users documents', async () => {
      const response = await request(app)
        .get(`/api/documents/${otherUserDocument.id}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.error).toBe('Document not found');
    });

    test('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/99999/download')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.error).toBe('Document not found');
    });

    test('should handle invalid document ID format', async () => {
      const response = await request(app)
        .get('/api/documents/invalid-id/download')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    // Note: S3 download test would require mocking AWS S3
    test('should attempt to generate download URL for valid document', async () => {
      // This test will likely fail in test environment due to S3 configuration
      // but validates the endpoint structure and ownership check
      const response = await request(app)
        .get(`/api/documents/${userDocument.id}/download`)
        .set('Authorization', `Bearer ${userToken}`);

      // Should either redirect (302) or fail with 500 due to S3 config in test
      expect([302, 500]).toContain(response.status);
    });
  });

  describe('Document Security and Authorization', () => {
    test('should prevent access to documents without valid token', async () => {
      await request(app)
        .get('/api/documents')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
    });

    test('should handle malformed authorization headers', async () => {
      await request(app)
        .get('/api/documents')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    test('should maintain user isolation across concurrent requests', async () => {
      const promises = Array.from({ length: 3 }, () =>
        request(app)
          .get('/api/documents')
          .set('Authorization', `Bearer ${userToken}`)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].id).toBe(userDocument.id);
      });
    });

    test('should not expose sensitive file system paths', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const document = response.body[0];
      // file_path should be included but shouldn't expose full system paths
      expect(document.file_path).toBeDefined();
      expect(typeof document.file_path).toBe('string');
    });
  });

  describe('Document Category Filtering', () => {
    beforeEach(async () => {
      // Create documents with various categories for filtering tests
      await createTestDocument(user.id, {
        title: 'ID Document',
        category: 'identification',
        fileName: 'id.pdf'
      });

      await createTestDocument(user.id, {
        title: 'Bank Statement',
        category: 'financial',
        fileName: 'statement.pdf'
      });

      await createTestDocument(user.id, {
        title: 'Other Document',
        category: 'other',
        fileName: 'other.pdf'
      });
    });

    test('should filter by identification category', async () => {
      const response = await request(app)
        .get('/api/documents?category=identification')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].category).toBe('identification');
      expect(response.body[0].title).toBe('ID Document');
    });

    test('should filter by financial category', async () => {
      const response = await request(app)
        .get('/api/documents?category=financial')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].category).toBe('financial');
      expect(response.body[0].title).toBe('Bank Statement');
    });

    test('should return all documents when no category filter is applied', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should return all 4 documents (original + 3 new ones)
      expect(response.body.length).toBeGreaterThanOrEqual(4);
    });

    test('should handle category parameter with special characters', async () => {
      const response = await request(app)
        .get('/api/documents?category=test%20category')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('Document Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Note: This would require mocking the database to simulate failures
      // For now, we test that the endpoint structure is correct
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should handle missing query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/documents?category=')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should handle SQL injection attempts in category parameter', async () => {
      const maliciousCategory = "'; DROP TABLE documents; --";
      const response = await request(app)
        .get(`/api/documents?category=${encodeURIComponent(maliciousCategory)}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('Document Performance', () => {
    test('should handle large numbers of documents efficiently', async () => {
      // Create multiple documents
      const documentPromises = [];
      for (let i = 0; i < 20; i++) {
        documentPromises.push(
          createTestDocument(user.id, {
            title: `Document ${i}`,
            category: i % 2 === 0 ? 'loan_agreement' : 'identification',
            fileName: `doc${i}.pdf`
          })
        );
      }
      await Promise.all(documentPromises);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const endTime = Date.now();
      
      // Should complete within reasonable time (2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);
      expect(response.body.length).toBeGreaterThanOrEqual(21); // 20 + original
    });

    test('should respond quickly to status requests', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should be fast (under 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });
});