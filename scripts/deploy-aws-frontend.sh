#!/bin/bash

# AWS S3 + CloudFront Frontend Deployment Script
# This script builds and deploys the React frontend to S3 with CloudFront

set -e

echo "🚀 Starting AWS Frontend Deployment..."

# Configuration
BUCKET_NAME="esoteric-frontend-$(date +%s)"
REGION="us-east-1"
CLOUDFRONT_COMMENT="Esoteric Frontend Distribution"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "brew install awscli"
    exit 1
fi

# Ensure we're in the frontend directory
cd frontend

# Install dependencies and build
echo "📦 Installing dependencies..."
npm install

echo "🏗️ Building React application..."
npm run build

# Create S3 bucket
echo "🪣 Creating S3 bucket: $BUCKET_NAME"
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Configure bucket for static website hosting
echo "⚙️ Configuring S3 bucket for static hosting..."
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html

# Set bucket policy for public read access
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json
rm bucket-policy.json

# Upload build files to S3
echo "📤 Uploading build files to S3..."
aws s3 sync build/ s3://$BUCKET_NAME --delete

# Create CloudFront distribution
echo "🌐 Creating CloudFront distribution..."
cat > cloudfront-config.json << EOF
{
    "CallerReference": "esoteric-frontend-$(date +%s)",
    "Comment": "$CLOUDFRONT_COMMENT",
    "DefaultCacheBehavior": {
        "TargetOriginId": "$BUCKET_NAME-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0
    },
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "$BUCKET_NAME-origin",
                "DomainName": "$BUCKET_NAME.s3-website-$REGION.amazonaws.com",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only"
                }
            }
        ]
    },
    "Enabled": true,
    "CustomErrorResponses": {
        "Quantity": 1,
        "Items": [
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            }
        ]
    }
}
EOF

DISTRIBUTION_ID=$(aws cloudfront create-distribution --distribution-config file://cloudfront-config.json --query 'Distribution.Id' --output text)
rm cloudfront-config.json

echo "✅ Frontend deployment completed!"
echo "🪣 S3 Bucket: $BUCKET_NAME"
echo "🌐 CloudFront Distribution ID: $DISTRIBUTION_ID"
echo "📍 Website URL: https://$DISTRIBUTION_ID.cloudfront.net"
echo ""
echo "⏳ Note: CloudFront distribution may take 15-20 minutes to fully deploy"

# Save configuration for later use
echo "BUCKET_NAME=$BUCKET_NAME" > ../aws-frontend-config.env
echo "DISTRIBUTION_ID=$DISTRIBUTION_ID" >> ../aws-frontend-config.env
echo "FRONTEND_URL=https://$DISTRIBUTION_ID.cloudfront.net" >> ../aws-frontend-config.env