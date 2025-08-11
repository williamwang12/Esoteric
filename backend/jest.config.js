module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'server*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    '!node_modules/**',
    '!tests/**',
    '!test*.js'
  ],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1 // Run tests sequentially to avoid database conflicts
};