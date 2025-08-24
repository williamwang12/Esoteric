# Backend Test Suite Documentation

This directory contains comprehensive tests for the Esoteric Enterprises loan management platform backend API.

## Test Structure

### Test Files

1. **`requests.test.js`** - NEW ✨
   - Tests withdrawal request functionality
   - Tests meeting request functionality  
   - Tests admin management of requests
   - Covers validation, security, and edge cases

2. **`security-2fa.test.js`** - NEW ✨
   - Tests 2FA setup and verification
   - Tests session management
   - Tests email verification
   - Tests security headers and input validation
   - Tests rate limiting and error handling

3. **`enhanced-comprehensive.test.js`** - NEW ✨
   - Enhanced version of comprehensive tests
   - Tests all backend functionality with better coverage
   - Includes security, performance, and data integrity tests
   - Tests edge cases and error handling

4. **`comprehensive.test.js`** - EXISTING
   - Original comprehensive test suite
   - Tests authentication, loans, transactions, documents
   - Tests admin functionality

5. **`2fa-comprehensive.test.js`** - EXISTING
   - Original 2FA test suite
   - Tests TOTP setup and verification

6. **`simple-api.test.js`** - EXISTING
   - Basic API endpoint tests
   - Quick smoke tests

### Test Configuration

- **Jest Configuration**: `../jest.config.js`
- **Setup File**: `setup.js` - Global test setup and teardown
- **Test Environment**: Node.js with PostgreSQL test database
- **Test Timeout**: 30 seconds per test
- **Execution**: Sequential (runInBand) to avoid database conflicts

## Running Tests

### Using NPM Scripts

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:requests        # Withdrawal/meeting requests
npm run test:security        # Security and 2FA
npm run test:enhanced        # Enhanced comprehensive
npm run test:comprehensive   # Original comprehensive
npm run test:2fa            # Original 2FA tests
npm run test:simple         # Basic API tests

# Run new test suites only
npm run test:new

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Using Test Runner Script

```bash
# Run all tests with detailed output
npm run test:all
# or
./run-tests.sh

# Run specific suites
./run-tests.sh requests     # Just request tests
./run-tests.sh security     # Just security tests
./run-tests.sh enhanced     # Just enhanced tests
./run-tests.sh existing     # Just existing tests
./run-tests.sh new          # Just new tests
./run-tests.sh quick        # Quick test run
./run-tests.sh coverage     # With coverage report

# Help
./run-tests.sh help
```

## Test Coverage

### New Functionality Tested ✨

#### Withdrawal Requests
- ✅ Create withdrawal requests with validation
- ✅ Balance validation (prevent over-withdrawal)
- ✅ Priority levels (low, normal, high, urgent)
- ✅ Admin approval/rejection workflow
- ✅ Status management and updates
- ✅ User isolation (users can't see others' requests)
- ✅ Pagination and filtering

#### Meeting Requests  
- ✅ Create meeting requests with validation
- ✅ Date/time validation
- ✅ Meeting types (video, phone, in-person)
- ✅ Admin scheduling workflow
- ✅ Status management (pending → scheduled → completed)
- ✅ Meeting link assignment
- ✅ Admin notes and communication

#### Enhanced Security
- ✅ 2FA setup and verification flow
- ✅ TOTP token generation and validation
- ✅ Backup codes functionality
- ✅ Session management and cleanup
- ✅ Email verification workflow
- ✅ Input validation and sanitization
- ✅ Rate limiting protection
- ✅ Error handling without information leakage

### Existing Functionality Tested

#### Authentication & Authorization
- ✅ User registration with validation
- ✅ User login with credential verification
- ✅ JWT token generation and validation
- ✅ Admin privilege checking
- ✅ Session management

#### User Management
- ✅ Profile management and updates
- ✅ Email verification
- ✅ Account verification requests
- ✅ Admin user oversight

#### Loan Management
- ✅ Loan account creation and management
- ✅ Loan analytics and reporting
- ✅ Transaction history
- ✅ Balance calculations
- ✅ Admin loan oversight

#### Document Management
- ✅ Document upload and download
- ✅ Category filtering
- ✅ Admin document access
- ✅ File security

#### System Health
- ✅ Health check endpoints
- ✅ Error handling
- ✅ CORS configuration
- ✅ Database connectivity

## Test Environment Setup

### Prerequisites

1. **PostgreSQL Test Database**
   ```sql
   CREATE DATABASE esoteric_loans_test;
   ```

2. **Environment Variables**
   ```bash
   NODE_ENV=test
   JWT_SECRET=test-jwt-secret
   DB_NAME=esoteric_loans_test
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=5432
   ```

3. **Test Users**
   - `demo@esoteric.com` / `demo123456` (Regular user)
   - `admin@esoteric.com` / `admin123456` (Admin user)

### Database Schema

Tests assume the complete database schema is set up including:
- Users table with 2FA support
- Loan accounts and transactions
- Documents table
- Withdrawal requests table (NEW)
- Meeting requests table (NEW)
- Account verification requests

## Test Data Management

### Isolation
- Each test suite creates its own test data
- Tests use unique identifiers to avoid conflicts
- Database transactions ensure clean state

### Fixtures
- Test files created in `fixtures/` directory
- PDF and image files for document testing
- Automatically cleaned up after tests

### Mocking
- No external API calls mocked (tests run against real backend)
- File system operations use temporary files
- Database uses real test database for integration testing

## Performance Considerations

### Test Execution
- Sequential execution prevents database conflicts
- 30-second timeout per test allows for database operations
- Connection pooling managed by test framework

### Memory Management
- Force exit after tests to clean up connections
- Detect and handle open handles
- Proper cleanup in afterAll hooks

## Security Testing

### Input Validation
- ✅ Malicious input injection attempts
- ✅ XSS prevention testing
- ✅ SQL injection prevention
- ✅ Phone number format validation
- ✅ Email format validation

### Authentication Security
- ✅ Invalid token handling
- ✅ Expired token handling
- ✅ Missing authentication testing
- ✅ Role-based access control
- ✅ 2FA bypass attempts

### Data Protection
- ✅ User data isolation
- ✅ Admin privilege requirements
- ✅ Sensitive data filtering
- ✅ Error message sanitization

## Continuous Integration

### GitHub Actions (Recommended)
```yaml
- name: Run Backend Tests
  run: |
    cd backend
    npm install
    npm run test:coverage
```

### Test Reports
- Jest generates detailed test reports
- Coverage reports show line/branch coverage
- Failed tests include detailed error messages

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running
   - Check test database exists
   - Verify connection credentials

2. **Timeout Errors**
   - Database operations may be slow
   - Increase timeout in jest.config.js if needed
   - Check for hanging connections

3. **Port Conflicts**
   - Tests don't start server on ports
   - Uses supertest for request testing
   - No port conflicts should occur

4. **Test Data Conflicts**
   - Use unique test data per suite
   - Check for hardcoded IDs
   - Ensure proper cleanup

### Debug Mode
```bash
# Run with verbose output
npm test -- --verbose

# Run single test file
npm test tests/requests.test.js

# Run specific test
npm test -- --testNamePattern="withdrawal request"
```

## Contributing

### Adding New Tests

1. Create test file in `/tests` directory
2. Follow existing naming conventions
3. Include comprehensive error cases
4. Add security and validation tests
5. Update this README with new coverage

### Test Structure
```javascript
describe('Feature Name', () => {
  describe('Endpoint Group', () => {
    test('should do specific thing', async () => {
      // Test implementation
    });
  });
});
```

### Best Practices
- Use descriptive test names
- Test both success and failure cases
- Include edge cases and boundary conditions
- Test security implications
- Maintain test data isolation
- Keep tests independent and atomic

## Coverage Goals

- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Function Coverage**: > 95%
- **Statement Coverage**: > 90%

Current coverage can be checked with:
```bash
npm run test:coverage
```

---

For questions or issues with the test suite, please review the test files directly or check the main project documentation.