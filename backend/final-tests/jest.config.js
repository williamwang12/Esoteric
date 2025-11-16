/**
 * Jest Configuration for Final Test Suite
 * 
 * This configuration is specifically designed for comprehensive testing
 * of the Esoteric backend application with database isolation and
 * proper test environment setup.
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test directory and file patterns
  testMatch: [
    '<rootDir>/final-tests/**/*.test.js'
  ],
  
  // Setup files to run before tests
  setupFilesAfterEnv: [
    '<rootDir>/final-tests/setup.js'
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/final-tests/helpers/global-setup.js',
  globalTeardown: '<rootDir>/final-tests/helpers/global-teardown.js',
  
  // Test timeout (30 seconds for database operations)
  testTimeout: 30000,
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/final-tests/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'server-2fa.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'services/**/*.js',
    '!node_modules/**',
    '!final-tests/**',
    '!tests/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Module path mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@tests/(.*)$': '<rootDir>/final-tests/$1'
  },
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Detect open handles for database connections
  detectOpenHandles: true,
  forceExit: true,
  
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  
  // Verbose output
  verbose: true,
  
  // Transform configuration
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/'
  ],
  
  // Mock modules that shouldn't be tested directly
  moduleNameMapping: {
    '^aws-sdk$': '<rootDir>/final-tests/mocks/aws-sdk.js',
    '^nodemailer$': '<rootDir>/final-tests/mocks/nodemailer.js'
  },
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/final-tests/test-results',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};