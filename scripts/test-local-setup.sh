#!/bin/bash

# Test Local Development Setup
# This script tests if the local development environment can start properly

set -e

echo "🧪 Testing Local Development Setup"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Please run this script from the Esoteric project root directory"
    exit 1
fi

# Test frontend package.json scripts
echo "📦 Testing frontend scripts..."
cd frontend

# Check if start script uses react-scripts (development)
if grep -q "react-scripts start" package.json; then
    echo "✅ Frontend development script configured correctly"
else
    echo "❌ Frontend development script not configured properly"
    exit 1
fi

# Check if production script exists
if grep -q "start:prod" package.json; then
    echo "✅ Frontend production script configured correctly"
else
    echo "❌ Frontend production script missing"
    exit 1
fi

cd ..

# Test environment files
echo "🔧 Testing environment configuration..."

if [ ! -f "backend/.env" ]; then
    echo "⚠️  Creating backend/.env from template..."
    cp backend/env.example backend/.env
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "⚠️  Creating frontend/.env.local from template..."
    cp frontend-env.example frontend/.env.local
fi

echo "✅ Environment files ready"

# Test if dependencies are installed
echo "📚 Checking dependencies..."

if [ ! -d "backend/node_modules" ]; then
    echo "⚠️  Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "✅ Dependencies installed"

# Test backend startup (quick test)
echo "🔧 Testing backend startup..."
cd backend
timeout 10s node server-2fa.js > /dev/null 2>&1 &
BACKEND_PID=$!
sleep 3

if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend can start successfully"
    kill $BACKEND_PID 2>/dev/null || true
else
    echo "❌ Backend failed to start - check your database configuration in backend/.env"
    echo "   For quick testing, you can leave DB_* variables empty to use SQLite"
fi

cd ..

echo ""
echo "🎉 Local Development Setup Test Complete!"
echo ""
echo "📋 Summary:"
echo "   ✅ Frontend scripts configured for development"
echo "   ✅ Environment files ready"
echo "   ✅ Dependencies installed"
echo ""
echo "🚀 To start development servers:"
echo "   ./scripts/start-website.sh"
echo ""
echo "📖 For detailed setup instructions:"
echo "   cat docs/setup/LOCAL-DEVELOPMENT-GUIDE.md"
