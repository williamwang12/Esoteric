#!/bin/bash

# Frontend Deployment Script for Heroku
# Usage: ./deploy-frontend.sh [commit-message]

set -e  # Exit on any error

echo "🎨 Frontend Deployment Script"
echo "============================="

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
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
    echo "💬 Enter commit message for frontend changes:"
    read -r COMMIT_MESSAGE
else
    COMMIT_MESSAGE="$1"
fi

if [ -z "$COMMIT_MESSAGE" ]; then
    COMMIT_MESSAGE="Frontend deployment $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo "📝 Commit message: $COMMIT_MESSAGE"

# Check for changes in frontend directory
if git diff --quiet HEAD -- frontend/; then
    echo "ℹ️  No changes detected in frontend directory"
    echo "🤔 Do you want to deploy anyway? (y/N)"
    read -r DEPLOY_ANYWAY
    if [[ ! "$DEPLOY_ANYWAY" =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 0
    fi
else
    echo "📦 Changes detected in frontend directory"
fi

# Check if package-lock.json is in sync (common deployment issue)
echo "🔍 Checking package-lock.json sync..."
cd frontend
if [ -f "package-lock.json" ]; then
    if ! npm ci --dry-run &> /dev/null; then
        echo "⚠️  package-lock.json appears to be out of sync"
        echo "🔧 Running npm install to fix..."
        npm install
        cd ..
        git add frontend/package-lock.json
        echo "✅ package-lock.json updated"
    fi
fi
cd ..

# Stage and commit changes
echo "📝 Staging frontend changes..."
git add frontend/

if ! git diff --cached --quiet; then
    echo "💾 Committing changes..."
    git commit -m "Frontend: $COMMIT_MESSAGE"
else
    echo "ℹ️  No staged changes to commit"
fi

# Set Heroku remote for frontend
echo "🔗 Setting Heroku remote for frontend..."
heroku git:remote -a esoteric-frontend

# Deploy to Heroku
echo "🚀 Deploying frontend to Heroku..."
echo "   This may take a few minutes (includes React build)..."

if git subtree push --prefix frontend heroku main; then
    echo ""
    echo "✅ Frontend deployment successful!"
    echo ""
    echo "🌐 Frontend URL: https://esoteric-frontend-f6672220c878.herokuapp.com"
    echo "🔍 Test login: https://esoteric-frontend-f6672220c878.herokuapp.com/login"
    echo ""
    echo "👤 Admin login credentials:"
    echo "   Email: demo@esoteric.com"
    echo "   Password: admin123"
    echo ""
    echo "📊 To view logs:"
    echo "   heroku logs --tail -a esoteric-frontend"
    echo ""
    echo "🔄 To restart if needed:"
    echo "   heroku restart -a esoteric-frontend"
else
    echo ""
    echo "❌ Frontend deployment failed!"
    echo "📊 Check logs with:"
    echo "   heroku logs --tail -a esoteric-frontend"
    echo ""
    echo "💡 Common issues:"
    echo "   - package-lock.json out of sync (run npm install in frontend/)"
    echo "   - Build errors (check TypeScript/ESLint issues)"
    echo "   - Environment variables not set"
    exit 1
fi
