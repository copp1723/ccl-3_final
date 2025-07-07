#!/bin/bash
# Production startup script

# Set appropriate memory limit based on your plan
# Adjust this based on your Render plan's available memory
export NODE_OPTIONS="--max-old-space-size=1024"

# Enable all features for paid plans
export ENABLE_REDIS=${ENABLE_REDIS:-true}
export ENABLE_QUEUE=${ENABLE_QUEUE:-true}
export ENABLE_HEALTH_CHECKS=${ENABLE_HEALTH_CHECKS:-true}
export ENABLE_METRICS=${ENABLE_METRICS:-true}
export ENABLE_PERFORMANCE_MONITORING=${ENABLE_PERFORMANCE_MONITORING:-true}

echo "Starting CCL-3 in production mode with full features..."
echo "Memory limit: 1GB (adjust based on your plan)"
echo "Redis enabled: $ENABLE_REDIS"
echo "Queue system enabled: $ENABLE_QUEUE"
echo "Health checks enabled: $ENABLE_HEALTH_CHECKS"
echo "Metrics enabled: $ENABLE_METRICS"
echo "Performance monitoring enabled: $ENABLE_PERFORMANCE_MONITORING"

# Run the application
node dist/index.js