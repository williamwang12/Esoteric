#!/bin/bash

# Environment Switcher Script
# Switches between local development and AWS production configurations

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

switch_to_local() {
    print_info "Switching to LOCAL development environment..."
    
    # Frontend configuration
    cd frontend
    cat > .env.local << EOF
REACT_APP_API_URL=http://localhost:5002/api
GENERATE_SOURCEMAP=true
EOF
    
    cd ../backend
    
    # Backend configuration
    cat > .env << EOF
PORT=5002
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=esoteric_loans
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=your_local_jwt_secret_key_here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
EOF
    
    cd ..
    print_success "Switched to LOCAL environment"
    print_info "Frontend: http://localhost:3000"
    print_info "Backend: http://localhost:5002"
    print_info "Database: localhost:5432"
}

switch_to_aws() {
    print_info "Switching to AWS production environment..."
    
    # Get AWS configuration from deployment info
    if [ ! -f "aws-deployment-info.txt" ]; then
        echo "❌ AWS deployment info not found. Run deployment first:"
        echo "   ./scripts/deploy-aws-complete.sh"
        exit 1
    fi
    
    # Extract URLs from deployment info
    BACKEND_URL=$(grep "Backend API:" aws-deployment-info.txt | awk '{print $3}')
    
    # Frontend configuration
    cd frontend
    cat > .env.local << EOF
REACT_APP_API_URL=${BACKEND_URL}
GENERATE_SOURCEMAP=false
EOF
    
    cd ..
    print_success "Switched to AWS environment"
    print_info "Frontend: Uses AWS S3 hosting"
    print_info "Backend: ${BACKEND_URL}"
    print_info "Database: AWS RDS"
}

show_current() {
    print_info "Current configuration:"
    echo ""
    
    if [ -f "frontend/.env.local" ]; then
        API_URL=$(grep REACT_APP_API_URL frontend/.env.local | cut -d'=' -f2)
        if [[ $API_URL == *"localhost"* ]]; then
            echo "Environment: LOCAL"
            echo "Frontend: http://localhost:3000"
            echo "Backend: http://localhost:5002"
        else
            echo "Environment: AWS"
            echo "Backend: $API_URL"
        fi
    else
        echo "No configuration found"
    fi
}

# Main execution
case "${1:-}" in
    local|dev|development)
        switch_to_local
        ;;
    aws|prod|production)
        switch_to_aws
        ;;
    status|current|show)
        show_current
        ;;
    *)
        echo "Environment Switcher"
        echo ""
        echo "Usage: $0 [environment]"
        echo ""
        echo "Environments:"
        echo "  local     Switch to local development"
        echo "  aws       Switch to AWS production"
        echo "  status    Show current environment"
        echo ""
        echo "Examples:"
        echo "  $0 local    # Switch to localhost"
        echo "  $0 aws      # Switch to AWS"
        echo "  $0 status   # Show current config"
        ;;
esac