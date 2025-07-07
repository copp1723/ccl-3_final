// Memory optimization configuration
export const memoryOptimizationConfig = {
  // Reduce performance monitor snapshots
  performance: {
    maxSnapshots: 60, // Only keep 1 hour instead of 24 hours
    snapshotInterval: 300000, // Every 5 minutes instead of every minute
  },
  
  // Session store optimization
  session: {
    checkPeriod: 3600000, // Check expired sessions every hour instead of 24 hours
    maxAge: 86400000, // 1 day instead of 7 days
    pruneSessionInterval: 600000, // Prune old sessions every 10 minutes
  },
  
  // Health check optimization
  healthCheck: {
    interval: 600000, // 10 minutes instead of 5 minutes
    lightweight: true, // Skip heavy checks
  },
  
  // Redis optimization
  redis: {
    useSingleClient: true, // Use one client for all purposes
    lazyConnect: true,
  },
  
  // Agent optimization
  agents: {
    maxCacheSize: 100, // Limit response cache
    cacheTimeout: 300000, // 5 minute cache timeout
  },
  
  // General Node.js optimization
  node: {
    // Force garbage collection periodically
    gcInterval: 60000, // Every minute
    // Limit string size
    maxStringLength: 1000000, // 1MB max string
  }
};