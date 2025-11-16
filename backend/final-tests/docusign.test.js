/**
 * DocuSign Integration Tests
 * 
 * Comprehensive tests for DocuSign API integration including:
 * - Envelope creation and management
 * - Document signing workflows
 * - Status tracking and updates
 * - Embedded signing URLs
 * - Webhook handling
 * - API error handling and authentication
 */

const request = require('supertest');
const nock = require('nock');
const crypto = require('crypto');

// Import test utilities
const {
  pool,
  cleanDatabase,
  createTestUser,
  createTestAdmin,
  createUserSession,
  createTestLoan,
  createTestDocument,
  validateApiResponse
} = require('./helpers/test-utils');

// Import server
// CRITICAL: Set test database environment BEFORE loading server
process.env.DB_NAME = 'esoteric_loans_test';

const app = require('../server-2fa');

// Mock DocuSign API responses
const mockDocuSignAPI = () => {
  const docuSignBaseURL = 'https://demo.docusign.net/restapi/v2.1';

  // Mock envelope creation response
  const mockEnvelopeResponse = {
    envelopeId: 'envelope-123-456',
    status: 'sent',
    statusDateTime: '2024-01-15T10:30:00.000Z',
    uri: '/envelopes/envelope-123-456'
  };

  // Mock envelope status response
  const mockEnvelopeStatus = {
    envelopeId: 'envelope-123-456',
    status: 'completed',
    statusDateTime: '2024-01-15T14:30:00.000Z',
    emailSubject: 'Please DocuSign: Loan Agreement',
    documentsUri: '/envelopes/envelope-123-456/documents',
    recipients: {
      signers: [
        {
          recipientId: '1',
          email: 'signer@example.com',
          name: 'Test Signer',
          status: 'completed',
          signedDateTime: '2024-01-15T14:25:00.000Z'
        }
      ]
    },
    customFields: {
      textCustomFields: [
        {
          name: 'loanId',
          value: '1001',
          required: true
        }
      ]
    }
  };

  // Mock documents list response
  const mockDocuments = {
    envelopeDocuments: [
      {
        documentId: '1',
        name: 'Loan Agreement',
        type: 'content',
        uri: '/envelopes/envelope-123-456/documents/1'
      },
      {
        documentId: 'certificate',
        name: 'Summary',
        type: 'summary',
        uri: '/envelopes/envelope-123-456/documents/certificate'
      }
    ]
  };

  // Mock envelopes list response
  const mockEnvelopesList = {
    envelopes: [
      {
        envelopeId: 'envelope-123-456',
        status: 'completed',
        statusDateTime: '2024-01-15T14:30:00.000Z',
        emailSubject: 'Please DocuSign: Loan Agreement'
      }
    ],
    totalSetSize: '1'
  };

  // Mock embedded signing URL response
  const mockSigningUrl = {
    url: 'https://demo.docusign.net/signing/envelope-123-456'
  };

  // Setup nock interceptors
  nock(docuSignBaseURL)
    .persist()
    .post('/accounts/account_id/envelopes')
    .reply(201, mockEnvelopeResponse)
    .get('/accounts/account_id/envelopes/envelope-123-456')
    .reply(200, mockEnvelopeStatus)
    .get('/accounts/account_id/envelopes/envelope-123-456/documents')
    .reply(200, mockDocuments)
    .get('/accounts/account_id/envelopes/envelope-123-456/documents/1')
    .reply(200, Buffer.from('Mock PDF content'))
    .get('/accounts/account_id/envelopes')
    .query(true)
    .reply(200, mockEnvelopesList)
    .post('/accounts/account_id/envelopes/envelope-123-456/views/recipient')
    .reply(201, mockSigningUrl)
    .put('/accounts/account_id/envelopes/envelope-123-456')
    .reply(200, { envelopeId: 'envelope-123-456' });

  return {
    mockEnvelopeResponse,
    mockEnvelopeStatus,
    mockDocuments,
    mockEnvelopesList,
    mockSigningUrl
  };
};

describe('DocuSign Integration Endpoints', () => {
  let user, userToken, adminUser, adminToken;
  let testLoan, testDocument;
  let mocks;

  beforeEach(async () => {
    await cleanDatabase();
    
    // Create test users
    user = await createTestUser({
      email: 'docusignuser@example.com',
      firstName: 'DocuSign',
      lastName: 'User'
    });
    userToken = await createUserSession(user.id);

    adminUser = await createTestAdmin({
      email: 'admin@example.com'
    });
    adminToken = await createUserSession(adminUser.id);

    // Create test loan and document
    testLoan = await createTestLoan(user.id, {
      accountNumber: 'DOCUSIGN-001'
    });

    testDocument = await createTestDocument(user.id, {
      title: 'Loan Agreement',
      category: 'loan_agreement'
    });

    // Setup DocuSign API mocks
    mocks = mockDocuSignAPI();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/docusign/create-envelope', () => {
    test('should create DocuSign envelope with valid data', async () => {
      const envelopeData = {
        emailSubject: 'Please sign your loan agreement',
        signers: [
          {
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            recipientId: '1'
          }
        ],
        documents: [
          {
            documentId: '1',
            name: 'Loan Agreement',
            fileExtension: 'pdf',
            documentBase64: Buffer.from('Mock PDF').toString('base64')
          }
        ],
        customFields: {
          loanId: testLoan.id.toString(),
          userId: user.id.toString()
        }
      };

      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(envelopeData)
        .expect(201);

      validateApiResponse(response, ['envelopeId', 'status']);
      
      expect(response.body.envelopeId).toBe(mocks.mockEnvelopeResponse.envelopeId);
      expect(response.body.status).toBe('sent');
    });

    test('should validate required envelope fields', async () => {
      const incompleteData = {
        emailSubject: 'Test subject'
        // Missing signers and documents
      };

      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('should validate signer email format', async () => {
      const invalidSignerData = {
        emailSubject: 'Test subject',
        signers: [
          {
            email: 'invalid-email',
            name: 'Test Signer',
            recipientId: '1'
          }
        ],
        documents: [
          {
            documentId: '1',
            name: 'Test Doc',
            fileExtension: 'pdf',
            documentBase64: Buffer.from('test').toString('base64')
          }
        ]
      };

      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidSignerData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate document base64 format', async () => {
      const invalidDocData = {
        emailSubject: 'Test subject',
        signers: [
          {
            email: user.email,
            name: user.first_name,
            recipientId: '1'
          }
        ],
        documents: [
          {
            documentId: '1',
            name: 'Test Doc',
            fileExtension: 'pdf',
            documentBase64: 'not-valid-base64!!!'
          }
        ]
      };

      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidDocData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .send({
          emailSubject: 'Test',
          signers: [],
          documents: []
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle DocuSign API errors', async () => {
      nock.cleanAll();
      nock('https://demo.docusign.net/restapi/v2.1')
        .post('/accounts/account_id/envelopes')
        .reply(400, { 
          errorCode: 'INVALID_REQUEST_PARAMETER',
          message: 'Invalid parameter value'
        });

      const validData = {
        emailSubject: 'Test subject',
        signers: [
          {
            email: user.email,
            name: user.first_name,
            recipientId: '1'
          }
        ],
        documents: [
          {
            documentId: '1',
            name: 'Test Doc',
            fileExtension: 'pdf',
            documentBase64: Buffer.from('test').toString('base64')
          }
        ]
      };

      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/docusign/i);
    });
  });

  describe('GET /api/docusign/envelope/:envelopeId/status', () => {
    test('should retrieve envelope status', async () => {
      const envelopeId = 'envelope-123-456';
      
      const response = await request(app)
        .get(`/api/docusign/envelope/${envelopeId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['envelopeId', 'status']);
      
      expect(response.body.envelopeId).toBe(envelopeId);
      expect(response.body.status).toBe('completed');
      expect(response.body).toHaveProperty('statusDateTime');
      expect(response.body).toHaveProperty('recipients');
    });

    test('should validate envelope ID format', async () => {
      const invalidIds = ['', 'invalid-id', 'too-short', '123'];

      for (const id of invalidIds) {
        const response = await request(app)
          .get(`/api/docusign/envelope/${id}/status`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should return 404 for non-existent envelope', async () => {
      nock.cleanAll();
      nock('https://demo.docusign.net/restapi/v2.1')
        .get('/accounts/account_id/envelopes/nonexistent')
        .reply(404, { message: 'Envelope not found' });

      const response = await request(app)
        .get('/api/docusign/envelope/nonexistent/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/docusign/envelope/envelope-123-456/status')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/docusign/envelope/:envelopeId/documents/:documentId', () => {
    test('should download envelope document', async () => {
      const envelopeId = 'envelope-123-456';
      const documentId = '1';
      
      const response = await request(app)
        .get(`/api/docusign/envelope/${envelopeId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should download certificate document', async () => {
      const response = await request(app)
        .get('/api/docusign/envelope/envelope-123-456/documents/certificate')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should validate document ID', async () => {
      const invalidDocIds = ['', '../../../etc/passwd', '<script>', 'null'];

      for (const docId of invalidDocIds) {
        const response = await request(app)
          .get(`/api/docusign/envelope/envelope-123-456/documents/${docId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/docusign/envelope/envelope-123-456/documents/1')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/docusign/envelopes', () => {
    test('should retrieve user envelopes', async () => {
      const response = await request(app)
        .get('/api/docusign/envelopes')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['envelopes']);
      
      expect(Array.isArray(response.body.envelopes)).toBe(true);
      expect(response.body.envelopes).toHaveLength(1);
      
      const envelope = response.body.envelopes[0];
      expect(envelope).toHaveProperty('envelopeId');
      expect(envelope).toHaveProperty('status');
      expect(envelope).toHaveProperty('emailSubject');
    });

    test('should support status filtering', async () => {
      const response = await request(app)
        .get('/api/docusign/envelopes?status=completed')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('envelopes');
    });

    test('should support date filtering', async () => {
      const fromDate = '2024-01-01';
      const toDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/api/docusign/envelopes?from_date=${fromDate}&to_date=${toDate}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('envelopes');
    });

    test('should validate date format', async () => {
      const response = await request(app)
        .get('/api/docusign/envelopes?from_date=invalid-date')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/docusign/envelopes')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/docusign/create-embedded-envelope', () => {
    test('should create embedded signing envelope', async () => {
      const embeddedData = {
        emailSubject: 'Please sign embedded',
        signerEmail: user.email,
        signerName: `${user.first_name} ${user.last_name}`,
        documents: [
          {
            documentId: '1',
            name: 'Embedded Doc',
            fileExtension: 'pdf',
            documentBase64: Buffer.from('Mock PDF').toString('base64')
          }
        ],
        returnUrl: 'https://example.com/return',
        customFields: {
          loanId: testLoan.id.toString()
        }
      };

      const response = await request(app)
        .post('/api/docusign/create-embedded-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(embeddedData)
        .expect(201);

      validateApiResponse(response, ['envelopeId', 'signingUrl']);
      
      expect(response.body.envelopeId).toBe(mocks.mockEnvelopeResponse.envelopeId);
      expect(response.body.signingUrl).toContain('docusign.net');
    });

    test('should validate return URL', async () => {
      const invalidData = {
        emailSubject: 'Test',
        signerEmail: user.email,
        signerName: user.first_name,
        documents: [{
          documentId: '1',
          name: 'Test',
          fileExtension: 'pdf',
          documentBase64: Buffer.from('test').toString('base64')
        }],
        returnUrl: 'not-a-valid-url'
      };

      const response = await request(app)
        .post('/api/docusign/create-embedded-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require return URL', async () => {
      const incompleteData = {
        emailSubject: 'Test',
        signerEmail: user.email,
        signerName: user.first_name,
        documents: [{
          documentId: '1',
          name: 'Test',
          fileExtension: 'pdf',
          documentBase64: Buffer.from('test').toString('base64')
        }]
        // Missing returnUrl
      };

      const response = await request(app)
        .post('/api/docusign/create-embedded-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/docusign/get-signing-url/:envelopeId', () => {
    test('should retrieve signing URL for envelope', async () => {
      const signingData = {
        signerEmail: user.email,
        signerName: `${user.first_name} ${user.last_name}`,
        returnUrl: 'https://example.com/return'
      };

      const response = await request(app)
        .post('/api/docusign/get-signing-url/envelope-123-456')
        .set('Authorization', `Bearer ${userToken}`)
        .send(signingData)
        .expect(200);

      validateApiResponse(response, ['signingUrl']);
      
      expect(response.body.signingUrl).toBe(mocks.mockSigningUrl.url);
    });

    test('should validate signer information', async () => {
      const invalidData = {
        signerEmail: 'invalid-email',
        signerName: '',
        returnUrl: 'https://example.com/return'
      };

      const response = await request(app)
        .post('/api/docusign/get-signing-url/envelope-123-456')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require all signing parameters', async () => {
      const response = await request(app)
        .post('/api/docusign/get-signing-url/envelope-123-456')
        .set('Authorization', `Bearer ${userToken}`)
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/docusign/update-status/:envelopeId', () => {
    test('should update envelope status', async () => {
      const statusUpdate = {
        status: 'voided',
        voidedReason: 'Document error'
      };

      const response = await request(app)
        .post('/api/docusign/update-status/envelope-123-456')
        .set('Authorization', `Bearer ${userToken}`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/updated/i);
    });

    test('should validate status values', async () => {
      const invalidStatus = {
        status: 'invalid-status'
      };

      const response = await request(app)
        .post('/api/docusign/update-status/envelope-123-456')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidStatus)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should require void reason when voiding', async () => {
      const incompleteVoid = {
        status: 'voided'
        // Missing voidedReason
      };

      const response = await request(app)
        .post('/api/docusign/update-status/envelope-123-456')
        .set('Authorization', `Bearer ${userToken}`)
        .send(incompleteVoid)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/docusign/refresh-statuses', () => {
    test('should refresh all envelope statuses', async () => {
      const response = await request(app)
        .post('/api/docusign/refresh-statuses')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      validateApiResponse(response, ['message', 'refreshed']);
      
      expect(response.body.message).toMatch(/refreshed/i);
      expect(typeof response.body.refreshed).toBe('number');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/docusign/refresh-statuses')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle empty envelope list', async () => {
      nock.cleanAll();
      nock('https://demo.docusign.net/restapi/v2.1')
        .get('/accounts/account_id/envelopes')
        .query(true)
        .reply(200, { envelopes: [], totalSetSize: '0' });

      const response = await request(app)
        .post('/api/docusign/refresh-statuses')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.refreshed).toBe(0);
    });
  });

  describe('POST /api/docusign/webhook', () => {
    test('should handle DocuSign webhook', async () => {
      const webhookXML = `
        <?xml version="1.0" encoding="UTF-8"?>
        <DocuSignEnvelopeInformation>
          <EnvelopeStatus>
            <Status>Completed</Status>
            <DateTime>2024-01-15T14:30:00.000Z</DateTime>
            <EnvelopeID>envelope-123-456</EnvelopeID>
            <Subject>Test Document</Subject>
            <RecipientStatuses>
              <RecipientStatus>
                <Type>Signer</Type>
                <Email>signer@example.com</Email>
                <Status>Completed</Status>
                <Signed>2024-01-15T14:25:00.000Z</Signed>
              </RecipientStatus>
            </RecipientStatuses>
          </EnvelopeStatus>
        </DocuSignEnvelopeInformation>
      `;

      const response = await request(app)
        .post('/api/docusign/webhook')
        .set('Content-Type', 'application/xml')
        .send(webhookXML)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/processed/i);
    });

    test('should validate webhook XML format', async () => {
      const invalidXML = 'This is not valid XML';

      const response = await request(app)
        .post('/api/docusign/webhook')
        .set('Content-Type', 'application/xml')
        .send(invalidXML)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle empty webhook payload', async () => {
      const response = await request(app)
        .post('/api/docusign/webhook')
        .set('Content-Type', 'application/xml')
        .send('')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should verify webhook signature if configured', async () => {
      // This test would require webhook signature verification setup
      // For now, we'll test basic functionality
      const simpleXML = `
        <?xml version="1.0" encoding="UTF-8"?>
        <DocuSignEnvelopeInformation>
          <EnvelopeStatus>
            <Status>Sent</Status>
            <EnvelopeID>test-envelope</EnvelopeID>
          </EnvelopeStatus>
        </DocuSignEnvelopeInformation>
      `;

      const response = await request(app)
        .post('/api/docusign/webhook')
        .set('Content-Type', 'application/xml')
        .send(simpleXML)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Error Handling and Security', () => {
    test('should handle DocuSign API rate limiting', async () => {
      nock.cleanAll();
      nock('https://demo.docusign.net/restapi/v2.1')
        .get('/accounts/account_id/envelopes/envelope-123-456')
        .reply(429, { 
          message: 'Too Many Requests',
          'retry-after': '60'
        });

      const response = await request(app)
        .get('/api/docusign/envelope/envelope-123-456/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(429);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle DocuSign service unavailable', async () => {
      nock.cleanAll();
      nock('https://demo.docusign.net/restapi/v2.1')
        .post('/accounts/account_id/envelopes')
        .reply(503, { message: 'Service Unavailable' });

      const envelopeData = {
        emailSubject: 'Test',
        signers: [{
          email: user.email,
          name: user.first_name,
          recipientId: '1'
        }],
        documents: [{
          documentId: '1',
          name: 'Test',
          fileExtension: 'pdf',
          documentBase64: Buffer.from('test').toString('base64')
        }]
      };

      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(envelopeData)
        .expect(503);

      expect(response.body).toHaveProperty('error');
    });

    test('should sanitize user inputs', async () => {
      const maliciousData = {
        emailSubject: '<script>alert("xss")</script>',
        signers: [{
          email: user.email,
          name: '\'; DROP TABLE users; --',
          recipientId: '1'
        }],
        documents: [{
          documentId: '1',
          name: '../../../etc/passwd',
          fileExtension: 'pdf',
          documentBase64: Buffer.from('test').toString('base64')
        }]
      };

      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(maliciousData)
        .expect(400);

      // Should validate and sanitize inputs
      expect(response.body).toHaveProperty('errors');
    });

    test('should validate file size limits', async () => {
      const largeBase64 = Buffer.alloc(25 * 1024 * 1024).toString('base64'); // 25MB

      const largeDocData = {
        emailSubject: 'Large document test',
        signers: [{
          email: user.email,
          name: user.first_name,
          recipientId: '1'
        }],
        documents: [{
          documentId: '1',
          name: 'Large Document',
          fileExtension: 'pdf',
          documentBase64: largeBase64
        }]
      };

      const response = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(largeDocData)
        .expect(413); // Payload too large

      expect(response.body).toHaveProperty('error');
    });

    test('should handle network timeouts', async () => {
      nock.cleanAll();
      nock('https://demo.docusign.net/restapi/v2.1')
        .get('/accounts/account_id/envelopes/envelope-123-456')
        .delayConnection(10000)
        .reply(200, {});

      const response = await request(app)
        .get('/api/docusign/envelope/envelope-123-456/status')
        .set('Authorization', `Bearer ${userToken}`)
        .timeout(5000)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate envelope ID format consistently', async () => {
      const invalidIds = [
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        'null',
        'undefined',
        '',
        'a'.repeat(200) // Too long
      ];

      for (const id of invalidIds) {
        const response = await request(app)
          .get(`/api/docusign/envelope/${id}/status`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should not expose sensitive DocuSign credentials', async () => {
      const response = await request(app)
        .get('/api/docusign/envelope/envelope-123-456/status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should not expose internal credentials
      expect(response.body).not.toHaveProperty('access_token');
      expect(response.body).not.toHaveProperty('refresh_token');
      expect(response.body).not.toHaveProperty('private_key');
    });

    test('should handle corrupted document downloads', async () => {
      nock.cleanAll();
      nock('https://demo.docusign.net/restapi/v2.1')
        .get('/accounts/account_id/envelopes/envelope-123-456/documents/1')
        .reply(200, 'corrupted-pdf-data');

      const response = await request(app)
        .get('/api/docusign/envelope/envelope-123-456/documents/1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should handle gracefully
      expect(response.headers['content-type']).toBeDefined();
    });
  });

  describe('Integration and Workflow Tests', () => {
    test('should complete full signing workflow', async () => {
      // 1. Create envelope
      const envelopeData = {
        emailSubject: 'Integration test document',
        signers: [{
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          recipientId: '1'
        }],
        documents: [{
          documentId: '1',
          name: 'Integration Test Doc',
          fileExtension: 'pdf',
          documentBase64: Buffer.from('Test PDF content').toString('base64')
        }]
      };

      const createResponse = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(envelopeData)
        .expect(201);

      const envelopeId = createResponse.body.envelopeId;

      // 2. Check status
      const statusResponse = await request(app)
        .get(`/api/docusign/envelope/${envelopeId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(statusResponse.body.envelopeId).toBe(envelopeId);

      // 3. Download document
      const downloadResponse = await request(app)
        .get(`/api/docusign/envelope/${envelopeId}/documents/1`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(downloadResponse.headers['content-type']).toContain('application/pdf');
    });

    test('should handle embedded signing workflow', async () => {
      const embeddedData = {
        emailSubject: 'Embedded signing test',
        signerEmail: user.email,
        signerName: `${user.first_name} ${user.last_name}`,
        documents: [{
          documentId: '1',
          name: 'Embedded Test Doc',
          fileExtension: 'pdf',
          documentBase64: Buffer.from('Embedded PDF').toString('base64')
        }],
        returnUrl: 'https://example.com/return'
      };

      const response = await request(app)
        .post('/api/docusign/create-embedded-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(embeddedData)
        .expect(201);

      expect(response.body).toHaveProperty('envelopeId');
      expect(response.body).toHaveProperty('signingUrl');
      expect(response.body.signingUrl).toContain('docusign.net');
    });

    test('should track envelope through webhook updates', async () => {
      // Create envelope first
      const envelopeData = {
        emailSubject: 'Webhook test document',
        signers: [{
          email: user.email,
          name: user.first_name,
          recipientId: '1'
        }],
        documents: [{
          documentId: '1',
          name: 'Webhook Test',
          fileExtension: 'pdf',
          documentBase64: Buffer.from('webhook test').toString('base64')
        }]
      };

      const createResponse = await request(app)
        .post('/api/docusign/create-envelope')
        .set('Authorization', `Bearer ${userToken}`)
        .send(envelopeData)
        .expect(201);

      const envelopeId = createResponse.body.envelopeId;

      // Simulate webhook update
      const webhookXML = `
        <?xml version="1.0" encoding="UTF-8"?>
        <DocuSignEnvelopeInformation>
          <EnvelopeStatus>
            <Status>Completed</Status>
            <DateTime>2024-01-15T14:30:00.000Z</DateTime>
            <EnvelopeID>${envelopeId}</EnvelopeID>
          </EnvelopeStatus>
        </DocuSignEnvelopeInformation>
      `;

      const webhookResponse = await request(app)
        .post('/api/docusign/webhook')
        .set('Content-Type', 'application/xml')
        .send(webhookXML)
        .expect(200);

      expect(webhookResponse.body.message).toMatch(/processed/i);
    });
  });
});