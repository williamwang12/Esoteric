#!/bin/bash

# 🚀 Complete AWS Deployment Script for Esoteric Loans
# This script handles full deployment of both frontend and backend to AWS

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# AWS Configuration
AWS_REGION="us-east-1"
ECR_REPOSITORY="484069698162.dkr.ecr.us-east-1.amazonaws.com/esoteric-backend"
ECS_CLUSTER="esoteric-cluster"
ECS_SERVICE="esoteric-service"
S3_BUCKET="esoteric-frontend-1760420958"
TASK_FAMILY="esoteric-backend"

# Database Configuration
DB_HOST="esoteric-postgres-east.cg38ykumokco.us-east-1.rds.amazonaws.com"
DB_USER="postgres"
DB_NAME="esoteric_loans"
DB_PASSWORD="EsotericDB2024!"

print_step() {
    echo -e "${BLUE}🚀 $1${NC}"
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

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
check_dependencies() {
    print_step "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command_exists aws; then
        missing_deps+=("aws-cli")
    fi
    
    if ! command_exists docker; then
        missing_deps+=("docker")
    fi
    
    if ! command_exists npm; then
        missing_deps+=("npm/node")
    fi
    
    if ! command_exists psql; then
        missing_deps+=("postgresql-client")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    print_success "All dependencies found"
}

# Switch to AWS environment configuration
setup_aws_environment() {
    print_step "Setting up AWS environment configuration..."
    
    # Backend .env.aws
    cat > backend/.env.aws << EOF
NODE_ENV=development
PORT=8080
DB_HOST=${DB_HOST}
DB_PORT=5432
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_SSL=true
JWT_SECRET=aws_super_secure_jwt_secret_key_production_2024_make_it_very_long_and_random
FRONTEND_URL=http://${S3_BUCKET}.s3-website-us-east-1.amazonaws.com
EOF
    
    # Frontend .env.aws
    cat > frontend/.env.aws << EOF
REACT_APP_API_URL=http://esoteric-alb-67634983.us-east-1.elb.amazonaws.com/api
GENERATE_SOURCEMAP=false
EOF
    
    # Copy AWS configs to active configs
    cp backend/.env.aws backend/.env
    cp frontend/.env.aws frontend/.env.local
    
    print_success "AWS environment configuration set up"
}

# Run database migrations if needed
run_database_migrations() {
    print_step "Checking and running database migrations..."
    
    # Check if reference_id column exists
    COLUMN_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_transactions' AND column_name='reference_id');" | xargs)
    
    if [ "$COLUMN_EXISTS" = "f" ]; then
        print_step "Adding missing reference_id column..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "ALTER TABLE loan_transactions ADD COLUMN reference_id VARCHAR(255);"
        print_success "Added reference_id column"
    else
        print_success "Database schema is up to date"
    fi
}

# Build and deploy backend
deploy_backend() {
    print_step "Building and deploying backend..."
    
    cd backend
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY
    
    # Build Docker image
    print_step "Building Docker image..."
    docker build -t esoteric-backend .
    
    # Tag and push to ECR
    print_step "Tagging and pushing to ECR..."
    docker tag esoteric-backend:latest $ECR_REPOSITORY:latest
    docker push $ECR_REPOSITORY:latest
    
    # Get current task definition
    print_step "Updating ECS task definition..."
    aws ecs describe-task-definition --task-definition $TASK_FAMILY --query 'taskDefinition' > /tmp/current-task-def.json
    
    # Create new task definition with latest image
    cat /tmp/current-task-def.json | jq --arg IMAGE "$ECR_REPOSITORY:latest" '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' > /tmp/new-task-def.json
    
    # Register new task definition
    NEW_TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file:///tmp/new-task-def.json --query 'taskDefinition.taskDefinitionArn' --output text)
    
    # Update ECS service
    print_step "Updating ECS service..."
    aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --task-definition $NEW_TASK_DEF_ARN --region $AWS_REGION
    
    # Wait for deployment to complete
    print_step "Waiting for backend deployment to complete..."
    aws ecs wait services-stable --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION
    
    cd ..
    print_success "Backend deployment completed"
}

# Build and deploy frontend
deploy_frontend() {
    print_step "Building and deploying frontend..."
    
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_step "Installing frontend dependencies..."
        npm install
    fi
    
    # Build the React app
    print_step "Building React application..."
    npm run build
    
    # Deploy to S3
    print_step "Deploying to S3..."
    aws s3 sync build/ s3://$S3_BUCKET --delete
    
    cd ..
    print_success "Frontend deployment completed"
}

# Test the deployment
test_deployment() {
    print_step "Testing deployment..."
    
    # Test backend health
    BACKEND_URL="http://esoteric-alb-67634983.us-east-1.elb.amazonaws.com/api"
    HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/health" || echo "failed")
    
    if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
        print_success "Backend health check passed"
    else
        print_error "Backend health check failed"
        return 1
    fi
    
    # Test frontend
    FRONTEND_URL="http://$S3_BUCKET.s3-website-us-east-1.amazonaws.com"
    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")
    
    if [ "$FRONTEND_RESPONSE" = "200" ]; then
        print_success "Frontend is accessible"
    else
        print_error "Frontend accessibility check failed (HTTP $FRONTEND_RESPONSE)"
        return 1
    fi
    
    print_success "All deployment tests passed!"
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "🚀 Esoteric Loans - Complete AWS Deployment"
    echo "=============================================="
    echo -e "${NC}"
    
    # Get deployment options
    DEPLOY_BACKEND=true
    DEPLOY_FRONTEND=true
    RUN_MIGRATIONS=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --frontend-only)
                DEPLOY_BACKEND=false
                RUN_MIGRATIONS=false
                shift
                ;;
            --backend-only)
                DEPLOY_FRONTEND=false
                shift
                ;;
            --skip-migrations)
                RUN_MIGRATIONS=false
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --frontend-only     Deploy only the frontend"
                echo "  --backend-only      Deploy only the backend"
                echo "  --skip-migrations   Skip database migrations"
                echo "  -h, --help          Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    check_dependencies
    setup_aws_environment
    
    if [ "$RUN_MIGRATIONS" = true ]; then
        run_database_migrations
    fi
    
    if [ "$DEPLOY_BACKEND" = true ]; then
        deploy_backend
    fi
    
    if [ "$DEPLOY_FRONTEND" = true ]; then
        deploy_frontend
    fi
    
    test_deployment
    
    echo -e "${GREEN}"
    echo "🎉 Deployment completed successfully!"
    echo "====================================="
    echo -e "${NC}"
    echo "🌐 Frontend: http://$S3_BUCKET.s3-website-us-east-1.amazonaws.com"
    echo "🔧 Backend:  http://esoteric-alb-67634983.us-east-1.elb.amazonaws.com/api"
    echo "❤️  Health:  http://esoteric-alb-67634983.us-east-1.elb.amazonaws.com/api/health"
    echo ""
    echo "💡 Test Account:"
    echo "   Email: demo@esoteric.com"
    echo "   Password: admin123"
    echo ""
    echo "📋 Quick Commands:"
    echo "   Frontend only: $0 --frontend-only"
    echo "   Backend only:  $0 --backend-only"
    echo "   Skip DB:       $0 --skip-migrations"
}

# Run main function
main "$@"