#!/bin/bash

echo "=========================================="
echo "Multi-Language Translation Test Runner"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT: This script follows TESTING_WORKFLOW.md"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to prompt for test completion
confirm_test() {
    echo -e "${YELLOW}Did this test pass? (y/n)${NC}"
    read -r response
    if [[ "$response" == "y" ]]; then
        echo -e "${GREEN}✓ Test passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Test failed${NC}"
        return 1
    fi
}

echo "Opening TESTING_WORKFLOW.md for reference..."
echo "Please follow the test cases documented there."
echo ""

# Core functionality tests
echo -e "${YELLOW}=== Error-Specific Test Cases ===${NC}"
echo ""
echo "Error #3: CSV Format vs Text Replacement"
echo "- [ ] Test that full CSV rows are sent to AI providers"
echo "- [ ] Test macro replacement ({{key}}, {{source}}, {{english}}, {{language}}, {{csv_row}})"
echo "- [ ] Verify CSV structure is preserved"
echo ""

# Build tests
echo -e "${YELLOW}=== Build & Lint Tests ===${NC}"
echo "Running: npm run build"
npm run build
confirm_test

echo ""
echo "Running: npm run lint"
npm run lint
confirm_test

echo ""
echo "Running: npm run typecheck"
npm run typecheck
confirm_test

echo ""
echo -e "${YELLOW}=== Reminder ===${NC}"
echo "After testing, please:"
echo "1. Update TESTING_WORKFLOW.md with any new issues found"
echo "2. Document results in the Error-Specific Test Cases section"
echo "3. Add new test cases for any discovered issues"