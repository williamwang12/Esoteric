# CI/CD Pipeline Documentation

## Overview
This repository uses GitHub Actions for continuous integration and deployment. The pipeline automatically runs tests, performs code quality checks, and deploys to staging/production environments.

## Workflow Structure

### Main Workflow (`ci.yml`)
- **Trigger**: Push to `master`, `main`, or `develop` branches, or PRs to these branches
- **Jobs**:
  1. **Test** - Runs all test suites with PostgreSQL database
  2. **Lint** - Code quality checks and security audits
  3. **Build** - Creates production build artifacts
  4. **Deploy Staging** - Deploys to staging (develop branch only)
  5. **Deploy Production** - Deploys to production (master/main branch only)
  6. **Notify** - Sends build notifications

## Required GitHub Secrets

### Database Configuration
```
DB_HOST=localhost (handled by GitHub Actions service)
DB_PORT=5432 (handled by GitHub Actions service)
DB_USER=postgres (handled by GitHub Actions service)
DB_PASSWORD=postgres (handled by GitHub Actions service)
```

### Application Secrets
Add these to your GitHub repository secrets (Settings → Secrets and variables → Actions):

```
# JWT Secret for token signing
JWT_SECRET=your-production-jwt-secret-key

# AWS Configuration (if using AWS services)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name

# Deployment Secrets (add as needed)
STAGING_SERVER_HOST=your-staging-server
PRODUCTION_SERVER_HOST=your-production-server
DEPLOY_SSH_KEY=your-ssh-private-key

# Notification Webhooks (optional)
SLACK_WEBHOOK_URL=your-slack-webhook-url
DISCORD_WEBHOOK_URL=your-discord-webhook-url
```

### Environment-Specific Secrets
Create environment-specific secrets for staging and production:

**Staging Environment:**
```
STAGING_DB_HOST=your-staging-db-host
STAGING_DB_NAME=your-staging-db-name
STAGING_DB_USER=your-staging-db-user
STAGING_DB_PASSWORD=your-staging-db-password
```

**Production Environment:**
```
PROD_DB_HOST=your-production-db-host
PROD_DB_NAME=your-production-db-name
PROD_DB_USER=your-production-db-user
PROD_DB_PASSWORD=your-production-db-password
```

## Test Configuration

### Test Database Setup
The pipeline automatically:
1. Starts a PostgreSQL service container
2. Creates the test database schema
3. Runs database migrations
4. Executes all test suites

### Test Suites Executed
1. **Priority 1 Tests** - Core endpoint functionality
   - Documents endpoints (`documents.test.js`)
   - Withdrawal requests (`withdrawal-requests.test.js`)
   - Meeting requests (`meeting-requests.test.js`)

2. **Authentication Tests**
   - 2FA functionality (`2fa.test.js`)
   - JWT token validation
   - User authentication flows

3. **Integration Tests**
   - API integration tests
   - Security tests
   - Performance tests

## Local Development

### Running Tests Locally
```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:priority1    # Priority 1 endpoint tests
npm run test:2fa          # 2FA tests only
npm run test:security     # Security tests
npm run test:coverage     # Tests with coverage

# Run tests in CI mode
npm run test:ci
```

### Environment Setup
Create `.env.test` file:
```env
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_USER=your-local-db-user
DB_PASSWORD=your-local-db-password
DB_NAME=esoteric_loans_test
JWT_SECRET=test-secret-key
```

## Deployment

### Staging Deployment
- **Trigger**: Push to `develop` branch
- **Environment**: `staging`
- **Approval**: Automatic
- **Database**: Staging database

### Production Deployment
- **Trigger**: Push to `master`/`main` branch
- **Environment**: `production`
- **Approval**: Manual (recommended)
- **Database**: Production database

### Manual Deployment
You can manually trigger deployments:
1. Go to Actions tab in GitHub
2. Select "Backend CI/CD Pipeline"
3. Click "Run workflow"
4. Choose branch and environment

## Monitoring & Notifications

### Build Status
- ✅ All tests passing
- ❌ Test failures
- ⚠️ Build warnings

### Coverage Reports
- Uploaded as artifacts after each build
- Viewable in Actions → Artifacts
- Minimum coverage thresholds enforced

### Notifications
Configure Slack/Discord webhooks for:
- Build success/failure
- Deployment status
- Test coverage changes
- Security vulnerability alerts

## Troubleshooting

### Common Issues

**Database Connection Errors:**
```
Error: ECONNREFUSED 127.0.0.1:5432
```
*Solution*: Check PostgreSQL service configuration in workflow file

**Test Timeouts:**
```
Timeout - Async callback was not invoked within the 30000ms timeout
```
*Solution*: Increase timeout in Jest configuration or optimize slow tests

**Memory Issues:**
```
JavaScript heap out of memory
```
*Solution*: Reduce maxWorkers or split large test suites

### Debug Mode
Enable debug output by setting:
```yaml
env:
  DEBUG: true
  VERBOSE: true
```

## Security Best Practices

1. **Secrets Management**
   - Never commit secrets to repository
   - Use GitHub encrypted secrets
   - Rotate secrets regularly

2. **Database Security**
   - Use separate test database
   - Clean data between test runs
   - Limit database permissions

3. **Dependency Security**
   - Run `npm audit` in CI
   - Update dependencies regularly
   - Monitor security advisories

## Performance Optimization

1. **Test Parallelization**
   - Use `maxWorkers: 2` for CI
   - Avoid resource-intensive concurrent tests

2. **Caching**
   - Cache `node_modules` between runs
   - Cache test database schema

3. **Artifact Management**
   - Limit artifact retention
   - Compress build outputs

## Contributing

1. All PRs must pass CI checks
2. Maintain test coverage above thresholds
3. Add tests for new functionality
4. Follow existing naming conventions

## Support

For CI/CD issues:
1. Check GitHub Actions logs
2. Review test output
3. Verify environment configuration
4. Contact devops team if needed