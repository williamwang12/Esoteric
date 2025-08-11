#!/bin/bash

# Start backend server script
# This script starts the backend server on the correct port to match frontend expectations

echo "🔧 Starting Esoteric Backend Server..."

# Navigate to backend directory
cd /Users/williamwang/Esoteric/backend

# Kill any existing processes on relevant ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true  
lsof -ti:5002 | xargs kill -9 2>/dev/null || true

# Start the server on port 5002 to match frontend expectations
echo "🚀 Starting server on port 5002..."
PORT=5002 node server-2fa.js