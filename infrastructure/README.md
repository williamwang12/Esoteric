# Esoteric AWS CDK Infrastructure

This directory contains the AWS CDK infrastructure code for the Esoteric loan management platform. The infrastructure is designed to be production-ready, secure, and cost-optimized with support for both staging and production environments.

## Architecture Overview

### Components

- **VPC**: Multi-AZ VPC with public, private, and database subnets
- **RDS PostgreSQL**: Managed database with automated backups and monitoring
- **ECS Fargate**: Containerized backend service with auto-scaling
- **Application Load Balancer**: SSL/TLS termination and traffic distribution
- **S3 + CloudFront**: Static frontend hosting with global CDN
- **ECR**: Container image registry
- **Secrets Manager**: Secure storage for environment variables and API keys
- **CloudWatch**: Logging, monitoring, and alerting
- **IAM**: Least-privilege security roles and policies

### Security Features

- VPC with isolated subnets for database
- Security groups with minimal required access
- Secrets Manager for sensitive configuration
- ECR image scanning enabled
- Non-root container execution
- SSL/TLS encryption in transit
- RDS encryption at rest

### Cost Optimization

- Environment-specific resource sizing
- Spot instances for staging (optional)
- S3 lifecycle policies
- CloudWatch log retention policies
- NAT gateway optimization for staging

## Prerequisites

1. **AWS CLI**: Install and configure with appropriate permissions
   ```bash
   aws configure
   ```

2. **Node.js**: Version 18 or later
   ```bash
   node --version
   npm --version
   ```

3. **AWS CDK**: Install globally
   ```bash
   npm install -g aws-cdk
   ```

4. **Docker**: For building container images
   ```bash
   docker --version
   ```

5. **PostgreSQL Client**: For database operations
   ```bash
   psql --version
   ```

6. **jq**: For JSON processing in scripts
   ```bash
   jq --version
   ```

## Quick Start

### 1. Install Dependencies

```bash
cd infrastructure
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
cdk bootstrap
```

### 3. Deploy Infrastructure

#### Staging Environment
```bash
./scripts/deploy.sh staging
```

#### Production Environment
```bash
./scripts/deploy.sh production
```

### 4. Configure Secrets

After deployment, configure your API keys and environment variables:

```bash
./scripts/setup-secrets.sh staging
```

### 5. Migrate Database

If migrating from Docker to RDS:

```bash
./scripts/migrate-database.sh staging --from-docker
```

### 6. Build and Deploy Application

```bash
./scripts/build-and-push.sh staging
```

## Detailed Deployment Guide

### Environment Configuration

The infrastructure supports two environments with different configurations:

#### Staging
- Cost-optimized for development and testing
- Single-AZ RDS instance
- Minimal container resources
- Short log retention
- No NAT gateway (uses NAT instances)

#### Production
- High availability and performance
- Multi-AZ RDS with backups
- Scaled container resources
- Extended log retention
- Full NAT gateway setup

### Infrastructure Deployment

1. **Review Configuration**
   
   Edit `config/config.ts` to customize settings for your environments:
   ```typescript
   // Update domain names, resource sizes, etc.
   domainName: 'your-domain.com',
   subdomain: 'app',
   ```

2. **Deploy Stack**
   
   ```bash
   # Deploy to staging
   npm run deploy:staging
   
   # Deploy to production
   npm run deploy:production
   ```

3. **Verify Deployment**
   
   Check the CloudFormation console and CDK outputs for resource details.

### Application Deployment

1. **Build Container Images**
   
   ```bash
   ./scripts/build-and-push.sh staging
   ```
   
   This script:
   - Builds optimized Docker images
   - Pushes to ECR
   - Builds frontend static files
   - Deploys frontend to S3
   - Invalidates CloudFront cache
   - Updates ECS service

2. **Configure Environment Variables**
   
   ```bash
   ./scripts/setup-secrets.sh staging
   ```
   
   Update the following secrets:
   - JWT_SECRET: Random string for token signing
   - CALENDLY_API_TOKEN: Your Calendly API token
   - CALENDLY_USER_URI: Your Calendly user URI
   - DOCUSIGN_* variables: DocuSign integration credentials

3. **Migrate Database**
   
   For first deployment or when migrating from Docker:
   
   ```bash
   ./scripts/migrate-database.sh staging --from-docker
   ```

### Database Migration

The migration script handles:
- Schema creation from `database/fresh-schema.sql`
- Running migrations from `database/migrations/`
- Optionally importing data from local Docker database
- Verification of successful migration

### Custom Domain Setup

1. **Certificate Manager**
   
   Request an SSL certificate in the us-east-1 region (required for CloudFront):
   ```bash
   aws acm request-certificate \
     --domain-name your-domain.com \
     --subject-alternative-names "*.your-domain.com" \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Update Configuration**
   
   Add the certificate ARN to your config:
   ```typescript
   certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
   domainName: 'your-domain.com',
   ```

3. **Deploy with Domain**
   
   Redeploy the stack to apply domain configuration:
   ```bash
   ./scripts/deploy.sh production
   ```

4. **DNS Configuration**
   
   Update your DNS records to point to the CloudFront distribution.

## Monitoring and Maintenance

### CloudWatch Logs

Access application logs:
```bash
# Backend logs
aws logs tail /ecs/esoteric-backend --follow

# View log groups
aws logs describe-log-groups --log-group-name-prefix "/ecs/esoteric"
```

### ECS Service Management

```bash
# Check service status
aws ecs describe-services --cluster esoteric-cluster --services esoteric-backend

# Scale service
aws ecs update-service --cluster esoteric-cluster --service esoteric-backend --desired-count 3

# Force deployment
aws ecs update-service --cluster esoteric-cluster --service esoteric-backend --force-new-deployment
```

### Database Management

```bash
# Connect to RDS
aws secretsmanager get-secret-value --secret-id esoteric-db-credentials-staging --query SecretString --output text | jq -r '.password' | \
psql -h <rds-endpoint> -U postgres -d esoteric_loans

# Create backup
pg_dump -h <rds-endpoint> -U postgres -d esoteric_loans > backup.sql
```

### Security Updates

1. **Update Dependencies**
   ```bash
   npm audit
   npm update
   ```

2. **Update Container Images**
   ```bash
   # Update base images and rebuild
   ./scripts/build-and-push.sh staging
   ```

3. **Rotate Secrets**
   ```bash
   # Update secrets in Secrets Manager
   ./scripts/setup-secrets.sh staging
   ```

## Troubleshooting

### Common Issues

1. **ECS Service Won't Start**
   - Check CloudWatch logs for container errors
   - Verify security group rules
   - Ensure secrets are properly configured

2. **Database Connection Issues**
   - Check security group rules between ECS and RDS
   - Verify VPC configuration
   - Test connection from ECS task

3. **Frontend Not Loading**
   - Check S3 bucket permissions
   - Verify CloudFront distribution status
   - Check CORS configuration

4. **SSL Certificate Issues**
   - Ensure certificate is in us-east-1 region
   - Verify domain validation
   - Check DNS configuration

### Debugging Commands

```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name EsotericStack-staging

# ECS task debugging
aws ecs describe-tasks --cluster esoteric-cluster --tasks <task-arn>

# CloudWatch insights queries
aws logs start-query --log-group-name "/ecs/esoteric-backend" --start-time $(date -d "1 hour ago" +%s) --end-time $(date +%s) --query-string "fields @timestamp, @message | filter @message like /ERROR/"
```

### Performance Optimization

1. **Database Performance**
   - Monitor RDS Performance Insights
   - Optimize queries and indexes
   - Consider read replicas for production

2. **Application Performance**
   - Monitor ECS metrics
   - Adjust CPU/memory allocation
   - Implement application-level caching

3. **Frontend Performance**
   - Optimize CloudFront cache settings
   - Implement asset optimization
   - Monitor Core Web Vitals

## Cost Management

### Cost Optimization Tips

1. **Staging Environment**
   - Use smaller instance types
   - Enable Spot instances where possible
   - Implement auto-shutdown for non-business hours

2. **Production Environment**
   - Right-size instances based on metrics
   - Use Reserved Instances for predictable workloads
   - Implement lifecycle policies for logs and backups

3. **Monitoring Costs**
   - Set up billing alerts
   - Use AWS Cost Explorer
   - Tag resources for cost allocation

### Cleanup

To destroy the infrastructure (⚠️ **DANGEROUS** - will delete all data):

```bash
cdk destroy EsotericStack-staging
```

## Support and Contributing

For issues or questions:
1. Check the troubleshooting section above
2. Review CloudWatch logs
3. Check AWS service status
4. Contact the development team

When contributing:
1. Test changes in staging first
2. Follow security best practices
3. Update documentation
4. Review cost implications