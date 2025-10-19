# 🚀 Esoteric Loans - Deployment Guide

This guide covers the complete deployment process for the Esoteric Loans application, from local development to AWS production.

## 📋 Prerequisites

Before deploying, ensure you have:

- [AWS CLI](https://aws.amazon.com/cli/) installed and configured
- [Docker](https://www.docker.com/get-started) installed and running
- [Node.js](https://nodejs.org/) (v16 or higher) and npm
- [PostgreSQL client](https://www.postgresql.org/download/) for database operations
- AWS credentials with appropriate permissions

## 🎯 Quick Deployment Commands

### Complete Deployment (Frontend + Backend)
```bash
./scripts/deploy-to-aws.sh
```

### Frontend Only
```bash
./scripts/deploy-to-aws.sh --frontend-only
```

### Backend Only
```bash
./scripts/deploy-to-aws.sh --backend-only
```

### Skip Database Migrations
```bash
./scripts/deploy-to-aws.sh --skip-migrations
```

## 🏠 Switch to Local Development
```bash
./scripts/switch-to-local.sh
```

## 📁 Environment Configuration

### AWS Environment
The deployment script automatically configures:

**Backend (.env.aws)**:
- Database: AWS RDS PostgreSQL
- API URL: AWS Application Load Balancer
- SSL: Enabled

**Frontend (.env.aws)**:
- API URL: Points to AWS backend
- Sourcemaps: Disabled for production

### Local Environment
**Backend (.env)**:
- Database: Local PostgreSQL
- API URL: localhost:8080
- SSL: Disabled

**Frontend (.env.local)**:
- API URL: localhost:8080/api
- Development mode enabled

## 🔄 Deployment Process

The deployment script performs the following steps:

1. **Dependency Check**: Verifies all required tools are installed
2. **Environment Setup**: Configures AWS environment variables
3. **Database Migrations**: Runs any pending database schema changes
4. **Backend Deployment**:
   - Builds Docker image
   - Pushes to Amazon ECR
   - Updates ECS task definition
   - Deploys to ECS service
   - Waits for deployment completion
5. **Frontend Deployment**:
   - Installs dependencies (if needed)
   - Builds React application
   - Syncs to S3 bucket
6. **Testing**: Verifies both frontend and backend are working

## 🗄️ Database Migrations

The script automatically handles database schema differences between local and AWS environments. Currently manages:

- `reference_id` column in `loan_transactions` table
- Future schema changes can be added to the migration function

## 🔧 Infrastructure Details

### AWS Resources
- **ECS Cluster**: esoteric-cluster
- **ECS Service**: esoteric-service
- **ECR Repository**: esoteric-backend
- **S3 Bucket**: esoteric-frontend-1760420958
- **Load Balancer**: esoteric-alb
- **RDS Database**: esoteric-postgres-east

### URLs
- **Frontend**: http://esoteric-frontend-1760420958.s3-website-us-east-1.amazonaws.com
- **Backend API**: http://esoteric-alb-67634983.us-east-1.elb.amazonaws.com/api
- **Health Check**: http://esoteric-alb-67634983.us-east-1.elb.amazonaws.com/api/health

## 🔐 Test Account

**Email**: demo@esoteric.com  
**Password**: admin123

## 🛠️ Development Workflow

### 1. Local Development
```bash
# Switch to local environment
./scripts/switch-to-local.sh

# Start backend (in one terminal)
cd backend && npm start

# Start frontend (in another terminal)
cd frontend && npm start
```

### 2. Deploy Changes
```bash
# Complete deployment
./scripts/deploy-to-aws.sh

# Or deploy specific components
./scripts/deploy-to-aws.sh --frontend-only
./scripts/deploy-to-aws.sh --backend-only
```

### 3. Quick Frontend Updates
For quick CSS/content changes:
```bash
./scripts/deploy-to-aws.sh --frontend-only
```

### 4. Backend API Changes
For backend logic updates:
```bash
./scripts/deploy-to-aws.sh --backend-only
```

## 🚨 Troubleshooting

### Common Issues

**Docker Permission Errors**:
```bash
sudo chmod 666 /var/run/docker.sock
```

**AWS CLI Not Configured**:
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region (us-east-1)
```

**Database Connection Issues**:
- Ensure your IP is whitelisted in RDS security group
- Verify database credentials in environment files

**ECS Service Not Updating**:
- Check CloudWatch logs: `/ecs/esoteric-backend`
- Verify task definition was registered correctly
- Ensure ECR image was pushed successfully

### Log Monitoring
```bash
# Backend logs
aws logs tail /ecs/esoteric-backend --region us-east-1 --follow

# ECS service status
aws ecs describe-services --cluster esoteric-cluster --services esoteric-service --region us-east-1
```

## 📈 Performance Tips

- Use `--frontend-only` for quick UI changes (fastest deployment)
- Use `--backend-only` for API changes without rebuilding frontend
- Use `--skip-migrations` if no database changes were made
- Monitor CloudWatch for performance metrics

## 🔄 Rollback Process

If deployment fails:

1. **Frontend Rollback**: Previous S3 version is replaced, no rollback needed
2. **Backend Rollback**: 
   ```bash
   # Get previous task definition
   aws ecs describe-services --cluster esoteric-cluster --services esoteric-service --query 'services[0].deployments'
   
   # Update to previous version
   aws ecs update-service --cluster esoteric-cluster --service esoteric-service --task-definition esoteric-backend:PREVIOUS_VERSION
   ```

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Verify all dependencies are installed and configured
4. Ensure AWS credentials have sufficient permissions