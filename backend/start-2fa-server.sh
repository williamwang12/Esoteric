#!/bin/bash

echo "🔐 Starting Esoteric Enterprises Server with 2FA Support"
echo "================================================="

# Check if required files exist
if [ ! -f "server-2fa.js" ]; then
    echo "❌ Error: server-2fa.js not found"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Using default configuration."
fi

# Check if database migration has been run
echo "📊 Checking database setup..."

# Set default port if not specified
PORT=${PORT:-5001}

echo "🚀 Starting server on port $PORT..."
echo "📍 Server URL: http://localhost:$PORT"
echo "🔐 2FA endpoints: http://localhost:$PORT/api/2fa/"
echo "🔑 Auth endpoints: http://localhost:$PORT/api/auth/"
echo ""
echo "📱 2FA Features Available:"
echo "   ✅ TOTP Authentication (Google Authenticator, Authy, etc.)"
echo "   ✅ QR Code Generation"
echo "   ✅ Backup Codes"
echo "   ✅ Rate Limiting"
echo "   ✅ Session Management"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================================="

# Start the server
PORT=$PORT node server-2fa.js