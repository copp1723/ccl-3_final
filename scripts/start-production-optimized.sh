#!/bin/bash
# Optimized production startup script for high memory usage

# Set memory limit based on your Render plan
# For Starter plans: 512MB
# For Standard plans: 2GB
# For Professional plans: 4GB+
export NODE_OPTIONS="--max-old-space-size=512"

# Enable only essential features
export ENABLE_REDIS=${ENABLE_REDIS:-true}
export ENABLE_QUEUE=${ENABLE_QUEUE:-false}
export ENABLE_HEALTH_CHECKS=${ENABLE_HEALTH_CHECKS:-false}
export ENABLE_METRICS=${ENABLE_METRICS:-false}
export ENABLE_PERFORMANCE_MONITORING=${ENABLE_PERFORMANCE_MONITORING:-false}

# Disable verbose logging to save memory
export LOG_LEVEL=warn

echo "Starting CCL-3 in optimized production mode..."
echo "Memory limit: 512MB"
echo "Redis enabled: $ENABLE_REDIS"
echo "Non-essential monitoring disabled to save memory"

# Force garbage collection more frequently
export NODE_GC_INTERVAL=100

# Run the application
node dist/index.js