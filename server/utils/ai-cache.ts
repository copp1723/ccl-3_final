import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import { logger } from './logger';

interface CacheEntry {
  response: any;
  timestamp: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSaved: number;
  costSavings: number;
}

export class AIResponseCache {
  private cache: LRUCache<string, CacheEntry>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSaved: 0,
    costSavings: 0
  };

  // Estimated costs per 1K tokens
  private readonly COST_PER_REQUEST = {
    'openai/gpt-4o-mini': 0.0006,
    'openai/gpt-4o': 0.01,
    'anthropic/claude-3-5-sonnet': 0.015
  };

  constructor(options?: {
    maxSize?: number;
    ttl?: number;
  }) {
    this.cache = new LRUCache<string, CacheEntry>({
      max: options?.maxSize || 1000, // Max 1000 cached responses
      ttl: options?.ttl || 1000 * 60 * 5, // 5 minutes default TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Log cache stats every 5 minutes
    setInterval(() => {
      if (this.stats.hits + this.stats.misses > 0) {
        logger.info('AI Cache Stats', {
          ...this.stats,
          cacheSize: this.cache.size
        });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Generate a cache key based on agent type, prompt, and context
   */
  generateKey(params: {
    agentType: string;
    prompt: string;
    context?: Record<string, any>;
    model?: string;
  }): string {
    const keyData = {
      agent: params.agentType,
      prompt: params.prompt,
      // Only include relevant context that affects the response
      context: params.context ? this.normalizeContext(params.context) : {},
      model: params.model
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');

    return `ai:${params.agentType}:${hash.substring(0, 16)}`;
  }

  /**
   * Normalize context to only include fields that affect AI response
   */
  private normalizeContext(context: Record<string, any>): Record<string, any> {
    const relevantFields = [
      'leadStatus',
      'campaignGoals',
      'conversationStage',
      'customerType',
      'previousMessageCount'
    ];

    const normalized: Record<string, any> = {};
    for (const field of relevantFields) {
      if (context[field] !== undefined) {
        normalized[field] = context[field];
      }
    }
    return normalized;
  }

  /**
   * Get cached response if available
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.stats.hits++;
      entry.hitCount++;
      this.updateStats();
      
      logger.debug('AI cache hit', {
        key,
        hitCount: entry.hitCount,
        age: Date.now() - entry.timestamp
      });
      
      return entry.response;
    }
    
    this.stats.misses++;
    this.updateStats();
    return null;
  }

  /**
   * Store response in cache
   */
  set(key: string, response: any, model?: string): void {
    const entry: CacheEntry = {
      response,
      timestamp: Date.now(),
      hitCount: 0
    };

    this.cache.set(key, entry);

    // Track cost savings
    if (model && this.COST_PER_REQUEST[model as keyof typeof this.COST_PER_REQUEST]) {
      this.stats.totalSaved++;
      this.stats.costSavings += this.COST_PER_REQUEST[model as keyof typeof this.COST_PER_REQUEST];
    }

    logger.debug('AI response cached', { key, model });
  }

  /**
   * Clear cache for specific agent or all
   */
  clear(agentType?: string): void {
    if (agentType) {
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`ai:${agentType}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.info(`Cleared ${keysToDelete.length} cache entries for ${agentType}`);
    } else {
      this.cache.clear();
      logger.info('Cleared all AI cache entries');
    }
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
   * Update hit rate statistics
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    if (total > 0) {
      this.stats.hitRate = (this.stats.hits / total) * 100;
    }
  }

  /**
   * Middleware for caching AI responses
   */
  async withCache<T>(
    key: string,
    model: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached as T;
    }

    // Fetch fresh response
    try {
      const response = await fetchFn();
      
      // Cache successful responses
      if (response) {
        this.set(key, response, model);
      }
      
      return response;
    } catch (error) {
      logger.error('AI fetch error, not caching', { error, key });
      throw error;
    }
  }
}

// Global cache instance
export const aiCache = new AIResponseCache({
  maxSize: parseInt(process.env.AI_CACHE_MAX_SIZE || '1000'),
  ttl: parseInt(process.env.AI_CACHE_TTL || String(5 * 60 * 1000))
});

// Export for testing
export default AIResponseCache;