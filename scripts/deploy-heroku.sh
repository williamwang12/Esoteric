#!/bin/bash

echo "🚀 Deploying Esoteric to Heroku..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   npm install -g heroku"
    exit 1
fi

# Login check
echo "📋 Checking Heroku login status..."
heroku auth:whoami || {
    echo "Please login to Heroku first:"
    echo "   heroku login"
    exit 1
}

# Create Heroku apps
echo "🏗️  Creating Heroku applications..."
heroku create esoteric-backend-$(date +%s) || echo "Backend app might already exist"
heroku create esoteric-frontend-$(date +%s) || echo "Frontend app might already exist"

# Get app names
BACKEND_APP=$(heroku apps | grep esoteric-backend | head -1 | awk '{print $1}')
FRONTEND_APP=$(heroku apps | grep esoteric-frontend | head -1 | awk '{print $1}')

echo "Backend app: $BACKEND_APP"
echo "Frontend app: $FRONTEND_APP"

# Add PostgreSQL to backend
echo "🗄️  Adding PostgreSQL addon..."
heroku addons:create heroku-postgresql:mini -a $BACKEND_APP || echo "PostgreSQL addon might already exist"

# Set environment variables for backend
echo "⚙️  Setting backend environment variables..."
heroku config:set NODE_ENV=production -a $BACKEND_APP
heroku config:set JWT_SECRET=your-super-secure-jwt-secret-key-here-make-it-long-and-random-$(date +%s) -a $BACKEND_APP
heroku config:set FRONTEND_URL=https://$FRONTEND_APP.herokuapp.com -a $BACKEND_APP
heroku config:set MAX_FILE_SIZE=10485760 -a $BACKEND_APP
heroku config:set UPLOAD_PATH=./uploads -a $BACKEND_APP

# Set environment variables for frontend
echo "⚙️  Setting frontend environment variables..."
heroku config:set REACT_APP_API_URL=https://$BACKEND_APP.herokuapp.com/api -a $FRONTEND_APP

# Commit changes
echo "📝 Committing changes..."
git add .
git commit -m "Prepare for Heroku deployment" || echo "No changes to commit"

# Deploy backend
echo "📦 Deploying backend..."
heroku git:remote -a $BACKEND_APP
git subtree push --prefix backend heroku main || {
    echo "Trying force push..."
    git subtree push --prefix backend heroku main --force
}

# Deploy frontend
echo "🎨 Deploying frontend..."
heroku git:remote -a $FRONTEND_APP
git subtree push --prefix frontend heroku main || {
    echo "Trying force push..."
    git subtree push --prefix frontend heroku main --force
}

# Set up database
echo "🗄️  Setting up database schema..."
heroku pg:psql -a $BACKEND_APP < database/schema.sql || echo "Schema might already exist"

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your applications are available at:"
echo "   Backend:  https://$BACKEND_APP.herokuapp.com"
echo "   Frontend: https://$FRONTEND_APP.herokuapp.com"
echo ""
echo "📊 To view logs:"
echo "   heroku logs --tail -a $BACKEND_APP"
echo "   heroku logs --tail -a $FRONTEND_APP"
