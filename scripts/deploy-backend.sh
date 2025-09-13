#!/bin/bash

# Backend Deployment Script for Heroku
# Usage: ./deploy-backend.sh [commit-message]

set -e  # Exit on any error

echo "🚀 Backend Deployment Script"
echo "============================"

# Check if we're in the right directory
if [ ! -f "backend/server-2fa.js" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   npm install -g heroku"
    exit 1
fi

# Check Heroku login
echo "📋 Checking Heroku login status..."
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Please login to Heroku first:"
    echo "   heroku login"
    exit 1
fi

# Get commit message from argument or prompt
if [ -z "$1" ]; then
    echo "💬 Enter commit message for backend changes:"
    read -r COMMIT_MESSAGE
else
    COMMIT_MESSAGE="$1"
fi

if [ -z "$COMMIT_MESSAGE" ]; then
    COMMIT_MESSAGE="Backend deployment $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo "📝 Commit message: $COMMIT_MESSAGE"

# Check for changes in backend directory
if git diff --quiet HEAD -- backend/; then
    echo "ℹ️  No changes detected in backend directory"
    echo "🤔 Do you want to deploy anyway? (y/N)"
    read -r DEPLOY_ANYWAY
    if [[ ! "$DEPLOY_ANYWAY" =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 0
    fi
else
    echo "📦 Changes detected in backend directory"
fi

# Stage and commit changes
echo "📝 Staging backend changes..."
git add backend/

if ! git diff --cached --quiet; then
    echo "💾 Committing changes..."
    git commit -m "Backend: $COMMIT_MESSAGE"
else
    echo "ℹ️  No staged changes to commit"
fi

# Set Heroku remote for backend
echo "🔗 Setting Heroku remote for backend..."
heroku git:remote -a esoteric-backend

# Deploy to Heroku
echo "🚀 Deploying backend to Heroku..."
echo "   This may take a few minutes..."

if git subtree push --prefix backend heroku main; then
    echo ""
    echo "✅ Backend deployment successful!"
    echo ""
    echo "🌐 Backend URL: https://esoteric-backend-2a06148f13b9.herokuapp.com"
    echo "🔍 Health check: https://esoteric-backend-2a06148f13b9.herokuapp.com/api/health"
    echo ""
    echo "📊 To view logs:"
    echo "   heroku logs --tail -a esoteric-backend"
    echo ""
    echo "🔄 To restart if needed:"
    echo "   heroku restart -a esoteric-backend"
else
    echo ""
    echo "❌ Backend deployment failed!"
    echo "📊 Check logs with:"
    echo "   heroku logs --tail -a esoteric-backend"
    exit 1
fi
