# Database Environment Configuration

## Overview

This project uses separate databases for different environments to ensure:

- **Data isolation**: Test data doesn't contaminate production
- **Data safety**: Tests can't accidentally delete production data
- **Reliability**: Tests run consistently regardless of production state

## Environment Structure

### 🔴 Production (Heroku)

- **Database**: Heroku PostgreSQL addon
- **Environment**: `NODE_ENV=production`
- **Access**: Via `DATABASE_URL` environment variable

### 🟡 Development (Local)

- **Database**: `esoteric_loans` (local PostgreSQL)
- **Environment**: `NODE_ENV=development`
- **Config**: Uses `.env` file

### 🟢 Testing (Local)

- **Database**: `esoteric_loans_test` (local PostgreSQL)
- **Environment**: `NODE_ENV=test`
- **Config**: Uses `env.test` file
- **Lifecycle**: Created before tests, destroyed after tests

## Database Names

| Environment | Database Name         |
| ----------- | --------------------- |
| Production  | Heroku PostgreSQL     |
| Development | `esoteric_loans`      |
| Testing     | `esoteric_loans_test` |

## Test Database Lifecycle

1. **Before Tests**:

   - Drop existing test database (if any)
   - Create fresh test database
   - Run schema and migrations
   - Create test users (demo@esoteric.com, admin@esoteric.com)

2. **During Tests**:

   - All test operations use isolated test database
   - Test data doesn't affect other environments

3. **After Tests**:
   - Clean up test database
   - Remove test files

## Environment Variables

### Test Environment (`env.test`)

```bash
NODE_ENV=test
DB_NAME=esoteric_loans_test
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=test_jwt_secret_key_for_testing_environment_only
UPLOAD_PATH=./test-uploads
```

### Development Environment (`.env`)

```bash
NODE_ENV=development
DB_NAME=esoteric_loans
DB_USER=postgres
DB_PASSWORD=your_db_password
JWT_SECRET=your_super_secure_jwt_secret_key_here_make_it_long_and_random
UPLOAD_PATH=./uploads
```

## Running Tests

```bash
# Run all tests with isolated database
npm test

# Run specific test suite
npm run test:simple
npm run test:comprehensive
npm run test:2fa

# Run tests with coverage
npm run test:coverage
```

## Heroku Deployment

For Heroku deployment:

1. **Production Database**: Automatically provided via `DATABASE_URL`
2. **Environment Variables**: Set via Heroku config vars
3. **No Test Database**: Tests run locally only, not on Heroku

## Security Notes

- ✅ Test database is completely isolated
- ✅ Different JWT secrets for each environment
- ✅ Test uploads go to separate directory
- ✅ Production data is never touched by tests
- ✅ Test database is cleaned up after each run

## Troubleshooting

### Test Database Connection Issues

```bash
# Ensure PostgreSQL is running
brew services start postgresql

# Check if test database exists
psql -l | grep esoteric_loans_test

# Manually create test database if needed
createdb esoteric_loans_test
```

### Permission Issues

```bash
# Grant permissions to test user
psql -c "GRANT ALL PRIVILEGES ON DATABASE esoteric_loans_test TO postgres;"
```
