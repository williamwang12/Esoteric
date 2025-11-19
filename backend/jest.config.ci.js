module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Test patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/final-tests/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: [
    'server-2fa.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js',
    '!node_modules/**',
    '!coverage/**',
    '!tests/**',
    '!final-tests/**',
    '!migrations/**'
  ],
  
  // Coverage thresholds (adjust based on your requirements)
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  
  // Test timeout for CI (longer than local)
  testTimeout: 30000,
  
  // Detect open handles to prevent hanging tests
  detectOpenHandles: true,
  forceExit: true,
  
  // Maximum number of worker processes
  maxWorkers: 2,
  
  // Verbose output for CI
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Global setup and teardown
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js',
  
  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // Environment variables
  setupFiles: ['<rootDir>/tests/env-setup.js'],
  
  // Test sequencer for consistent test ordering
  testSequencer: '<rootDir>/tests/test-sequencer.js',
  
  // Transform configuration (if needed for ES6 modules)
  transform: {},
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/'
  ],
  
  // CI specific reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],
  
  // Bail after first test suite failure in CI
  bail: false,
  
  // Error on deprecated features
  errorOnDeprecated: true,
  
  // Extensions to find
  moduleFileExtensions: ['js', 'json', 'node'],
  
  // Silent mode for cleaner CI output
  silent: false
};