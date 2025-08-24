#!/bin/bash

# Backend Test Runner Script for Esoteric Enterprises
# This script runs various test suites and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Esoteric Enterprises Backend Test Runner${NC}"
echo "=============================================="

# Check if Jest is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Function to run a specific test suite
run_test_suite() {
    local test_name="$1"
    local test_file="$2"
    local description="$3"
    
    echo -e "\n${BLUE}🔍 Running $test_name${NC}"
    echo -e "${YELLOW}$description${NC}"
    echo "---"
    
    if npx jest "$test_file" --detectOpenHandles --forceExit --runInBand --verbose; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
}

# Function to run test with coverage
run_with_coverage() {
    local test_file="$1"
    local test_name="$2"
    
    echo -e "\n${BLUE}📊 Running $test_name with coverage${NC}"
    echo "---"
    
    npx jest "$test_file" --coverage --detectOpenHandles --forceExit --runInBand
}

# Parse command line arguments
case "${1:-all}" in
    "requests")
        echo -e "${YELLOW}Running Withdrawal and Meeting Requests tests only${NC}"
        run_test_suite "Withdrawal & Meeting Requests" "tests/requests.test.js" "Tests the new withdrawal and meeting request functionality"
        ;;
    "security")
        echo -e "${YELLOW}Running Security and 2FA tests only${NC}"
        run_test_suite "Security & 2FA" "tests/security-2fa.test.js" "Tests authentication, 2FA, and security features"
        ;;
    "enhanced")
        echo -e "${YELLOW}Running Enhanced Comprehensive tests only${NC}"
        run_test_suite "Enhanced Comprehensive" "tests/enhanced-comprehensive.test.js" "Tests all backend functionality with enhanced coverage"
        ;;
    "existing")
        echo -e "${YELLOW}Running existing test suites${NC}"
        run_test_suite "Simple API" "tests/simple-api.test.js" "Basic API endpoint tests"
        run_test_suite "Comprehensive" "tests/comprehensive.test.js" "Full feature tests"
        run_test_suite "2FA Comprehensive" "tests/2fa-comprehensive.test.js" "2FA and authentication tests"
        ;;
    "coverage")
        echo -e "${YELLOW}Running all tests with coverage report${NC}"
        run_with_coverage "tests/" "All Tests"
        ;;
    "new")
        echo -e "${YELLOW}Running new test suites only${NC}"
        run_test_suite "Withdrawal & Meeting Requests" "tests/requests.test.js" "Tests the new withdrawal and meeting request functionality"
        run_test_suite "Security & 2FA" "tests/security-2fa.test.js" "Tests authentication, 2FA, and security features"
        run_test_suite "Enhanced Comprehensive" "tests/enhanced-comprehensive.test.js" "Tests all backend functionality with enhanced coverage"
        ;;
    "quick")
        echo -e "${YELLOW}Running quick test suite${NC}"
        run_test_suite "Requests" "tests/requests.test.js" "Quick test of new functionality"
        ;;
    "all")
        echo -e "${YELLOW}Running all test suites${NC}"
        
        # Track test results
        PASSED=0
        FAILED=0
        
        # Run existing tests
        echo -e "\n${BLUE}📚 EXISTING TEST SUITES${NC}"
        if run_test_suite "Simple API" "tests/simple-api.test.js" "Basic API endpoint tests"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
        
        if run_test_suite "Comprehensive" "tests/comprehensive.test.js" "Full feature tests"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
        
        if run_test_suite "2FA Comprehensive" "tests/2fa-comprehensive.test.js" "2FA and authentication tests"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
        
        # Run new tests
        echo -e "\n${BLUE}🆕 NEW TEST SUITES${NC}"
        if run_test_suite "Withdrawal & Meeting Requests" "tests/requests.test.js" "Tests the new withdrawal and meeting request functionality"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
        
        if run_test_suite "Security & 2FA" "tests/security-2fa.test.js" "Tests authentication, 2FA, and security features"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
        
        if run_test_suite "Enhanced Comprehensive" "tests/enhanced-comprehensive.test.js" "Tests all backend functionality with enhanced coverage"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
        
        # Summary
        echo -e "\n${BLUE}📋 TEST SUMMARY${NC}"
        echo "==============="
        echo -e "${GREEN}✅ Passed: $PASSED${NC}"
        echo -e "${RED}❌ Failed: $FAILED${NC}"
        echo -e "Total: $((PASSED + FAILED))"
        
        if [ $FAILED -eq 0 ]; then
            echo -e "\n${GREEN}🎉 All tests passed successfully!${NC}"
            exit 0
        else
            echo -e "\n${RED}💥 Some tests failed. Please review the output above.${NC}"
            exit 1
        fi
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [test_suite]"
        echo ""
        echo "Available test suites:"
        echo "  all         - Run all test suites (default)"
        echo "  requests    - Run withdrawal and meeting requests tests"
        echo "  security    - Run security and 2FA tests"
        echo "  enhanced    - Run enhanced comprehensive tests"
        echo "  existing    - Run existing test suites only"
        echo "  new         - Run new test suites only"
        echo "  quick       - Run quick test suite"
        echo "  coverage    - Run all tests with coverage report"
        echo "  help        - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                  # Run all tests"
        echo "  $0 requests         # Run only request functionality tests"
        echo "  $0 coverage         # Run all tests with coverage report"
        ;;
    *)
        echo -e "${RED}❌ Unknown test suite: $1${NC}"
        echo "Use '$0 help' to see available options."
        exit 1
        ;;
esac

echo -e "\n${GREEN}🏁 Test execution completed!${NC}"