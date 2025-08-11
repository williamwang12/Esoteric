#!/bin/bash

echo "🧪 Running Comprehensive Backend Test Suite"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test_suite() {
    local test_name="$1"
    local test_file="$2"
    
    echo ""
    echo -e "${BLUE}Running $test_name tests...${NC}"
    echo "----------------------------------------"
    
    # Clean up test database before each suite
    rm -f test.db
    
    # Run the test
    if npm run "test:$test_file" > test_output.log 2>&1; then
        echo -e "${GREEN}✅ $test_name tests PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Extract test count from output
        local test_count=$(grep -o "[0-9]* passed" test_output.log | head -1 | cut -d' ' -f1)
        if [ ! -z "$test_count" ]; then
            TOTAL_TESTS=$((TOTAL_TESTS + test_count))
        fi
    else
        echo -e "${RED}❌ $test_name tests FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "Error details:"
        tail -20 test_output.log
        
        # Still extract passed test count
        local passed_count=$(grep -o "[0-9]* passed" test_output.log | head -1 | cut -d' ' -f1)
        local failed_count=$(grep -o "[0-9]* failed" test_output.log | head -1 | cut -d' ' -f1)
        
        if [ ! -z "$passed_count" ]; then
            TOTAL_TESTS=$((TOTAL_TESTS + passed_count))
        fi
        if [ ! -z "$failed_count" ]; then
            TOTAL_TESTS=$((TOTAL_TESTS + failed_count))
        fi
    fi
    
    rm -f test_output.log
}

# Run individual test suites
run_test_suite "Comprehensive API" "comprehensive"
run_test_suite "Simple API" "simple"

# Summary
echo ""
echo "=========================================="
echo -e "${BLUE}📊 Test Summary${NC}"
echo "=========================================="
echo -e "Total Tests Run: ${YELLOW}$TOTAL_TESTS${NC}"
echo -e "Test Suites Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Test Suites Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All test suites passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some test suites failed. Check the details above.${NC}"
    exit 1
fi