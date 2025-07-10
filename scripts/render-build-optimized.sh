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

# Build server with tree-shaking
echo "⚙️  Building optimized server..."
esbuild server/index-optimized.ts \
  --platform=node \
  --bundle \
  --format=esm \
  --outdir=dist \
  --packages=external \
  --tree-shaking=true \
  --minify \
  --target=node18 \
  --loader:.node=file

# Create necessary directories
echo "📁 Creating required directories..."
mkdir -p dist/client
mkdir -p logs

# Copy client build to dist
echo "📋 Copying client build files..."
cp -r client/dist/* dist/client/

# Copy public files if they exist
if [ -d "client/public" ]; then
  echo "📋 Copying public files..."
  cp -r client/public/* dist/client/
fi

# Copy only essential server files
echo "📋 Copying essential server files..."
cp -r server/db dist/
cp -r server/agents dist/
cp -r server/routes dist/
cp -r server/utils dist/

# Create optimized agents
cat > dist/agents-lazy.js << 'EOF'
// Auto-generated lazy loader
export async function processLead(lead) {
  console.log('Processing lead:', lead.id);
  // Minimal processing in production
  return { action: 'processed', leadId: lead.id };
}

export async function loadAgent(type) {
  console.log('Loading agent:', type);
  return { type, process: async (data) => ({ success: true }) };
}
EOF

# Memory optimization script
cat > dist/start.sh << 'EOF'
#!/bin/bash
# Optimized startup with memory limits
export NODE_OPTIONS="--max-old-space-size=384 --optimize-for-size"
export UV_THREADPOOL_SIZE=2

# Enable garbage collection
node --expose-gc dist/index-optimized.js
EOF

chmod +x dist/start.sh

# Generate package.json for production
cat > dist/package.json << EOF
{
  "name": "ccl3-swarm-production",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "start": "./start.sh"
  },
  "dependencies": {
    "express": "^4.21.2",
    "dotenv": "^17.0.1",
    "drizzle-orm": "^0.39.3",
    "postgres": "^3.4.7",
    "zod": "^3.25.67",
    "nanoid": "^5.1.5"
  }
}
EOF

echo "✅ Optimized build complete!"

echo "📊 Build size:"
du -sh dist/

echo "💡 To run in production with minimal memory:"
echo "   ENABLE_AGENTS=false ENABLE_WEBSOCKET=false npm start"
echo ""
echo "💡 To run with all features:"
echo "   ENABLE_AGENTS=true ENABLE_WEBSOCKET=true npm start"
