#!/bin/bash

# Esoteric Loans - AWS Update Script
# This script updates existing AWS deployment with new code changes

set -e

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

update_backend() {
    print_header "Updating Backend"
    
    cd backend
    
    # Login to ECR
    print_info "Logging in to ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
    
    # Build and push new image
    print_info "Building new Docker image..."
    docker buildx build --platform linux/amd64 --load -t $ECR_REPOSITORY:latest .
    docker tag $ECR_REPOSITORY:latest $ECR_URI:latest
    
    print_info "Pushing to ECR..."
    docker push $ECR_URI:latest
    
    cd ..
    
    # Force new deployment
    print_info "Triggering ECS service update..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $AWS_REGION
    
    print_success "Backend update initiated"
}

update_frontend() {
    print_header "Updating Frontend"
    
    cd frontend
    
    # Get ALB DNS for API URL
    ALB_DNS=$(aws elbv2 describe-load-balancers --names esoteric-alb --region $AWS_REGION --query 'LoadBalancers[0].DNSName' --output text)
    
    # Get S3 bucket name from deployment info
    if [ -f "../aws-deployment-info.txt" ]; then
        S3_BUCKET_NAME=$(grep "S3 Bucket:" ../aws-deployment-info.txt | awk '{print $4}')
    else
        print_error "Deployment info not found. Please run full deployment first."
        exit 1
    fi
    
    # Set environment variables
    export REACT_APP_API_URL="http://$ALB_DNS/api"
    export GENERATE_SOURCEMAP=false
    
    # Update .env.local
    echo "REACT_APP_API_URL=http://$ALB_DNS/api" > .env.local
    echo "GENERATE_SOURCEMAP=false" >> .env.local
    
    # Build frontend
    print_info "Building React application..."
    npm run build
    
    # Upload to S3
    print_info "Uploading to S3..."
    aws s3 sync build/ s3://$S3_BUCKET_NAME --delete --region $AWS_REGION
    
    cd ..
    print_success "Frontend updated"
}

wait_for_deployment() {
    print_header "Waiting for Deployment"
    
    print_info "Waiting for ECS service to stabilize..."
    aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION
    
    # Get ALB DNS
    ALB_DNS=$(aws elbv2 describe-load-balancers --names esoteric-alb --region $AWS_REGION --query 'LoadBalancers[0].DNSName' --output text)
    
    print_info "Testing backend health..."
    for i in {1..20}; do
        if curl -f "http://$ALB_DNS/api/health" &> /dev/null; then
            print_success "Backend is healthy!"
            break
        fi
        print_info "Attempt $i/20: Backend not ready yet, waiting..."
        sleep 10
    done
}

show_urls() {
    print_header "Update Complete!"
    
    # Get URLs from deployment info
    if [ -f "aws-deployment-info.txt" ]; then
        echo ""
        print_success "🌐 Application Updated Successfully!"
        echo ""
        grep -E "Frontend:|Backend API:" aws-deployment-info.txt | sed 's/^/   /'
        echo ""
        print_info "📋 Test the updated application with:"
        print_info "   Email: demo@esoteric.com"
        print_info "   Password: admin123"
    else
        print_warning "Deployment info file not found"
    fi
}

# Main execution
main() {
    print_header "Esoteric Loans - AWS Update"
    
    # Change to project root
    cd "$(dirname "$0")/.."
    
    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found"
        exit 1
    fi
    
    # Check if deployment exists
    if ! aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION &> /dev/null; then
        print_error "ECS service not found. Run full deployment first:"
        print_error "   ./scripts/deploy-aws-complete.sh"
        exit 1
    fi
    
    case "${1:-both}" in
        backend|back|be)
            update_backend
            wait_for_deployment
            ;;
        frontend|front|fe)
            update_frontend
            ;;
        both|all|"")
            update_backend
            update_frontend
            wait_for_deployment
            ;;
        *)
            echo "Usage: $0 [backend|frontend|both]"
            echo ""
            echo "Options:"
            echo "  backend   Update only the backend"
            echo "  frontend  Update only the frontend"
            echo "  both      Update both (default)"
            exit 1
            ;;
    esac
    
    show_urls
}

# Handle help
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Esoteric Loans AWS Update Script"
    echo ""
    echo "Usage: $0 [component]"
    echo ""
    echo "Components:"
    echo "  backend   Update only the backend service"
    echo "  frontend  Update only the frontend files"
    echo "  both      Update both backend and frontend (default)"
    echo ""
    echo "This script updates an existing AWS deployment with new code."
    echo "Run the full deployment script first if this is a new deployment."
    exit 0
fi

main "$@"