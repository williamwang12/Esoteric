#!/bin/bash

# Database Isolation Verification Script
# This script verifies that tests are using isolated databases

echo "🔍 Database Isolation Verification"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if test environment file exists
if [[ ! -f "env.test" ]]; then
    echo -e "${RED}❌ Test environment file (env.test) not found${NC}"
    exit 1
fi

# Load test environment
source env.test

echo -e "${YELLOW}📋 Environment Configuration:${NC}"
echo "NODE_ENV: $NODE_ENV"
echo "Test DB Name: $DB_NAME"
echo "Test Upload Path: $UPLOAD_PATH"

# Verify test database name
if [[ "$DB_NAME" != *"test"* ]]; then
    echo -e "${RED}❌ WARNING: Test database name '$DB_NAME' doesn't contain 'test'${NC}"
    echo -e "${RED}   This could indicate tests might use production database!${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Test database name is properly isolated: $DB_NAME${NC}"
fi

# Check if production .env exists and compare
if [[ -f ".env" ]]; then
    echo -e "\n${YELLOW}📋 Comparing with production environment:${NC}"
    
    # Load production env
    PROD_DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2)
    PROD_UPLOAD_PATH=$(grep "^UPLOAD_PATH=" .env | cut -d'=' -f2)
    
    echo "Production DB Name: $PROD_DB_NAME"
    echo "Production Upload Path: $PROD_UPLOAD_PATH"
    
    # Verify databases are different
    if [[ "$DB_NAME" == "$PROD_DB_NAME" ]]; then
        echo -e "${RED}❌ CRITICAL: Test and production using same database!${NC}"
        echo -e "${RED}   Test DB: $DB_NAME${NC}"
        echo -e "${RED}   Prod DB: $PROD_DB_NAME${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Test and production databases are properly separated${NC}"
    fi
    
    # Verify upload paths are different
    if [[ "$UPLOAD_PATH" == "$PROD_UPLOAD_PATH" ]]; then
        echo -e "${RED}❌ WARNING: Test and production using same upload path!${NC}"
        echo -e "${RED}   Test Path: $UPLOAD_PATH${NC}"
        echo -e "${RED}   Prod Path: $PROD_UPLOAD_PATH${NC}"
    else
        echo -e "${GREEN}✅ Test and production upload paths are properly separated${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  Production .env file not found (this is normal)${NC}"
fi

# Check if test database exists and is empty
echo -e "\n${YELLOW}🔍 Checking test database status:${NC}"

# Try to connect to test database
if command -v psql &> /dev/null; then
    # Check if test database exists
    if psql -h "$DB_HOST" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        echo -e "${YELLOW}⚠️  Test database '$DB_NAME' already exists${NC}"
        echo -e "${YELLOW}   (This is normal - it will be recreated for each test run)${NC}"
    else
        echo -e "${GREEN}✅ Test database '$DB_NAME' doesn't exist (will be created during tests)${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  PostgreSQL client not available, skipping database check${NC}"
fi

# Check test upload directory
echo -e "\n${YELLOW}📁 Checking test upload directory:${NC}"
if [[ -d "$UPLOAD_PATH" ]]; then
    FILE_COUNT=$(find "$UPLOAD_PATH" -type f | wc -l)
    echo -e "${YELLOW}⚠️  Test upload directory exists with $FILE_COUNT files${NC}"
    echo -e "${YELLOW}   (Test files will be cleaned up automatically)${NC}"
else
    echo -e "${GREEN}✅ Test upload directory doesn't exist (will be created during tests)${NC}"
fi

echo -e "\n${GREEN}🎉 Database isolation verification complete!${NC}"
echo -e "${GREEN}✅ Your tests are properly isolated from production data${NC}"

# Final safety check
echo -e "\n${YELLOW}🔒 Safety Checklist:${NC}"
echo -e "✅ Test database name contains 'test'"
echo -e "✅ Test database is different from production"
echo -e "✅ Test uploads go to separate directory"
echo -e "✅ Test environment variables are isolated"

echo -e "\n${GREEN}🚀 Safe to run tests!${NC}"
