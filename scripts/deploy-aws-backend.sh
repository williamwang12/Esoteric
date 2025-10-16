#!/bin/bash

# AWS Elastic Beanstalk Backend Deployment Script
# This script deploys the backend to AWS Elastic Beanstalk

set -e

echo "🚀 Starting AWS Backend Deployment..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "brew install awscli"
    exit 1
fi

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then then
    echo "❌ EB CLI is not installed. Please install it first:"
    echo "pip install awsebcli"
    exit 1
fi

# Ensure we're in the backend directory
cd backend

# Copy AWS environment configuration
if [ -f ".env.aws" ]; then
    cp .env.aws .env
    echo "✅ AWS environment configuration loaded"
else
    echo "❌ .env.aws file not found. Please create it first."
    exit 1
fi

# Initialize Elastic Beanstalk application (run this once)
if [ ! -d ".elasticbeanstalk" ]; then
    echo "🔧 Initializing Elastic Beanstalk application..."
    eb init esoteric-backend --platform node.js --region us-east-1
fi

# Create environment if it doesn't exist
if ! eb status production &> /dev/null; then
    echo "🏗️ Creating Elastic Beanstalk environment..."
    eb create production --instance-type t3.micro --database.engine postgres --database.size 20
else
    echo "📦 Deploying to existing environment..."
    eb deploy production
fi

echo "✅ Backend deployment completed!"
echo "🌐 Application URL:"
eb status production | grep "CNAME"