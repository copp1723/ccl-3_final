#!/bin/bash
# Production startup script with memory optimization

# Set memory-saving environment variables
export NODE_OPTIONS="--max-old-space-size=256"
export ENABLE_REDIS=true
export ENABLE_QUEUE=false
export ENABLE_HEALTH_CHECKS=false
export ENABLE_METRICS=false
export ENABLE_PERFORMANCE_MONITORING=false

echo "Starting CCL-3 in production mode with memory optimization..."
echo "Memory limit: 256MB"
echo "Features disabled: queue, health checks, metrics, performance monitoring"

# Run the application
node dist/index.js