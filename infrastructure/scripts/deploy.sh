#!/bin/bash

# AWS CDK Deployment Script for Esoteric Platform
# Usage: ./deploy.sh [staging|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Default environment
ENVIRONMENT=${1:-staging}

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

echo -e "${BLUE}🚀 Deploying Esoteric Platform to ${ENVIRONMENT}...${NC}"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ AWS CDK is not installed${NC}"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Configure with: aws configure"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Change to infrastructure directory
cd "$PROJECT_DIR"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build TypeScript
echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
npm run build

# Bootstrap CDK (if needed)
echo -e "${YELLOW}🚀 Bootstrapping CDK...${NC}"
cdk bootstrap

# Deploy infrastructure
echo -e "${YELLOW}🏗️  Deploying infrastructure...${NC}"
cdk deploy "EsotericStack-${ENVIRONMENT}" \
    --context environment="$ENVIRONMENT" \
    --require-approval never \
    --outputs-file "./outputs-${ENVIRONMENT}.json"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Infrastructure deployment completed successfully!${NC}"
    
    # Display outputs
    if [ -f "./outputs-${ENVIRONMENT}.json" ]; then
        echo -e "${BLUE}📋 Deployment Outputs:${NC}"
        cat "./outputs-${ENVIRONMENT}.json" | jq '.'
    fi
    
    echo -e "${GREEN}"
    echo "🎉 Deployment Summary:"
    echo "   Environment: $ENVIRONMENT"
    echo "   Stack: EsotericStack-$ENVIRONMENT"
    echo "   Region: us-east-1"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Build and push your container images:"
    echo "      ./scripts/build-and-push.sh $ENVIRONMENT"
    echo ""
    echo "   2. Migrate your database:"
    echo "      ./scripts/migrate-database.sh $ENVIRONMENT"
    echo ""
    echo "   3. Deploy your frontend to S3:"
    echo "      ./scripts/deploy-frontend.sh $ENVIRONMENT"
    echo -e "${NC}"
else
    echo -e "${RED}❌ Infrastructure deployment failed${NC}"
    exit 1
fi