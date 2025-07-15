#!/bin/bash
# scripts/render-build-optimized.sh
set -e

echo "🚀 Starting CCL-3 optimized build process..."

# Check if we should skip heavy dependencies
if [ "$SKIP_HEAVY_DEPS" = "true" ]; then
  echo "📦 Installing minimal dependencies..."
  npm install --production --omit=optional
else
  echo "📦 Installing all dependencies..."
  npm install --production=false
fi

# Build client
echo "🎨 Building client application..."
cd client
npm install --production=false
npx vite build
cd ..

# Create necessary directories first
echo "📁 Creating required directories..."
mkdir -p dist
mkdir -p dist/client
mkdir -p logs

# Don't build server - we'll run TypeScript directly
echo "⚙️  Preparing server files..."
echo "Server will run TypeScript directly via tsx"

# Copy client build to dist
echo "📋 Copying client build files..."
cp -r client/dist/* dist/client/

# Copy public files if they exist
if [ -d "client/public" ]; then
  echo "📋 Copying public files..."
  cp -r client/public/* dist/client/
fi

# Production uses the same server code as development
# The only difference is NODE_ENV=production

echo "✅ Optimized build complete!"

echo "📊 Build size:"
du -sh dist/

echo "💡 To run in production with minimal memory:"
echo "   ENABLE_AGENTS=false ENABLE_WEBSOCKET=false npm start"
echo ""
echo "💡 To run with all features:"
echo "   ENABLE_AGENTS=true ENABLE_WEBSOCKET=true npm start"
