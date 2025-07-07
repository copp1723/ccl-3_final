// Production configuration for low-memory environments
export const productionConfig = {
  // Disable memory-intensive features in low-memory environments
  features: {
    enableRedis: process.env.ENABLE_REDIS !== 'false',
    enableQueueSystem: process.env.ENABLE_QUEUE !== 'false', 
    enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    enablePerformanceMonitoring: false, // Disable by default in production
  },
  
  // Reduce memory usage
  performance: {
    maxConcurrentRequests: 50,
    requestTimeout: 30000,
    keepAliveTimeout: 65000,
  },
  
  // Health check configuration
  healthCheck: {
    interval: 300000, // 5 minutes instead of every minute
    timeout: 10000,
    // Only check critical services
    checks: ['database', 'memory', 'cpu'],
  },
  
  // Redis configuration
  redis: {
    maxRetriesPerRequest: 1, // Fail fast if Redis is not available
    enableOfflineQueue: false,
    connectTimeout: 5000,
  },
  
  // Memory limits
  memory: {
    maxHeapUsagePercent: 85,
    gcInterval: 60000, // Run garbage collection every minute
  }
};