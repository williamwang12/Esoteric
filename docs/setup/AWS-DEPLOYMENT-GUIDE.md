# AWS Deployment Guide

This guide walks you through migrating the Esoteric loan management platform from Heroku to AWS.

## Architecture Overview

**AWS Infrastructure:**
- **Frontend**: React app hosted on S3 + CloudFront CDN
- **Backend**: Node.js API on Elastic Beanstalk
- **Database**: PostgreSQL on RDS
- **File Storage**: S3 (for document uploads)

## Prerequisites

1. **AWS CLI**: Install and configure
   ```bash
   brew install awscli
   aws configure
   ```

2. **EB CLI**: Install Elastic Beanstalk CLI
   ```bash
   pip install awsebcli
   ```

3. **PostgreSQL Client**: For database operations
   ```bash
   brew install postgresql
   ```

## Quick Deployment

### 🚀 One-Click Migration
```bash
./scripts/deploy-aws-complete.sh
```

This script will:
1. Create RDS PostgreSQL database
2. Deploy backend to Elastic Beanstalk
3. Deploy frontend to S3 + CloudFront
4. Configure all connections between services

### 📊 Setup Database Schema
After deployment, run:
```bash
./scripts/setup-aws-database.sh
```

## Manual Step-by-Step Deployment

### Step 1: Database Setup

```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
    --db-instance-identifier esoteric-postgres \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password EsotericDB2024! \
    --allocated-storage 20 \
    --storage-type gp2 \
    --db-name esoteric_loans \
    --publicly-accessible \
    --no-multi-az \
    --storage-encrypted
```

### Step 2: Backend Deployment

```bash
cd backend

# Initialize EB application
eb init esoteric-backend --platform node.js --region us-east-1

# Create environment
eb create production --instance-type t3.micro

# Deploy
eb deploy production
```

### Step 3: Frontend Deployment

```bash
cd frontend

# Build the application
npm install
npm run build

# Create S3 bucket
aws s3 mb s3://esoteric-frontend-unique-name

# Configure for static hosting
aws s3 website s3://esoteric-frontend-unique-name \
    --index-document index.html \
    --error-document index.html

# Upload files
aws s3 sync build/ s3://esoteric-frontend-unique-name

# Create CloudFront distribution (see script for full config)
```

## Environment Configuration

### Backend (.env)
```env
PORT=8080
NODE_ENV=production
FRONTEND_URL=https://your-cloudfront-domain.cloudfront.net
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=esoteric_loans
DB_USER=postgres
DB_PASSWORD=EsotericDB2024!
JWT_SECRET=your-production-jwt-secret
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

### Frontend (.env)
```env
REACT_APP_API_URL=https://your-eb-app.region.elasticbeanstalk.com/api
GENERATE_SOURCEMAP=false
```

## Monitoring & Management

### View Logs
```bash
# Backend logs
eb logs production

# RDS logs
aws rds describe-db-log-files --db-instance-identifier esoteric-postgres
```

### Scale Application
```bash
# Scale EB environment
eb scale 2 production  # Scale to 2 instances

# Scale RDS
aws rds modify-db-instance \
    --db-instance-identifier esoteric-postgres \
    --db-instance-class db.t3.small \
    --apply-immediately
```

### Database Operations
```bash
# Connect to database
PGPASSWORD=EsotericDB2024! psql -h your-rds-endpoint -U postgres -d esoteric_loans

# Backup database
pg_dump -h your-rds-endpoint -U postgres esoteric_loans > backup.sql

# Restore database
psql -h your-rds-endpoint -U postgres esoteric_loans < backup.sql
```

## Security Configuration

### RDS Security Group
- Allow inbound PostgreSQL (5432) from EB security group
- Allow inbound PostgreSQL (5432) from your IP for management

### S3 Bucket Policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

## Cost Optimization

**Monthly Estimates (us-east-1):**
- RDS db.t3.micro: ~$12/month
- EB t3.micro: ~$8.5/month
- S3 storage: ~$1-5/month
- CloudFront: ~$1-10/month
- **Total: ~$22-35/month**

**Cost Savings Tips:**
1. Use reserved instances for predictable workloads
2. Enable S3 lifecycle policies
3. Use CloudFront caching effectively
4. Monitor usage with AWS Cost Explorer

## Troubleshooting

### Common Issues

**EB Deployment Fails**
- Check EB logs: `eb logs production`
- Verify package.json has correct start script
- Check environment variables

**Database Connection Issues**
- Verify security group allows connections
- Check RDS instance status
- Validate connection string

**Frontend Not Loading**
- Check S3 bucket policy
- Verify CloudFront distribution status
- Check CORS configuration in backend

**CORS Errors**
- Update backend FRONTEND_URL environment variable
- Redeploy backend after frontend URL change

### Rollback Procedures

```bash
# Rollback EB deployment
eb deploy production --version=previous-version

# Restore database from backup
psql -h your-rds-endpoint -U postgres esoteric_loans < backup.sql

# Rollback frontend
aws s3 sync previous-build/ s3://your-bucket-name --delete
```

## Production Checklist

- [ ] Database security group configured
- [ ] SSL/TLS certificates configured
- [ ] Environment variables set
- [ ] Monitoring and alerts configured
- [ ] Backup strategy implemented
- [ ] Domain name configured (optional)
- [ ] Email service configured
- [ ] File upload to S3 implemented
- [ ] Performance testing completed
- [ ] Security testing completed

## Additional Services

### Custom Domain (Optional)
1. Register domain in Route 53
2. Create SSL certificate in ACM
3. Configure CloudFront with custom domain
4. Update DNS records

### Enhanced Monitoring
```bash
# CloudWatch alarms
aws cloudwatch put-metric-alarm \
    --alarm-name "EB-High-CPU" \
    --alarm-description "EB instance high CPU" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold
```

## Support

For issues or questions:
1. Check AWS CloudWatch logs
2. Review this deployment guide
3. Contact AWS support for infrastructure issues