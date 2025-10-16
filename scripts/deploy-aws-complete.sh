#!/bin/bash

# Esoteric Loans - Complete AWS Deployment Script
# This script deploys both frontend and backend to AWS infrastructure using ECS + Fargate

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
ECR_REPOSITORY="esoteric-backend"
CLUSTER_NAME="esoteric-cluster"
SERVICE_NAME="esoteric-service"
TASK_FAMILY="esoteric-backend"
ALB_NAME="esoteric-alb"
DB_IDENTIFIER="esoteric-postgres-east"
DB_PASSWORD="EsotericDB2024!"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"

print_header() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}=================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    # Check if jq is installed (for JSON processing)
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Installing via package manager..."
        if command -v brew &> /dev/null; then
            brew install jq
        elif command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        else
            print_error "Please install jq manually: https://stedolan.github.io/jq/download/"
            exit 1
        fi
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    print_success "All prerequisites met"
}

create_ecr_repository() {
    print_header "Setting up ECR Repository"
    
    # Create ECR repository if it doesn't exist
    if ! aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION &> /dev/null; then
        print_info "Creating ECR repository: $ECR_REPOSITORY"
        aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
        print_success "ECR repository created"
    else
        print_info "ECR repository already exists"
    fi
    
    # Login to ECR
    print_info "Logging in to ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
    print_success "ECR login successful"
}

build_and_push_backend() {
    print_header "Building and Pushing Backend"
    
    cd backend
    
    # Build Docker image for AMD64 (required for Fargate)
    print_info "Building Docker image for linux/amd64..."
    docker buildx build --platform linux/amd64 --load -t $ECR_REPOSITORY:latest .
    
    # Tag for ECR
    docker tag $ECR_REPOSITORY:latest $ECR_URI:latest
    
    # Push to ECR
    print_info "Pushing to ECR..."
    docker push $ECR_URI:latest
    
    cd ..
    print_success "Backend image built and pushed"
}

setup_database() {
    print_header "Setting up RDS Database"
    
    # Check if database exists
    if aws rds describe-db-instances --db-instance-identifier $DB_IDENTIFIER --region $AWS_REGION &> /dev/null; then
        print_info "Database already exists"
        DB_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier $DB_IDENTIFIER --region $AWS_REGION --query 'DBInstances[0].Endpoint.Address' --output text)
    else
        print_info "Creating RDS PostgreSQL database..."
        aws rds create-db-instance \
            --db-instance-identifier $DB_IDENTIFIER \
            --db-instance-class db.t3.micro \
            --engine postgres \
            --engine-version 15.4 \
            --master-username postgres \
            --master-user-password $DB_PASSWORD \
            --allocated-storage 20 \
            --storage-type gp2 \
            --db-name esoteric_loans \
            --publicly-accessible \
            --no-multi-az \
            --storage-encrypted \
            --region $AWS_REGION
        
        print_info "Waiting for database to become available (this may take 5-10 minutes)..."
        aws rds wait db-instance-available --db-instance-identifier $DB_IDENTIFIER --region $AWS_REGION
        
        DB_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier $DB_IDENTIFIER --region $AWS_REGION --query 'DBInstances[0].Endpoint.Address' --output text)
        print_success "Database created: $DB_ENDPOINT"
        
        # Setup database schema
        print_info "Setting up database schema..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U postgres -d esoteric_loans -f database/schema.sql
        
        # Add missing columns for 2FA functionality
        print_info "Adding missing database columns..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U postgres -d esoteric_loans -c "
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS is_2fa_complete BOOLEAN DEFAULT FALSE;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
        "
        
        # Create demo user
        print_info "Creating demo user..."
        HASHED_PASSWORD=$(cd backend && node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('admin123', 12));")
        PGPASSWORD=$DB_PASSWORD psql -h $DB_ENDPOINT -U postgres -d esoteric_loans -c "
            INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, account_verified) 
            VALUES ('demo@esoteric.com', '$HASHED_PASSWORD', 'Demo', 'User', 'admin', true, true)
            ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
        "
        print_success "Demo user created with email: demo@esoteric.com, password: admin123"
    fi
    
    export DB_ENDPOINT
}

setup_ecs_infrastructure() {
    print_header "Setting up ECS Infrastructure"
    
    # Create ECS cluster
    if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION --query 'clusters[0].status' --output text | grep -q ACTIVE; then
        print_info "Creating ECS cluster..."
        aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $AWS_REGION
        print_success "ECS cluster created"
    else
        print_info "ECS cluster already exists"
    fi
    
    # Get VPC info
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --region $AWS_REGION --query 'Vpcs[0].VpcId' --output text)
    
    # ALB Security Group
    ALB_SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=esoteric-alb-sg" --region $AWS_REGION --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")
    if [ "$ALB_SG_ID" = "None" ]; then
        print_info "Creating ALB security group..."
        ALB_SG_ID=$(aws ec2 create-security-group --group-name esoteric-alb-sg --description "Security group for Esoteric ALB" --vpc-id $VPC_ID --region $AWS_REGION --query 'GroupId' --output text)
        aws ec2 authorize-security-group-ingress --group-id $ALB_SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $AWS_REGION
        aws ec2 authorize-security-group-ingress --group-id $ALB_SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0 --region $AWS_REGION
    fi
    
    # ECS Security Group
    ECS_SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=esoteric-ecs-sg" --region $AWS_REGION --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")
    if [ "$ECS_SG_ID" = "None" ]; then
        print_info "Creating ECS security group..."
        ECS_SG_ID=$(aws ec2 create-security-group --group-name esoteric-ecs-sg --description "Security group for Esoteric ECS" --vpc-id $VPC_ID --region $AWS_REGION --query 'GroupId' --output text)
        aws ec2 authorize-security-group-ingress --group-id $ECS_SG_ID --protocol tcp --port 8080 --source-group $ALB_SG_ID --region $AWS_REGION
    fi
    
    # Get subnets
    SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --region $AWS_REGION --query 'Subnets[].SubnetId' --output text | tr '\t' ',')
    
    export ALB_SG_ID ECS_SG_ID SUBNETS VPC_ID
}

create_load_balancer() {
    print_header "Setting up Application Load Balancer"
    
    # Check if ALB exists
    ALB_ARN=$(aws elbv2 describe-load-balancers --names $ALB_NAME --region $AWS_REGION --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || echo "None")
    
    if [ "$ALB_ARN" = "None" ]; then
        print_info "Creating Application Load Balancer..."
        ALB_ARN=$(aws elbv2 create-load-balancer \
            --name $ALB_NAME \
            --subnets $(echo $SUBNETS | tr ',' ' ') \
            --security-groups $ALB_SG_ID \
            --region $AWS_REGION \
            --query 'LoadBalancers[0].LoadBalancerArn' \
            --output text)
        
        # Create target group
        TG_ARN=$(aws elbv2 create-target-group \
            --name esoteric-tg \
            --protocol HTTP \
            --port 8080 \
            --vpc-id $VPC_ID \
            --target-type ip \
            --health-check-path /api/health \
            --health-check-matcher "HttpCode=200,302" \
            --region $AWS_REGION \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text)
        
        # Create listener
        aws elbv2 create-listener \
            --load-balancer-arn $ALB_ARN \
            --protocol HTTP \
            --port 80 \
            --default-actions Type=forward,TargetGroupArn=$TG_ARN \
            --region $AWS_REGION
        
        print_success "Load balancer created"
    else
        print_info "Load balancer already exists"
        TG_ARN=$(aws elbv2 describe-target-groups --names esoteric-tg --region $AWS_REGION --query 'TargetGroups[0].TargetGroupArn' --output text)
    fi
    
    # Get ALB DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --region $AWS_REGION --query 'LoadBalancers[0].DNSName' --output text)
    
    export ALB_ARN TG_ARN ALB_DNS
}

deploy_ecs_service() {
    print_header "Deploying ECS Service"
    
    # Create execution role if it doesn't exist
    ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text 2>/dev/null || echo "None")
    if [ "$ROLE_ARN" = "None" ]; then
        print_info "Creating ECS task execution role..."
        aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "ecs-tasks.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }'
        aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
        sleep 10  # Wait for role to propagate
        ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text)
    fi
    
    # Create CloudWatch log group
    aws logs create-log-group --log-group-name /ecs/esoteric-backend --region $AWS_REGION 2>/dev/null || true
    
    # Create task definition
    TASK_DEF_FILE="/tmp/task-definition-$(date +%s).json"
    cat > $TASK_DEF_FILE << EOF
{
  "family": "$TASK_FAMILY",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "esoteric-backend",
      "image": "$ECR_URI:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "8080"
        },
        {
          "name": "DB_HOST",
          "value": "$DB_ENDPOINT"
        },
        {
          "name": "DB_PORT",
          "value": "5432"
        },
        {
          "name": "DB_NAME",
          "value": "esoteric_loans"
        },
        {
          "name": "DB_USER",
          "value": "postgres"
        },
        {
          "name": "DB_PASSWORD",
          "value": "$DB_PASSWORD"
        },
        {
          "name": "DB_SSL",
          "value": "true"
        },
        {
          "name": "JWT_SECRET",
          "value": "aws_super_secure_jwt_secret_key_production_2024_make_it_very_long_and_random"
        },
        {
          "name": "FRONTEND_URL",
          "value": "PLACEHOLDER_FRONTEND_URL"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/esoteric-backend",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node healthcheck.js"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF
    
    # Register task definition
    print_info "Registering task definition..."
    TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://$TASK_DEF_FILE --region $AWS_REGION --query 'taskDefinition.taskDefinitionArn' --output text)
    
    # Create or update service
    if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
        print_info "Updating existing ECS service..."
        aws ecs update-service \
            --cluster $CLUSTER_NAME \
            --service $SERVICE_NAME \
            --task-definition $TASK_DEF_ARN \
            --region $AWS_REGION
    else
        print_info "Creating ECS service..."
        aws ecs create-service \
            --cluster $CLUSTER_NAME \
            --service-name $SERVICE_NAME \
            --task-definition $TASK_DEF_ARN \
            --desired-count 1 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
            --load-balancers targetGroupArn=$TG_ARN,containerName=esoteric-backend,containerPort=8080 \
            --region $AWS_REGION
    fi
    
    print_success "ECS service deployed"
}

build_and_deploy_frontend() {
    print_header "Building and Deploying Frontend"
    
    cd frontend
    
    # Create unique S3 bucket name
    S3_BUCKET_NAME="esoteric-frontend-$(date +%s)"
    
    # Set environment variables for build
    export REACT_APP_API_URL="http://$ALB_DNS/api"
    export GENERATE_SOURCEMAP=false
    
    # Update .env.local with correct API URL
    echo "REACT_APP_API_URL=http://$ALB_DNS/api" > .env.local
    echo "GENERATE_SOURCEMAP=false" >> .env.local
    
    # Build frontend
    print_info "Building React application..."
    npm run build
    
    # Create S3 bucket for static website hosting
    print_info "Creating S3 bucket: $S3_BUCKET_NAME"
    aws s3 mb s3://$S3_BUCKET_NAME --region $AWS_REGION
    
    # Configure bucket for static website hosting
    aws s3 website s3://$S3_BUCKET_NAME --index-document index.html --error-document index.html
    
    # Set bucket policy for public read access
    cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$S3_BUCKET_NAME/*"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy --bucket $S3_BUCKET_NAME --policy file:///tmp/bucket-policy.json
    
    # Upload build files
    print_info "Uploading build files to S3..."
    aws s3 sync build/ s3://$S3_BUCKET_NAME --delete --region $AWS_REGION
    
    cd ..
    
    # Export for use in other functions
    export S3_BUCKET_NAME
    print_success "Frontend deployed to S3"
}

update_backend_frontend_url() {
    print_header "Updating Backend with Frontend URL"
    
    # Frontend URL
    FRONTEND_URL="http://$S3_BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
    
    # Get current task definition
    CURRENT_TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $AWS_REGION --query 'taskDefinition')
    
    # Create updated task definition with correct frontend URL
    UPDATED_TASK_DEF_FILE="/tmp/updated-task-definition-$(date +%s).json"
    echo "$CURRENT_TASK_DEF" | jq --arg frontend_url "$FRONTEND_URL" '
        .containerDefinitions[0].environment = (.containerDefinitions[0].environment | map(
            if .name == "FRONTEND_URL" then .value = $frontend_url else . end
        )) |
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
    ' > $UPDATED_TASK_DEF_FILE
    
    # Register updated task definition
    print_info "Updating backend with frontend URL..."
    UPDATED_TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://$UPDATED_TASK_DEF_FILE --region $AWS_REGION --query 'taskDefinition.taskDefinitionArn' --output text)
    
    # Update service
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition $UPDATED_TASK_DEF_ARN \
        --region $AWS_REGION
    
    print_success "Backend updated with frontend URL"
}

wait_for_deployment() {
    print_header "Waiting for Deployment to Complete"
    
    print_info "Waiting for ECS service to stabilize..."
    aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION
    
    print_info "Testing backend health..."
    for i in {1..30}; do
        if curl -f "http://$ALB_DNS/api/health" &> /dev/null; then
            print_success "Backend is healthy!"
            break
        fi
        print_info "Attempt $i/30: Backend not ready yet, waiting..."
        sleep 10
    done
}

save_deployment_info() {
    # Save deployment information
    cat > aws-deployment-info.txt << EOF
🎉 AWS Deployment Complete!

🌐 Application URLs:
   Frontend: http://$S3_BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com
   Backend API: http://$ALB_DNS/api

🔐 Test Credentials:
   Email: demo@esoteric.com
   Password: admin123

🏗️ AWS Resources:
   • ECS Cluster: $CLUSTER_NAME
   • ECS Service: $SERVICE_NAME
   • Load Balancer: $ALB_DNS
   • RDS Database: $DB_ENDPOINT
   • S3 Bucket: $S3_BUCKET_NAME
   • ECR Repository: $ECR_URI

💰 Cost Optimization:
   • Database: db.t3.micro (free tier eligible)
   • ECS: 256 CPU, 512 MB memory
   • Load Balancer: Application Load Balancer
   • S3: Standard storage class

🛠️ Management Commands:
   • View logs: aws logs tail /ecs/esoteric-backend --follow --region $AWS_REGION
   • Update service: aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force-new-deployment --region $AWS_REGION
   • Scale service: aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --desired-count <number> --region $AWS_REGION

🧹 Cleanup:
   Run ./scripts/cleanup-aws-resources.sh to delete all resources and avoid charges
EOF
}

display_results() {
    print_header "Deployment Complete!"
    
    FRONTEND_URL="http://$S3_BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
    BACKEND_URL="http://$ALB_DNS/api"
    
    echo ""
    print_success "🌐 Frontend URL: $FRONTEND_URL"
    print_success "🔗 Backend API: $BACKEND_URL"
    echo ""
    print_info "📋 Test Credentials:"
    print_info "   Email: demo@esoteric.com"
    print_info "   Password: admin123"
    echo ""
    print_info "🏗️ AWS Resources Created:"
    print_info "   • ECS Cluster: $CLUSTER_NAME"
    print_info "   • ECS Service: $SERVICE_NAME"
    print_info "   • Load Balancer: $ALB_DNS"
    print_info "   • RDS Database: $DB_ENDPOINT"
    print_info "   • S3 Bucket: $S3_BUCKET_NAME"
    print_info "   • ECR Repository: $ECR_URI"
    echo ""
    print_warning "💰 Remember to clean up AWS resources when done to avoid charges!"
    print_info "   Run: ./scripts/cleanup-aws-resources.sh"
    echo ""
    print_info "📄 Deployment details saved to: aws-deployment-info.txt"
}

# Main execution
main() {
    print_header "Esoteric Loans - AWS Deployment"
    
    # Change to project root directory
    cd "$(dirname "$0")/.."
    
    check_prerequisites
    create_ecr_repository
    build_and_push_backend
    setup_database
    setup_ecs_infrastructure
    create_load_balancer
    deploy_ecs_service
    build_and_deploy_frontend
    update_backend_frontend_url
    wait_for_deployment
    save_deployment_info
    display_results
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Esoteric Loans AWS Deployment Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo "  --clean       Run cleanup script instead"
        echo ""
        echo "This script will deploy your Esoteric Loans application to AWS using:"
        echo "  • ECS Fargate for containerized backend"
        echo "  • Application Load Balancer for traffic routing"
        echo "  • RDS PostgreSQL for database"
        echo "  • S3 for static frontend hosting"
        echo "  • ECR for Docker image storage"
        echo ""
        echo "Prerequisites:"
        echo "  • AWS CLI configured with valid credentials"
        echo "  • Docker installed and running"
        echo "  • Node.js installed"
        echo "  • jq installed for JSON processing"
        exit 0
        ;;
    --clean)
        exec ./scripts/cleanup-aws-resources.sh
        ;;
    *)
        main "$@"
        ;;
esac