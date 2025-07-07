#!/bin/bash
# Ultra-optimized production startup script for minimal memory usage

# Set memory limit based on your Render plan
# For Starter plans: 512MB
# For Standard plans: 2GB
# For Professional plans: 4GB+
export NODE_OPTIONS="--max-old-space-size=450 --optimize-for-size --gc-interval=100"

# Disable ALL non-essential features
export ENABLE_REDIS=${ENABLE_REDIS:-false}
export ENABLE_QUEUE=${ENABLE_QUEUE:-false}
export ENABLE_HEALTH_CHECKS=false
export ENABLE_METRICS=false
export ENABLE_PERFORMANCE_MONITORING=false
export ENABLE_AUDIT_LOGGING=false
export ENABLE_ANALYTICS=false

# Minimal logging
export LOG_LEVEL=error
export LOG_TO_FILE=false

# Reduce session storage
export MAX_SESSIONS=100
export SESSION_TTL=3600000

# Reduce WebSocket connections
export MAX_WS_CONNECTIONS=50

echo "Starting CCL-3 in ultra-optimized production mode..."
echo "Memory limit: 450MB (leaving headroom)"
echo "All monitoring and non-essential features disabled"

# Force aggressive garbage collection
export V8_FLAGS="--optimize-for-size --always-compact --gc-global"

# Run the application
exec node --expose-gc --optimize-for-size dist/index.js