#!/bin/bash

# CCL-3 Quick Start Script
echo "🚀 CCL-3 Quick Start"
echo "==================="
echo ""

# Navigate to project directory
cd /Users/copp1723/Desktop/CCL-3

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing server dependencies..."
    npm install
fi

if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing client dependencies..."
    cd client && npm install && cd ..
fi

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env 2>/dev/null || echo "PORT=5000" > .env
fi

# Start servers
echo ""
echo "🖥️  Starting servers..."
echo ""
echo "Backend will run on: http://localhost:5000"
echo "Frontend will run on: http://localhost:5173"
echo ""

# Open two terminal tabs/windows
if command -v osascript &> /dev/null; then
    # macOS
    osascript -e 'tell application "Terminal" to do script "cd /Users/copp1723/Desktop/CCL-3 && npm run dev"'
    sleep 2
    osascript -e 'tell application "Terminal" to do script "cd /Users/copp1723/Desktop/CCL-3/client && npm run dev"'
else
    # Linux/other
    echo "Please run these commands in separate terminals:"
    echo "Terminal 1: npm run dev"
    echo "Terminal 2: cd client && npm run dev"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "The application should open automatically in your browser."
echo "If not, navigate to http://localhost:5173"
echo ""
echo "To test API endpoints: node test-api-health.js"
