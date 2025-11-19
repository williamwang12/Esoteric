# Esoteric Backend API

![CI Status](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/Backend%20CI%2FCD%20Pipeline/badge.svg)

This directory contains the Node.js backend API server for the Esoteric loan management platform.

## 🚀 Features

- **RESTful API endpoints** for comprehensive loan management
- **JWT authentication with 2FA** using TOTP (Google Authenticator compatible)
- **Document management** with secure S3 integration
- **Withdrawal request processing** with balance validation
- **Meeting request scheduling** with video conferencing support
- **PostgreSQL database integration** with connection pooling
- **Comprehensive security** with rate limiting and input validation

## 🧪 Testing & CI/CD

### Test Coverage: 101 Tests ✅
- **Priority 1 Endpoints**: Documents, Withdrawal Requests, Meeting Requests (101 tests)
- **2FA Authentication**: Complete TOTP flow testing
- **Security Testing**: SQL injection protection, authorization checks  
- **Performance Testing**: Concurrent operations, large dataset handling

### Automated CI/CD Pipeline
- ✅ **Automated Testing** with PostgreSQL database
- ✅ **Code Quality Checks** with ESLint and security auditing
- ✅ **Build Verification** and artifact generation
- ✅ **Staging Deployment** (auto-deploy on `develop` branch)
- ✅ **Production Deployment** (auto-deploy on `master` branch with approval)

### Run Tests Locally
```bash
# Priority 1 endpoint tests
npm run test:priority1

# 2FA authentication tests  
npm run test:2fa-final

# Full test suite with coverage
npm run test:coverage

# CI configuration test
npm run test:ci
```

## 🔧 Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL with pg pool
- **Authentication**: JWT + Speakeasy (2FA/TOTP)
- **Security**: Bcrypt, Helmet.js, CORS, Rate Limiting
- **File Storage**: AWS S3 with presigned URLs
- **Testing**: Jest + Supertest (101 comprehensive tests)
- **CI/CD**: GitHub Actions with automated deployment

## 🏁 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- AWS S3 bucket (for document storage)

### Installation
```bash
# Install dependencies
npm install

# Setup environment variables (copy from env.example)
cp env.example .env.test

# Create test database
createdb esoteric_loans_test

# Run tests to verify setup
npm run test:priority1

# Start development server
npm run dev
```

### Environment Variables
```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=esoteric_loans
JWT_SECRET=your-secure-jwt-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login with optional 2FA
- `POST /api/2fa/setup` - Initialize 2FA setup
- `POST /api/2fa/verify-setup` - Complete 2FA setup
- `GET /api/2fa/status` - Check 2FA status

### Documents
- `GET /api/documents` - List user documents (with filtering)
- `GET /api/documents/:id/download` - Secure document download

### Withdrawal Requests
- `POST /api/withdrawal-requests` - Create withdrawal request
- `GET /api/withdrawal-requests` - List user's withdrawal requests

### Meeting Requests
- `POST /api/meeting-requests` - Schedule video meeting
- `GET /api/meeting-requests` - List user's meeting requests

## 🔐 Security Features

- **JWT Token Authentication** with configurable expiration
- **2FA/TOTP Support** compatible with Google Authenticator
- **Rate Limiting** on authentication and sensitive endpoints
- **Input Validation** using express-validator
- **SQL Injection Protection** with parameterized queries
- **CORS Configuration** for cross-origin security
- **Security Headers** via Helmet.js middleware

## 🚀 Deployment

The project uses GitHub Actions for automated deployment:

### Staging Environment
```bash
git push origin develop
# Automatically deploys to staging
```

### Production Environment
```bash
git push origin master
# Requires manual approval, then deploys to production
```

## 📊 Performance & Monitoring

- **Database Connection Pooling** for efficient resource usage
- **Optimized SQL Queries** with proper indexing
- **Concurrent Request Handling** tested with 1000+ simultaneous requests
- **Memory Management** with automatic cleanup and garbage collection
- **Test Coverage Reporting** with detailed metrics
- **GitHub Actions Integration** for continuous monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch from `develop`
3. Make your changes with accompanying tests
4. Ensure all tests pass: `npm run test:priority1`
5. Submit a pull request to `develop` branch
6. CI/CD pipeline will automatically verify your changes

## 🆘 Troubleshooting

### Common Issues
- **Database Connection**: Verify PostgreSQL is running and credentials are correct
- **JWT Errors**: Check that JWT_SECRET is properly configured
- **2FA Issues**: Ensure system clock is synchronized for TOTP
- **Test Failures**: Run `npm run test:priority1` to isolate issues

### CI/CD Support
- Check **Actions** tab for detailed pipeline logs
- Review **CI_SETUP.md** for configuration help
- Verify **GitHub Secrets** are properly configured

---

Built with ❤️ for secure, scalable loan management platform.
