import pkg from 'lru-cache';
const { LRUCache } = pkg;
import crypto from 'crypto';
import { logger } from './logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalQueries: number;
  avgResponseTime: number;
}

export class DatabaseCache {
  private cache: LRUCache<string, CacheEntry<any>>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalQueries: 0,
    avgResponseTime: 0
  };
  private responseTimes: number[] = [];

  constructor(options?: {
    maxSize?: number;
    ttl?: number;
  }) {
    this.cache = new LRUCache<string, CacheEntry<any>>({
      max: options?.maxSize || 500, // Max 500 cached queries
      ttl: options?.ttl || 1000 * 60, // 1 minute default TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Log cache stats every 5 minutes
    setInterval(() => {
      if (this.stats.totalQueries > 0) {
        logger.info('DB Cache Stats', {
          ...this.stats,
          cacheSize: this.cache.size,
          avgResponseTimeMs: this.stats.avgResponseTime.toFixed(2)
        });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Generate a cache key for database queries
   */
  generateKey(queryType: string, params?: any): string {
    const keyData = {
      type: queryType,
      params: params || {}
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');

    return `db:${queryType}:${hash.substring(0, 16)}`;
  }

  /**
   * Get cached query result if available
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (entry) {
      this.stats.hits++;
      entry.hitCount++;
      this.updateStats();
      
      logger.debug('DB cache hit', {
        key,
        hitCount: entry.hitCount,
        age: Date.now() - entry.timestamp
      });
      
      return entry.data;
    }
    
    this.stats.misses++;
    this.updateStats();
    return null;
  }

  /**
   * Store query result in cache
   */
  set<T>(key: string, data: T, responseTime?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      hitCount: 0
    };

    this.cache.set(key, entry);

    // Track response times
    if (responseTime !== undefined) {
      this.responseTimes.push(responseTime);
      // Keep only last 100 response times
      if (this.responseTimes.length > 100) {
        this.responseTimes.shift();
      }
      this.updateAvgResponseTime();
    }

    logger.debug('DB query cached', { key });
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: string): number {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      logger.info(`Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
    }
    
    return keysToDelete.length;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cleared all DB cache entries');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { cacheSize: number } {
    return {
      ...this.stats,
      cacheSize: this.cache.size
    };
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.totalQueries = this.stats.hits + this.stats.misses;
    if (this.stats.totalQueries > 0) {
      this.stats.hitRate = (this.stats.hits / this.stats.totalQueries) * 100;
    }
  }

  /**
   * Update average response time
   */
  private updateAvgResponseTime(): void {
    if (this.responseTimes.length > 0) {
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.stats.avgResponseTime = sum / this.responseTimes.length;
    }
  }

  /**
   * Wrapper for caching database queries
   */
  async withCache<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    options?: {
      ttl?: number;
      invalidateOn?: string[];
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    // Check cache first
    const cached = this.get<T>(cacheKey);
    if (cached !== null) {
      // Add small delay to simulate DB response time for consistency
      await new Promise(resolve => setTimeout(resolve, 5));
      return cached;
    }

    // Execute query
    try {
      const result = await queryFn();
      const responseTime = Date.now() - startTime;
      
      // Cache successful results
      if (result !== null && result !== undefined) {
        this.set(cacheKey, result, responseTime);
      }
      
      return result;
    } catch (error) {
      logger.error('DB query error, not caching', { error, cacheKey });
      throw error;
    }
  }
}

// Global cache instance
export const dbCache = new DatabaseCache({
  maxSize: parseInt(process.env.DB_CACHE_MAX_SIZE || '500'),
  ttl: parseInt(process.env.DB_CACHE_TTL || String(60 * 1000)) // 1 minute default
});

// Cache key generators for common queries
export const cacheKeys = {
  dashboardStats: () => dbCache.generateKey('dashboard_stats'),
  agentStatus: (agentId?: string) => dbCache.generateKey('agent_status', { agentId }),
  leadPipeline: () => dbCache.generateKey('lead_pipeline'),
  recentActivity: (limit?: number) => dbCache.generateKey('recent_activity', { limit }),
  systemMetrics: () => dbCache.generateKey('system_metrics'),
  leadById: (id: string) => dbCache.generateKey('lead_by_id', { id }),
  campaignStats: (campaignId?: string) => dbCache.generateKey('campaign_stats', { campaignId })
};

// Cache invalidation helpers
export const invalidateCache = {
  leads: () => {
    dbCache.invalidate('lead');
    dbCache.invalidate('dashboard_stats');
    dbCache.invalidate('pipeline');
  },
  agents: () => {
    dbCache.invalidate('agent');
    dbCache.invalidate('dashboard_stats');
  },
  campaigns: () => {
    dbCache.invalidate('campaign');
    dbCache.invalidate('dashboard_stats');
  },
  all: () => dbCache.clear()
};

export default DatabaseCache;