#!/bin/bash

echo "🚀 CCL-3 Pre-Deployment Check"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ERRORS=0
WARNINGS=0

# Function to check command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        ERRORS=$((ERRORS+1))
        return 1
    else
        echo -e "${GREEN}✅ $1 is installed${NC}"
        return 0
    fi
}

# 1. Check required tools
echo -e "\n1. Checking Required Tools..."
check_command node
check_command npm
check_command git

# 2. Check Node version
echo -e "\n2. Checking Node Version..."
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then 
    echo -e "${GREEN}✅ Node version $NODE_VERSION meets requirement (>= $REQUIRED_VERSION)${NC}"
else
    echo -e "${RED}❌ Node version $NODE_VERSION is below requirement (>= $REQUIRED_VERSION)${NC}"
    ERRORS=$((ERRORS+1))
fi

# 3. Validate environment
echo -e "\n3. Validating Environment Variables..."
if [ -f "scripts/validate-env.js" ]; then
    node scripts/validate-env.js
    if [ $? -ne 0 ]; then
        ERRORS=$((ERRORS+1))
    fi
else
    echo -e "${YELLOW}⚠️  Environment validation script not found${NC}"
    WARNINGS=$((WARNINGS+1))
fi

# 4. Check for TypeScript errors
echo -e "\n4. Checking TypeScript Compilation..."
cd client
echo "   Checking client..."
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "error TS" > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${RED}❌ Client has TypeScript errors${NC}"
    ERRORS=$((ERRORS+1))
else
    echo -e "${GREEN}✅ Client TypeScript check passed${NC}"
fi
cd ..

cd server
echo "   Checking server..."
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "error TS" > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${RED}❌ Server has TypeScript errors${NC}"
    ERRORS=$((ERRORS+1))
else
    echo -e "${GREEN}✅ Server TypeScript check passed${NC}"
fi
cd ..

# 5. Check for security vulnerabilities
echo -e "\n5. Checking for Security Vulnerabilities..."
cd client
npm audit --production 2>&1 | grep -E "found [0-9]+ vulnerabilities" > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Client has npm vulnerabilities${NC}"
    WARNINGS=$((WARNINGS+1))
else
    echo -e "${GREEN}✅ Client has no npm vulnerabilities${NC}"
fi
cd ..

# 6. Test build process
echo -e "\n6. Testing Build Process..."
echo "   Testing client build..."
cd client
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Client build successful${NC}"
    rm -rf dist
else
    echo -e "${RED}❌ Client build failed${NC}"
    ERRORS=$((ERRORS+1))
fi
cd ..

# 7. Check for uncommitted changes
echo -e "\n7. Checking Git Status..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
    WARNINGS=$((WARNINGS+1))
else
    echo -e "${GREEN}✅ Working directory is clean${NC}"
fi

# 8. Database migration check
echo -e "\n8. Checking Database Migrations..."
if [ -d "server/db/migrations" ]; then
    MIGRATION_COUNT=$(ls -1 server/db/migrations/*.sql 2>/dev/null | wc -l)
    echo -e "${GREEN}✅ Found $MIGRATION_COUNT migration files${NC}"
else
    echo -e "${YELLOW}⚠️  No migration directory found${NC}"
    WARNINGS=$((WARNINGS+1))
fi

# Summary
echo -e "\n==============================="
echo "DEPLOYMENT READINESS SUMMARY"
echo "==============================="

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ No critical errors found${NC}"
else
    echo -e "${RED}❌ Found $ERRORS critical errors${NC}"
fi

if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ No warnings${NC}"
else
    echo -e "${YELLOW}⚠️  Found $WARNINGS warnings${NC}"
fi

echo -e "\nRecommended next steps:"
if [ $ERRORS -gt 0 ]; then
    echo "1. Fix all critical errors before deployment"
fi
if [ $WARNINGS -gt 0 ]; then
    echo "2. Review and address warnings if needed"
fi
echo "3. Run 'npm test' to ensure all tests pass"
echo "4. Update version numbers if needed"
echo "5. Create a deployment tag: git tag -a v1.0.0 -m 'Release version 1.0.0'"

# Exit with error if critical issues found
if [ $ERRORS -gt 0 ]; then
    exit 1
else
    exit 0
fi