/**
 * Test Setup File
 * 
 * Runs before each test file to ensure consistent test environment.
 * This includes environment variables, mocks, and common utilities.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'esoteric_loans_test_final';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.USE_S3 = 'false';
process.env.DB_SSL = 'false';

// Suppress console.log during tests unless debugging
if (!process.env.TEST_DEBUG) {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  // Only suppress non-test output
  console.log = (...args) => {
    const message = args.join(' ');
    if (message.includes('✅') || message.includes('❌') || message.includes('🧹') || message.includes('🚀')) {
      originalConsoleLog(...args);
    }
  };
  
  // Keep error output
  console.error = originalConsoleError;
}

// Global test timeout
jest.setTimeout(30000);

// Mock AWS SDK to prevent actual AWS calls during testing
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn()
}));

// Mock nodemailer to prevent actual email sending
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  })
}));

// Mock node-cron to prevent scheduled jobs during testing
jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

// Mock DocuSign SDK
jest.mock('docusign-esign', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    setBasePath: jest.fn(),
    addDefaultHeader: jest.fn(),
    configure: jest.fn(),
    requestJWTUserToken: jest.fn().mockResolvedValue({
      body: {
        access_token: 'test-access-token',
        expires_in: 3600
      }
    })
  })),
  EnvelopesApi: jest.fn().mockImplementation(() => ({
    createEnvelope: jest.fn(),
    getEnvelope: jest.fn(),
    getDocument: jest.fn(),
    listEnvelopes: jest.fn()
  })),
  EnvelopeDefinition: jest.fn(),
  Document: jest.fn(),
  Signer: jest.fn(),
  SignHere: jest.fn(),
  Tabs: jest.fn(),
  Recipients: jest.fn()
}));

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

console.log('🧪 Test setup completed');