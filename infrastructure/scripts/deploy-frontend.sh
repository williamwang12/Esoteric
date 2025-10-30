#!/bin/bash

# Frontend Deployment Script for S3 and CloudFront
# Usage: ./deploy-frontend.sh [staging|production]

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
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Default environment
ENVIRONMENT=${1:-staging}

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

echo -e "${BLUE}🚀 Deploying frontend for ${ENVIRONMENT}...${NC}"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Frontend directory not found: $FRONTEND_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Get infrastructure outputs
echo -e "${YELLOW}📡 Getting infrastructure details...${NC}"
AWS_REGION="us-east-1"

# Get S3 bucket name
S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "EsotericStack-${ENVIRONMENT}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text)

if [ -z "$S3_BUCKET" ] || [ "$S3_BUCKET" = "None" ]; then
    echo -e "${RED}❌ Could not get S3 bucket name. Make sure the infrastructure is deployed.${NC}"
    exit 1
fi

# Get CloudFront distribution URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "EsotericStack-${ENVIRONMENT}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

# Get Load Balancer URL for API
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "EsotericStack-${ENVIRONMENT}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerUrl`].OutputValue' \
    --output text)

if [ -z "$API_URL" ] || [ "$API_URL" = "None" ]; then
    echo -e "${RED}❌ Could not get API URL. Make sure the infrastructure is deployed.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Infrastructure details retrieved${NC}"
echo -e "${BLUE}S3 Bucket: ${S3_BUCKET}${NC}"
echo -e "${BLUE}API URL: ${API_URL}/api${NC}"
if [ -n "$CLOUDFRONT_URL" ]; then
    echo -e "${BLUE}CloudFront URL: ${CLOUDFRONT_URL}${NC}"
fi

# Build frontend
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd "$FRONTEND_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm ci
fi

# Set environment variables for build
export REACT_APP_API_URL="${API_URL}/api"

# Get Calendly and DocuSign config from local env or secrets
if [ -f ".env" ]; then
    export REACT_APP_CALENDLY_ACCESS_TOKEN=$(grep REACT_APP_CALENDLY_ACCESS_TOKEN .env | cut -d '=' -f2 | tr -d '"')
fi

echo -e "${YELLOW}Building with API URL: ${REACT_APP_API_URL}${NC}"

# Build the application
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Deploy to S3
echo -e "${YELLOW}📤 Deploying to S3...${NC}"

# Sync build files to S3
aws s3 sync build/ "s3://${S3_BUCKET}" \
    --delete \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html" \
    --exclude "service-worker.js" \
    --exclude "*.map"

# Upload index.html with no-cache
aws s3 cp build/index.html "s3://${S3_BUCKET}/index.html" \
    --cache-control "public,max-age=0,must-revalidate"

# Upload service worker with no-cache
if [ -f "build/service-worker.js" ]; then
    aws s3 cp build/service-worker.js "s3://${S3_BUCKET}/service-worker.js" \
        --cache-control "public,max-age=0,must-revalidate"
fi

echo -e "${GREEN}✅ Files uploaded to S3${NC}"

# Invalidate CloudFront cache if distribution exists
if [ -n "$CLOUDFRONT_URL" ] && [ "$CLOUDFRONT_URL" != "None" ]; then
    echo -e "${YELLOW}♻️  Invalidating CloudFront cache...${NC}"
    
    # Extract domain from URL
    CLOUDFRONT_DOMAIN=$(echo "$CLOUDFRONT_URL" | sed 's|https://||')
    
    # Get distribution ID
    DISTRIBUTION_ID=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?DomainName=='${CLOUDFRONT_DOMAIN}'].Id" \
        --output text)
    
    if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
        aws cloudfront create-invalidation \
            --distribution-id "$DISTRIBUTION_ID" \
            --paths "/*" \
            --output table
        
        echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not find CloudFront distribution ID${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No CloudFront distribution found${NC}"
fi

# Final output
echo ""
echo -e "${GREEN}🎉 Frontend Deployment Complete!${NC}"
echo -e "${BLUE}S3 Bucket: ${S3_BUCKET}${NC}"

if [ -n "$CLOUDFRONT_URL" ] && [ "$CLOUDFRONT_URL" != "None" ]; then
    echo -e "${BLUE}Frontend URL: ${CLOUDFRONT_URL}${NC}"
else
    echo -e "${BLUE}S3 Website URL: http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com${NC}"
fi

echo -e "${BLUE}API Endpoint: ${REACT_APP_API_URL}${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "   1. Test the frontend application"
echo "   2. Verify API connectivity"
echo "   3. Check browser console for any errors"
echo "   4. Monitor CloudWatch logs for backend issues"