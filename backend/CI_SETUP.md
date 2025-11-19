# GitHub CI/CD Setup Guide

## Quick Setup Checklist

### 1. Install Dependencies
```bash
npm install jest-junit
```

### 2. Configure GitHub Repository Secrets
Go to: **Settings → Secrets and variables → Actions**

**Required Secrets:**
```
JWT_SECRET=your-production-jwt-secret-key
```

**Optional Secrets (for deployment):**
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
SLACK_WEBHOOK_URL=your-slack-webhook
```

### 3. Set Up Environments (Optional)
1. Go to **Settings → Environments**
2. Create `staging` and `production` environments
3. Add environment-specific secrets
4. Configure protection rules (require reviews for production)

### 4. Test the Pipeline

**Push to trigger CI:**
```bash
git add .
git commit -m "Setup CI/CD pipeline"
git push origin master
```

**Or manually trigger:**
1. Go to **Actions** tab
2. Select "Backend CI/CD Pipeline"
3. Click "Run workflow"

## What the Pipeline Does

### ✅ **Test Stage**
- Starts PostgreSQL database service
- Runs all test suites:
  - Priority 1 tests (Documents, Withdrawal Requests, Meeting Requests)
  - 2FA authentication tests
  - Unit tests with coverage reporting

### 🔍 **Lint Stage**  
- ESLint code quality checks
- Security vulnerability scanning with `npm audit`

### 📦 **Build Stage**
- Creates production build artifacts
- Packages application for deployment

### 🚀 **Deploy Stage**
- **Staging**: Auto-deploys on push to `develop` branch
- **Production**: Auto-deploys on push to `master/main` branch (with approval)

## Local Testing

**Test your CI configuration locally:**
```bash
# Run CI test suite
npm run test:ci

# Run Priority 1 tests specifically  
npm run test:priority1

# Run 2FA tests
npm run test:2fa-final

# Run with coverage
npm run test:coverage
```

## Monitoring

### Build Status Badge
Add to your README.md:
```markdown
![CI Status](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/Backend%20CI%2FCD%20Pipeline/badge.svg)
```

### View Results
- **Actions tab**: See all workflow runs
- **Artifacts**: Download coverage reports and build outputs
- **Pull Requests**: See status checks before merging

## Common Issues & Solutions

### Database Connection Issues
**Error**: `ECONNREFUSED 127.0.0.1:5432`
**Fix**: PostgreSQL service is automatically handled by GitHub Actions

### Test Timeouts
**Error**: `Timeout exceeded`
**Fix**: Tests have 30-second timeout, which should be sufficient

### Memory Issues  
**Error**: `JavaScript heap out of memory`
**Fix**: Pipeline uses `maxWorkers=2` to limit resource usage

### Permission Denied
**Error**: `Permission denied`
**Fix**: Ensure secrets are properly configured

## Customization

### Modify Test Execution
Edit `.github/workflows/ci.yml`:
```yaml
- name: Run Priority 1 tests
  run: npm run test:priority1
```

### Add Custom Steps
```yaml
- name: Custom build step
  run: |
    echo "Running custom build..."
    npm run build:custom
```

### Change Branch Triggers
```yaml
on:
  push:
    branches: [ main, develop, feature/* ]
```

## Advanced Features

### Matrix Testing (Multiple Node Versions)
```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x]
```

### Conditional Deployment
```yaml
if: github.ref == 'refs/heads/master'
```

### Slack Notifications
```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Next Steps

1. **Monitor first few runs** to ensure everything works correctly
2. **Add deployment scripts** specific to your infrastructure  
3. **Set up staging environment** for testing before production
4. **Configure notifications** for your team communication channels
5. **Add more comprehensive tests** as your application grows

## Support

- Check **Actions logs** for detailed error information
- Review **test output** for specific test failures
- Verify **environment configuration** matches requirements
- Contact your DevOps team for infrastructure-related issues

---

🎉 **Your CI/CD pipeline is now ready!** Every push will automatically run tests and deploy to the appropriate environment.