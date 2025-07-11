#!/bin/bash

echo "🔧 CCL-3 Environment Setup & Diagnostic Script"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in CCL-3 directory"
    echo "Please run this from the CCL-3 directory"
    exit 1
fi

# Check Node.js installation
echo "1. Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

# Check npm installation
echo ""
echo "2. Checking npm installation..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm installed: $NPM_VERSION"
else
    echo "❌ npm is not installed"
    exit 1
fi

# Check environment files
echo ""
echo "3. Checking environment files..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
else
    echo "⚠️  .env file missing - creating from .env.example"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
    else
        echo "❌ .env.example file not found"
    fi
fi

# Check for required environment variables
echo ""
echo "4. Checking environment variables..."
if [ -f ".env" ]; then
    # Check for DATABASE_URL
    if grep -q "DATABASE_URL=" .env; then
        if grep -q "DATABASE_URL=$" .env || grep -q "DATABASE_URL=\"\"" .env; then
            echo "⚠️  DATABASE_URL is empty - the app will use mock data"
        else
            echo "✅ DATABASE_URL is configured"
        fi
    else
        echo "⚠️  DATABASE_URL is not set - adding placeholder"
        echo "DATABASE_URL=" >> .env
    fi
    
    # Check for PORT
    if grep -q "PORT=" .env; then
        echo "✅ PORT is configured"
    else
        echo "⚠️  PORT is not set - adding default (5000)"
        echo "PORT=5000" >> .env
    fi
fi

# Check if dependencies are installed
echo ""
echo "5. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "✅ Dependencies installed"
else
    echo "⚠️  Dependencies not installed"
    echo "Installing dependencies..."
    npm install
fi

# Check client dependencies
echo ""
echo "6. Checking client dependencies..."
if [ -d "client/node_modules" ]; then
    echo "✅ Client dependencies installed"
else
    echo "⚠️  Client dependencies not installed"
    echo "Installing client dependencies..."
    cd client && npm install && cd ..
fi

# Create required directories
echo ""
echo "7. Creating required directories..."
mkdir -p logs
mkdir -p dist
echo "✅ Required directories created"

# Test server startup
echo ""
echo "8. Testing server startup..."
echo "Starting server in test mode..."
timeout 5s npm run dev > server-test.log 2>&1 &
SERVER_PID=$!
sleep 3

if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server starts successfully"
    kill $SERVER_PID 2>/dev/null
else
    echo "❌ Server failed to start"
    echo "Check server-test.log for errors"
fi

# Final summary
echo ""
echo "=============================================="
echo "Setup Summary:"
echo ""

if [ -f ".env" ] && [ -d "node_modules" ] && [ -d "client/node_modules" ]; then
    echo "✅ Environment is properly configured"
    echo ""
    echo "Next steps:"
    echo "1. Start the backend: npm run dev"
    echo "2. In a new terminal, start the frontend: cd client && npm run dev"
    echo "3. Open http://localhost:5173 in your browser"
else
    echo "❌ Environment setup incomplete"
    echo "Please fix the issues above and run this script again"
fi

echo ""
echo "To test API endpoints after starting the server:"
echo "node test-api-health.js"
echo ""
