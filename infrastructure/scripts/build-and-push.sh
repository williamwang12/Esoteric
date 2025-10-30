#!/bin/bash

# Build and Push Container Images to ECR
# Usage: ./build-and-push.sh [staging|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Default environment
ENVIRONMENT=${1:-staging}

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

echo -e "${BLUE}🔨 Building and pushing containers for ${ENVIRONMENT}...${NC}"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Configure with: aws configure"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-east-1"

# Get ECR repository URI from stack outputs
echo -e "${YELLOW}📡 Getting ECR repository URI...${NC}"
ECR_URI=$(aws cloudformation describe-stacks \
    --stack-name "EsotericStack-${ENVIRONMENT}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryUri`].OutputValue' \
    --output text)

if [ -z "$ECR_URI" ]; then
    echo -e "${RED}❌ Could not get ECR repository URI. Make sure the infrastructure is deployed.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ ECR Repository URI: ${ECR_URI}${NC}"

# Login to ECR
echo -e "${YELLOW}🔐 Logging in to ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_URI"

# Build backend image
echo -e "${YELLOW}🔨 Building backend image...${NC}"
cd "$PROJECT_DIR"

docker build \
    -t esoteric-backend:latest \
    -t esoteric-backend:$ENVIRONMENT \
    -t "$ECR_URI:latest" \
    -t "$ECR_URI:$ENVIRONMENT" \
    ./backend

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend image built successfully${NC}"

# Push backend image to ECR
echo -e "${YELLOW}📤 Pushing backend image to ECR...${NC}"

docker push "$ECR_URI:latest"
docker push "$ECR_URI:$ENVIRONMENT"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend image pushed successfully!${NC}"
    
    echo -e "${GREEN}"
    echo "🎉 Container Build and Push Summary:"
    echo "   Environment: $ENVIRONMENT"
    echo "   Backend Image: $ECR_URI:$ENVIRONMENT"
    echo "   AWS Account: $AWS_ACCOUNT_ID"
    echo "   AWS Region: $AWS_REGION"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Update your ECS service to use the new image:"
    echo "      aws ecs update-service --cluster esoteric-${ENVIRONMENT}-cluster --service esoteric-${ENVIRONMENT}-backend-service --force-new-deployment"
    echo ""
    echo "   2. Monitor the deployment:"
    echo "      aws ecs describe-services --cluster esoteric-${ENVIRONMENT}-cluster --services esoteric-${ENVIRONMENT}-backend-service"
    echo ""
    echo "   3. Check logs if needed:"
    echo "      aws logs tail /aws/ecs/esoteric-${ENVIRONMENT}-backend --follow"
    echo -e "${NC}"
else
    echo -e "${RED}❌ Backend image push failed${NC}"
    exit 1
fi