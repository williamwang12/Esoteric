cat > deploy-backend.sh << 'EOF'
#!/bin/bash

# Backend Deployment Script for AWS ECS Fargate
# Usage: ./deploy-backend.sh [version]

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="484069698162"
ECR_REPOSITORY="backend"
ECS_CLUSTER="esoteric-cluster"
ECS_SERVICE="esoteric-service"
TASK_FAMILY="esoteric-backend"

# Get version from argument or auto-increment
if [ -z "$1" ]; then
    echo -e "${YELLOW}No version specified. Auto-generating...${NC}"
    VERSION="v$(date +%Y%m%d-%H%M%S)"
else
    VERSION="$1"
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying Backend - Version: ${VERSION}${NC}"
echo -e "${GREEN}========================================${NC}"

# Step 1: Login to ECR
echo -e "\n${YELLOW}[1/6] Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin \
    ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Step 2: Build Docker image
echo -e "\n${YELLOW}[2/6] Building Docker image...${NC}"
cd backend
docker buildx build \
    --platform linux/amd64 \
    -t ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${VERSION} \
    -t ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest \
    --push \
    .

# Step 3: Update task definition
echo -e "\n${YELLOW}[3/6] Updating task definition...${NC}"
cd ..

# Update image tag in task definition
sed -i.bak "s|${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:.*\"|${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${VERSION}\"|" backend/task-definition.json

# Register new task definition
TASK_REVISION=$(aws ecs register-task-definition \
    --cli-input-json file://backend/task-definition.json \
    --region $AWS_REGION \
    --query 'taskDefinition.revision' \
    --output text)

echo -e "${GREEN}Registered task definition revision: ${TASK_REVISION}${NC}"

# Step 4: Update ECS service
echo -e "\n${YELLOW}[4/6] Updating ECS service...${NC}"
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition ${TASK_FAMILY}:${TASK_REVISION} \
    --force-new-deployment \
    --region $AWS_REGION \
    --output table

# Step 5: Wait for deployment
echo -e "\n${YELLOW}[5/6] Waiting for deployment to complete...${NC}"
echo "This may take 2-3 minutes..."

COUNTER=0
MAX_WAIT=300  # 5 minutes max

while [ $COUNTER -lt $MAX_WAIT ]; do
    DEPLOYMENT_STATUS=$(aws ecs describe-services \
        --cluster $ECS_CLUSTER \
        --services $ECS_SERVICE \
        --region $AWS_REGION \
        --query 'services[0].deployments[?status==`PRIMARY`] | [0].rolloutState' \
        --output text)
    
    RUNNING_COUNT=$(aws ecs describe-services \
        --cluster $ECS_CLUSTER \
        --services $ECS_SERVICE \
        --region $AWS_REGION \
        --query 'services[0].deployments[?status==`PRIMARY`] | [0].runningCount' \
        --output text)
    
    DESIRED_COUNT=$(aws ecs describe-services \
        --cluster $ECS_CLUSTER \
        --services $ECS_SERVICE \
        --region $AWS_REGION \
        --query 'services[0].deployments[?status==`PRIMARY`] | [0].desiredCount' \
        --output text)
    
    echo -ne "\rStatus: ${DEPLOYMENT_STATUS} | Running: ${RUNNING_COUNT}/${DESIRED_COUNT}"
    
    if [ "$DEPLOYMENT_STATUS" = "COMPLETED" ] && [ "$RUNNING_COUNT" = "$DESIRED_COUNT" ]; then
        echo -e "\n${GREEN}Deployment completed successfully!${NC}"
        break
    fi
    
    if [ "$DEPLOYMENT_STATUS" = "FAILED" ]; then
        echo -e "\n${RED}Deployment failed!${NC}"
        exit 1
    fi
    
    sleep 10
    COUNTER=$((COUNTER + 10))
done

if [ $COUNTER -ge $MAX_WAIT ]; then
    echo -e "\n${RED}Deployment timed out!${NC}"
    exit 1
fi

# Step 6: Get load balancer URL and test
echo -e "\n${YELLOW}[6/6] Testing deployment...${NC}"

# Get load balancer DNS
TG_ARN=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION \
    --query 'services[0].loadBalancers[0].targetGroupArn' \
    --output text)

LB_ARN=$(aws elbv2 describe-target-groups \
    --target-group-arns $TG_ARN \
    --region $AWS_REGION \
    --query 'TargetGroups[0].LoadBalancerArns[0]' \
    --output text)

LB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $LB_ARN \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].DNSName' \
    --output text)

echo -e "${GREEN}Backend URL: http://${LB_DNS}${NC}"

# Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
sleep 5  # Give the service a moment to be ready

HEALTH_RESPONSE=$(curl -s http://${LB_DNS}/api/health)
echo $HEALTH_RESPONSE | jq . 2>/dev/null || echo $HEALTH_RESPONSE

if echo $HEALTH_RESPONSE | grep -q "healthy"; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ Deployment Successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Version: ${VERSION}${NC}"
    echo -e "${GREEN}Revision: ${TASK_REVISION}${NC}"
    echo -e "${GREEN}URL: http://${LB_DNS}${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "\n${YELLOW}⚠️  Deployment completed but health check returned unexpected response${NC}"
    echo -e "${YELLOW}Check logs: aws logs tail /ecs/esoteric-backend --region ${AWS_REGION} --follow${NC}"
fi

# Cleanup
rm -f backend/task-definition.json.bak

echo -e "\n${GREEN}Deployment complete!${NC}"
EOF

# Make it executable
chmod +x deploy-backend.sh

echo "Deployment script created: deploy-backend.sh"