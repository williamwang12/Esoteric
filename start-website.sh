#!/bin/bash

# Esoteric Enterprises - Website Startup Script
# This script starts both the backend and frontend servers

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill processes on a port
kill_port() {
    local port=$1
    print_warning "Killing existing processes on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Function to cleanup on exit
cleanup() {
    print_warning "Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    exit 0
}

# Trap cleanup function on script exit
trap cleanup SIGINT SIGTERM EXIT

print_status "Starting Esoteric Enterprises Website..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the Esoteric project root directory"
    exit 1
fi

# Check if .env files exist
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    cp env.example .env
fi

if [ ! -f "backend/.env" ]; then
    print_warning "backend/.env file not found. Creating from template..."
    cp backend/env.example backend/.env
fi

if [ ! -f "frontend/.env" ]; then
    print_warning "frontend/.env file not found. Creating from template..."
    cp frontend-env.example frontend/.env
fi

# Check for port conflicts and kill if necessary
if check_port 5002; then
    print_warning "Port 5002 is already in use"
    kill_port 5002
fi

if check_port 3000; then
    print_warning "Port 3000 is already in use"
    kill_port 3000
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check if dependencies are installed
print_status "Checking dependencies..."
if [ ! -d "backend/node_modules" ]; then
    print_warning "Backend dependencies not found. Installing..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    print_warning "Frontend dependencies not found. Installing..."
    cd frontend && npm install && cd ..
fi

# Create log directory
mkdir -p logs

print_status "Starting backend server on port 5002..."
cd backend
PORT=5002 node server-2fa.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_error "Backend failed to start. Check logs/backend.log for details."
    exit 1
fi

if ! check_port 5002; then
    print_error "Backend is not listening on port 5002"
    exit 1
fi

print_success "Backend server started successfully (PID: $BACKEND_PID)"

print_status "Starting frontend development server on port 3000..."
cd frontend
npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
print_status "Waiting for frontend to compile..."
sleep 10

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    print_error "Frontend failed to start. Check logs/frontend.log for details."
    exit 1
fi

print_success "Frontend development server started successfully (PID: $FRONTEND_PID)"

print_success "🚀 Website is now running!"
echo ""
echo -e "${GREEN}📱 Frontend:${NC} http://localhost:3000"
echo -e "${GREEN}🔧 Backend API:${NC} http://localhost:5002/api"
echo -e "${GREEN}❤️ Health Check:${NC} http://localhost:5002/api/health"
echo ""
echo -e "${BLUE}💡 Test Account:${NC}"
echo "   Email: test@test.com"
echo "   Password: password123"
echo ""
echo -e "${YELLOW}📋 Logs:${NC}"
echo "   Backend: logs/backend.log"
echo "   Frontend: logs/frontend.log"
echo ""
echo -e "${YELLOW}⚠️  Press Ctrl+C to stop all servers${NC}"

# Wait for user interrupt
wait