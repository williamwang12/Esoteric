#!/bin/bash

# Full Stack Deployment Script for Heroku
# Usage: ./deploy-all.sh [commit-message]

set -e  # Exit on any error

echo "🚀 Full Stack Deployment Script"
echo "==============================="

# Check if we're in the right directory
if [ ! -f "backend/server-2fa.js" ] || [ ! -f "frontend/package.json" ]; then
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
    echo "💬 Enter commit message for deployment:"
    read -r COMMIT_MESSAGE
else
    COMMIT_MESSAGE="$1"
fi

if [ -z "$COMMIT_MESSAGE" ]; then
    COMMIT_MESSAGE="Full stack deployment $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo "📝 Commit message: $COMMIT_MESSAGE"

# Check for changes
BACKEND_CHANGES=false
FRONTEND_CHANGES=false

if ! git diff --quiet HEAD -- backend/; then
    BACKEND_CHANGES=true
    echo "📦 Backend changes detected"
fi

if ! git diff --quiet HEAD -- frontend/; then
    FRONTEND_CHANGES=true
    echo "📦 Frontend changes detected"
fi

if [ "$BACKEND_CHANGES" = false ] && [ "$FRONTEND_CHANGES" = false ]; then
    echo "ℹ️  No changes detected in backend or frontend"
    echo "🤔 Do you want to deploy anyway? (y/N)"
    read -r DEPLOY_ANYWAY
    if [[ ! "$DEPLOY_ANYWAY" =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 0
    fi
fi

# Ask which components to deploy
echo ""
echo "🎯 What would you like to deploy?"
echo "1) Backend only"
echo "2) Frontend only" 
echo "3) Both (recommended)"
echo ""
read -p "Choose option (1-3): " DEPLOY_OPTION

case $DEPLOY_OPTION in
    1)
        DEPLOY_BACKEND=true
        DEPLOY_FRONTEND=false
        ;;
    2)
        DEPLOY_BACKEND=false
        DEPLOY_FRONTEND=true
        ;;
    3|"")
        DEPLOY_BACKEND=true
        DEPLOY_FRONTEND=true
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

# Commit all changes first
echo "📝 Staging all changes..."
git add .

if ! git diff --cached --quiet; then
    echo "💾 Committing changes..."
    git commit -m "$COMMIT_MESSAGE"
else
    echo "ℹ️  No staged changes to commit"
fi

# Deploy Backend
if [ "$DEPLOY_BACKEND" = true ]; then
    echo ""
    echo "🔧 Deploying Backend..."
    echo "======================="
    
    heroku git:remote -a esoteric-backend
    
    if git subtree push --prefix backend heroku main; then
        echo "✅ Backend deployed successfully!"
    else
        echo "❌ Backend deployment failed!"
        echo "📊 Check logs: heroku logs --tail -a esoteric-backend"
        exit 1
    fi
fi

# Deploy Frontend
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo ""
    echo "🎨 Deploying Frontend..."
    echo "========================"
    
    # Check package-lock.json sync
    echo "🔍 Checking package-lock.json sync..."
    cd frontend
    if [ -f "package-lock.json" ]; then
        if ! npm ci --dry-run &> /dev/null; then
            echo "⚠️  package-lock.json out of sync, fixing..."
            npm install
            cd ..
            git add frontend/package-lock.json
            git commit -m "Fix package-lock.json sync" || true
        fi
    fi
    cd ..
    
    heroku git:remote -a esoteric-frontend
    
    if git subtree push --prefix frontend heroku main; then
        echo "✅ Frontend deployed successfully!"
    else
        echo "❌ Frontend deployment failed!"
        echo "📊 Check logs: heroku logs --tail -a esoteric-frontend"
        exit 1
    fi
fi

# Success summary
echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo ""

if [ "$DEPLOY_BACKEND" = true ]; then
    echo "🔧 Backend: https://esoteric-backend-2a06148f13b9.herokuapp.com"
    echo "   Health: https://esoteric-backend-2a06148f13b9.herokuapp.com/api/health"
fi

if [ "$DEPLOY_FRONTEND" = true ]; then
    echo "🎨 Frontend: https://esoteric-frontend-f6672220c878.herokuapp.com"
    echo "   Login: https://esoteric-frontend-f6672220c878.herokuapp.com/login"
fi

echo ""
echo "👤 Admin Login:"
echo "   Email: demo@esoteric.com"
echo "   Password: admin123"
echo ""
echo "📊 Monitor logs:"
if [ "$DEPLOY_BACKEND" = true ]; then
    echo "   heroku logs --tail -a esoteric-backend"
fi
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo "   heroku logs --tail -a esoteric-frontend"
fi
echo ""
echo "🔄 Restart if needed:"
if [ "$DEPLOY_BACKEND" = true ]; then
    echo "   heroku restart -a esoteric-backend"
fi
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo "   heroku restart -a esoteric-frontend"
fi
