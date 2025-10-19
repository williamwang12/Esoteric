#!/bin/bash

# 🏠 Switch to Local Development Environment
# This script switches the configuration back to local development

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}🏠 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_step "Switching to local development environment..."

# Backend local .env
cat > backend/.env << 'EOF'
NODE_ENV=development
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=williamwang
DB_PASSWORD=
DB_NAME=esoteric_loans
DB_SSL=false
JWT_SECRET=your_super_secure_jwt_secret_key_make_it_very_long_and_random_for_production
FRONTEND_URL=http://localhost:3000
EOF

# Frontend local .env
cat > frontend/.env.local << 'EOF'
REACT_APP_API_URL=http://localhost:8080/api
GENERATE_SOURCEMAP=false
EOF

print_success "Local environment configuration restored"

echo ""
echo "🏠 Local Development Environment Active"
echo "======================================"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:8080/api"
echo "💾 Database: localhost:5432/esoteric_loans"
echo ""
echo "💡 To start development:"
echo "   Backend:  cd backend && npm start"
echo "   Frontend: cd frontend && npm start"