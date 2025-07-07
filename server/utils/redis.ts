// Redis connection and configuration for CCL-3
// Handles caching, rate limiting, and session storage

import Redis from 'ioredis';
import { logger, CCLLogger } from './logger.js';

// Get Redis configuration from environment
const getRedisConfig = () => {
  // If REDIS_URL is provided (like from Render), it takes precedence
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  
  // Otherwise, use individual settings
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  };
};

// Redis connection options
const redisOptions = {
  ...(typeof getRedisConfig() === 'string' ? {} : getRedisConfig()),
  retryStrategy: (times: number) => {
    if (times > 3) {
      logger.warn('Redis connection failed after 3 retries, falling back to memory storage');
      return null;
    }
    const delay = Math.min(times * 200, 3000);
    logger.info(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  enableOfflineQueue: false,
  keyPrefix: 'ccl3:',
};

// Create Redis instances for different purposes
export let redisClient: Redis | null = null;
export let rateLimitRedis: Redis | null = null;
export let sessionRedis: Redis | null = null;

// Initialize Redis connections
export async function initializeRedis(): Promise<void> {
  try {
    const config = getRedisConfig();
    
    // Main Redis client for general caching
    redisClient = typeof config === 'string' 
      ? new Redis(config, redisOptions)
      : new Redis(redisOptions);
    
    // Dedicated instance for rate limiting (different key prefix)
    rateLimitRedis = typeof config === 'string'
      ? new Redis(config, {
          ...redisOptions,
          keyPrefix: 'ccl3:ratelimit:',
        })
      : new Redis({
          ...redisOptions,
          keyPrefix: 'ccl3:ratelimit:',
        });
    
    // Dedicated instance for sessions (different DB)
    sessionRedis = typeof config === 'string'
      ? new Redis(config, {
          ...redisOptions,
          keyPrefix: 'ccl3:session:',
        })
      : new Redis({
          ...redisOptions,
          keyPrefix: 'ccl3:session:',
          db: 1, // Use different database for sessions
        });

    // Setup event handlers for main client
    redisClient.on('connect', () => {
      logger.info('Redis main client connected');
      CCLLogger.securityEvent('Redis connection established', 'low', { type: 'main' });
    });

    redisClient.on('error', (error) => {
      logger.error('Redis main client error', { error: error.message });
      CCLLogger.securityEvent('Redis connection error', 'medium', { type: 'main', error: error.message });
    });

    redisClient.on('close', () => {
      logger.warn('Redis main client connection closed');
    });

    // Setup event handlers for rate limit client
    rateLimitRedis.on('connect', () => {
      logger.info('Redis rate limit client connected');
    });

    rateLimitRedis.on('error', (error) => {
      logger.error('Redis rate limit client error', { error: error.message });
    });

    // Setup event handlers for session client
    sessionRedis.on('connect', () => {
      logger.info('Redis session client connected');
    });

    sessionRedis.on('error', (error) => {
      logger.error('Redis session client error', { error: error.message });
    });

    // Test connections
    await Promise.all([
      redisClient.ping(),
      rateLimitRedis.ping(),
      sessionRedis.ping()
    ]);

    logger.info('All Redis clients initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize Redis', { error: (error as Error).message });
    
    // Reset clients to null if initialization fails
    redisClient = null;
    rateLimitRedis = null;
    sessionRedis = null;
    
    // CCL-3 can operate without Redis, but with reduced functionality
    logger.warn('CCL-3 will operate in memory-only mode (no Redis)');
    CCLLogger.securityEvent('Redis initialization failed, using memory fallback', 'medium', {
      error: (error as Error).message
    });
  }
}

// Graceful shutdown for Redis connections
export async function closeRedisConnections(): Promise<void> {
  try {
    const closePromises = [];
    
    if (redisClient) {
      closePromises.push(redisClient.quit());
    }
    
    if (rateLimitRedis) {
      closePromises.push(rateLimitRedis.quit());
    }
    
    if (sessionRedis) {
      closePromises.push(sessionRedis.quit());
    }
    
    await Promise.all(closePromises);
    logger.info('All Redis connections closed gracefully');
    
  } catch (error) {
    logger.error('Error closing Redis connections', { error: (error as Error).message });
  }
}

// CCL-3 specific Redis operations
export class CCLRedisOperations {
  // Lead processing cache
  static async cacheLeadProcessing(leadId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.setex(`lead:processing:${leadId}`, ttlSeconds, JSON.stringify(data));
      logger.debug('Lead processing data cached', { leadId, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Failed to cache lead processing data', { 
        leadId, 
        error: (error as Error).message 
      });
    }
  }

  static async getLeadProcessing(leadId: string): Promise<any | null> {
    if (!redisClient) return null;
    
    try {
      const data = await redisClient.get(`lead:processing:${leadId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to retrieve lead processing data', { 
        leadId, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  // Agent decision cache
  static async cacheAgentDecision(leadId: string, agentType: string, decision: any, ttlSeconds: number = 1800): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.setex(`agent:decision:${agentType}:${leadId}`, ttlSeconds, JSON.stringify(decision));
      logger.debug('Agent decision cached', { leadId, agentType, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Failed to cache agent decision', { 
        leadId, 
        agentType, 
        error: (error as Error).message 
      });
    }
  }

  static async getAgentDecision(leadId: string, agentType: string): Promise<any | null> {
    if (!redisClient) return null;
    
    try {
      const data = await redisClient.get(`agent:decision:${agentType}:${leadId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to retrieve agent decision', { 
        leadId, 
        agentType, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  // Campaign data cache
  static async cacheCampaignData(campaignId: string, data: any, ttlSeconds: number = 7200): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.setex(`campaign:data:${campaignId}`, ttlSeconds, JSON.stringify(data));
      logger.debug('Campaign data cached', { campaignId, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Failed to cache campaign data', { 
        campaignId, 
        error: (error as Error).message 
      });
    }
  }

  static async getCampaignData(campaignId: string): Promise<any | null> {
    if (!redisClient) return null;
    
    try {
      const data = await redisClient.get(`campaign:data:${campaignId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to retrieve campaign data', { 
        campaignId, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  // External service response cache (for reducing API calls)
  static async cacheExternalResponse(service: string, key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.setex(`external:${service}:${key}`, ttlSeconds, JSON.stringify(data));
      logger.debug('External service response cached', { service, key, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Failed to cache external service response', { 
        service, 
        key, 
        error: (error as Error).message 
      });
    }
  }

  static async getExternalResponse(service: string, key: string): Promise<any | null> {
    if (!redisClient) return null;
    
    try {
      const data = await redisClient.get(`external:${service}:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to retrieve external service response', { 
        service, 
        key, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  // Rate limiting helpers
  static async incrementRateLimit(key: string, windowSeconds: number): Promise<{ count: number; ttl: number }> {
    if (!rateLimitRedis) {
      // Fallback to in-memory for development
      return { count: 1, ttl: windowSeconds };
    }
    
    try {
      const pipeline = rateLimitRedis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      pipeline.ttl(key);
      
      const results = await pipeline.exec();
      
      const count = results?.[0]?.[1] as number || 1;
      const ttl = results?.[2]?.[1] as number || windowSeconds;
      
      return { count, ttl };
    } catch (error) {
      logger.error('Failed to increment rate limit', { 
        key, 
        error: (error as Error).message 
      });
      return { count: 1, ttl: windowSeconds };
    }
  }

  // Circuit breaker state management
  static async setCircuitBreakerState(name: string, state: 'open' | 'closed' | 'half-open', ttlSeconds: number = 300): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.setex(`circuit:${name}:state`, ttlSeconds, state);
      await redisClient.setex(`circuit:${name}:timestamp`, ttlSeconds, Date.now().toString());
      logger.debug('Circuit breaker state updated', { name, state, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Failed to set circuit breaker state', { 
        name, 
        state, 
        error: (error as Error).message 
      });
    }
  }

  static async getCircuitBreakerState(name: string): Promise<{ state: string | null; timestamp: number | null }> {
    if (!redisClient) return { state: null, timestamp: null };
    
    try {
      const [state, timestamp] = await Promise.all([
        redisClient.get(`circuit:${name}:state`),
        redisClient.get(`circuit:${name}:timestamp`)
      ]);
      
      return {
        state,
        timestamp: timestamp ? parseInt(timestamp) : null
      };
    } catch (error) {
      logger.error('Failed to get circuit breaker state', { 
        name, 
        error: (error as Error).message 
      });
      return { state: null, timestamp: null };
    }
  }

  // Failure tracking for circuit breakers
  static async incrementFailures(name: string, windowSeconds: number = 300): Promise<number> {
    if (!redisClient) return 1;
    
    try {
      const key = `circuit:${name}:failures`;
      const pipeline = redisClient.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      
      const results = await pipeline.exec();
      return results?.[0]?.[1] as number || 1;
    } catch (error) {
      logger.error('Failed to increment circuit breaker failures', { 
        name, 
        error: (error as Error).message 
      });
      return 1;
    }
  }

  static async getFailureCount(name: string): Promise<number> {
    if (!redisClient) return 0;
    
    try {
      const count = await redisClient.get(`circuit:${name}:failures`);
      return count ? parseInt(count) : 0;
    } catch (error) {
      logger.error('Failed to get circuit breaker failure count', { 
        name, 
        error: (error as Error).message 
      });
      return 0;
    }
  }

  static async resetFailures(name: string): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.del(`circuit:${name}:failures`);
      logger.debug('Circuit breaker failures reset', { name });
    } catch (error) {
      logger.error('Failed to reset circuit breaker failures', { 
        name, 
        error: (error as Error).message 
      });
    }
  }
}

// Health check for Redis
export async function checkRedisHealth(): Promise<{
  main: boolean;
  rateLimit: boolean;
  session: boolean;
}> {
  const health = {
    main: false,
    rateLimit: false,
    session: false
  };

  try {
    if (redisClient) {
      await redisClient.ping();
      health.main = true;
    }
  } catch (error) {
    logger.error('Redis main client health check failed', { error: (error as Error).message });
  }

  try {
    if (rateLimitRedis) {
      await rateLimitRedis.ping();
      health.rateLimit = true;
    }
  } catch (error) {
    logger.error('Redis rate limit client health check failed', { error: (error as Error).message });
  }

  try {
    if (sessionRedis) {
      await sessionRedis.ping();
      health.session = true;
    }
  } catch (error) {
    logger.error('Redis session client health check failed', { error: (error as Error).message });
  }

  return health;
}

export default {
  initializeRedis,
  closeRedisConnections,
  checkRedisHealth,
  CCLRedisOperations,
  redisClient,
  rateLimitRedis,
  sessionRedis
};