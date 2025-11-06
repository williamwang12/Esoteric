#!/bin/bash
set -e

VERSION=${1:-"v$(date +%s)"}
echo "🚀 Deploying backend version: $VERSION"

cd backend

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  484069698162.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker buildx build \
  --platform linux/amd64 \
  -t 484069698162.dkr.ecr.us-east-1.amazonaws.com/backend:$VERSION \
  --push \
  .

# Update task definition
CURRENT_VERSION=$(grep -o 'backend:v[0-9]*' task-definition.json | cut -d':' -f2)
sed -i '' "s/:$CURRENT_VERSION/:$VERSION/g" task-definition.json

# Register and deploy
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region us-east-1

aws ecs update-service \
  --cluster esoteric-cluster \
  --service esoteric-service \
  --task-definition esoteric-backend \
  --force-new-deployment \
  --region us-east-1

echo "✅ Backend deployed! Version: $VERSION"
echo "⏳ Waiting for deployment..."
sleep 120

echo "📋 Recent logs:"
aws logs tail /ecs/esoteric-backend --region us-east-1 --since 1m
