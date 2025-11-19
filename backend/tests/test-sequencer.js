/**
 * Custom test sequencer for consistent test ordering
 * Ensures tests run in a predictable order to avoid race conditions
 */

const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  /**
   * Sort test files to run in a specific order
   * Priority: unit tests → integration tests → end-to-end tests
   */
  sort(tests) {
    const priorityOrder = [
      // High priority: Unit tests and utilities
      'auth-enhanced.test.js',
      'jwt-token-validation.test.js',
      'user-profile.test.js',
      'loans-basic.test.js',
      
      // Medium priority: Core functionality
      'documents.test.js',
      'withdrawal-requests.test.js',
      'meeting-requests.test.js',
      '2fa.test.js',
      
      // Lower priority: Integration and performance tests
      'robust-api.test.js',
      'api-integration-edge.test.js',
      'security-advanced.test.js',
      'admin-comprehensive.test.js',
      'performance-load.test.js',
      
      // Lowest priority: Complex or resource-intensive tests
      'transaction-import.test.js',
      'excel-upload.test.js',
      'comprehensive.test.js'
    ];

    // Sort tests based on priority order
    return tests.sort((testA, testB) => {
      const testAName = testA.path.split('/').pop();
      const testBName = testB.path.split('/').pop();
      
      const indexA = priorityOrder.indexOf(testAName);
      const indexB = priorityOrder.indexOf(testBName);
      
      // If both tests are in priority list, use priority order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one is in priority list, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // For tests not in priority list, sort alphabetically
      return testAName.localeCompare(testBName);
    });
  }
}

module.exports = CustomSequencer;