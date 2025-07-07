// Circuit breaker implementation for CCL-3 SWARM
// Provides protection against cascading failures and external service issues

import { CCLRedisOperations } from './redis.js';
import { logger, CCLLogger } from './logger.js';
import { CCLCustomError, CCLErrorCode } from './error-handler.js';

// Circuit breaker states
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before attempting recovery (ms)
  successThreshold: number; // Number of successes needed to close from half-open
  timeout: number; // Request timeout (ms)
  monitoringPeriod: number; // Period to track failures (ms)
}

// Circuit breaker statistics
export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  rejections: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttempt: number | null;
}

// Default configurations for CCL-3 services
const DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  mailgun: {
    name: 'mailgun',
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    successThreshold: 2,
    timeout: 10000, // 10 seconds
    monitoringPeriod: 60000, // 1 minute
  },
  twilio: {
    name: 'twilio',
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    successThreshold: 2,
    timeout: 10000, // 10 seconds
    monitoringPeriod: 60000, // 1 minute
  },
  openrouter: {
    name: 'openrouter',
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    successThreshold: 2,
    timeout: 15000, // 15 seconds
    monitoringPeriod: 60000, // 1 minute
  },
  boberdoo: {
    name: 'boberdoo',
    failureThreshold: 3,
    recoveryTimeout: 120000, // 2 minutes (lead processing is critical)
    successThreshold: 3,
    timeout: 20000, // 20 seconds
    monitoringPeriod: 300000, // 5 minutes
  },
  database: {
    name: 'database',
    failureThreshold: 10,
    recoveryTimeout: 30000, // 30 seconds
    successThreshold: 5,
    timeout: 5000, // 5 seconds
    monitoringPeriod: 60000, // 1 minute
  },
  websocket: {
    name: 'websocket',
    failureThreshold: 20,
    recoveryTimeout: 10000, // 10 seconds
    successThreshold: 3,
    timeout: 5000, // 5 seconds
    monitoringPeriod: 30000, // 30 seconds
  }
};

// Circuit breaker implementation
export class CCLCircuitBreaker {
  private config: CircuitBreakerConfig;
  private stats: CircuitBreakerStats;
  private halfOpenSuccesses: number = 0;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    // Merge with default config for the service
    const defaultConfig = DEFAULT_CONFIGS[config.name] || DEFAULT_CONFIGS.database;
    this.config = { ...defaultConfig, ...config };
    
    this.stats = {
      state: 'closed',
      failures: 0,
      successes: 0,
      rejections: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      nextAttempt: null,
    };

    // Initialize state from Redis if available
    this.initializeFromRedis();
  }

  private async initializeFromRedis(): Promise<void> {
    try {
      const redisState = await CCLRedisOperations.getCircuitBreakerState(this.config.name);
      if (redisState.state && redisState.timestamp) {
        this.stats.state = redisState.state as CircuitBreakerState;
        this.stats.lastFailureTime = redisState.timestamp;
        
        // Check if we should transition from open to half-open
        if (this.stats.state === 'open' && this.shouldAttemptRecovery()) {
          await this.transitionToHalfOpen();
        }
      }
      
      // Get failure count
      this.stats.failures = await CCLRedisOperations.getFailureCount(this.config.name);
      
    } catch (error) {
      logger.error('Failed to initialize circuit breaker from Redis', {
        name: this.config.name,
        error: (error as Error).message
      });
    }
  }

  // Execute operation with circuit breaker protection
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    // Check if circuit is open
    if (this.stats.state === 'open') {
      if (this.shouldAttemptRecovery()) {
        await this.transitionToHalfOpen();
      } else {
        this.stats.rejections++;
        
        CCLLogger.securityEvent('Circuit breaker rejection', 'medium', {
          service: this.config.name,
          state: this.stats.state,
          failures: this.stats.failures,
          nextAttempt: this.stats.nextAttempt
        });
        
        throw new CCLCustomError(
          `Circuit breaker is open for ${this.config.name}. Service temporarily unavailable.`,
          CCLErrorCode.SYSTEM_OVERLOAD,
          503,
          {
            service: this.config.name,
            state: this.stats.state,
            nextAttempt: this.stats.nextAttempt,
            failures: this.stats.failures
          },
          true,
          true, // Retryable after recovery timeout
          'high'
        );
      }
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise()
      ]);

      // Operation succeeded
      await this.onSuccess();
      
      // Log success for monitoring
      CCLLogger.performance(
        `${this.config.name}_operation`,
        Date.now() - startTime,
        { circuitBreakerState: this.stats.state }
      );

      return result;
      
    } catch (error) {
      // Operation failed
      await this.onFailure(error as Error);
      
      // Log failure for monitoring
      CCLLogger.externalApiError(
        this.config.name,
        'operation',
        error as Error,
        Date.now() - startTime,
        { circuitBreakerState: this.stats.state }
      );

      throw error;
    }
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  private async onSuccess(): Promise<void> {
    this.stats.successes++;
    this.stats.lastSuccessTime = Date.now();

    if (this.stats.state === 'half-open') {
      this.halfOpenSuccesses++;
      
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        await this.transitionToClosed();
      }
    }

    // Log success for debugging
    logger.debug('Circuit breaker operation succeeded', {
      service: this.config.name,
      state: this.stats.state,
      halfOpenSuccesses: this.halfOpenSuccesses,
      successThreshold: this.config.successThreshold
    });
  }

  private async onFailure(error: Error): Promise<void> {
    this.stats.failures++;
    this.stats.lastFailureTime = Date.now();

    // Increment failure count in Redis
    const totalFailures = await CCLRedisOperations.incrementFailures(
      this.config.name,
      this.config.monitoringPeriod / 1000
    );

    // Check if we should open the circuit
    if (this.stats.state === 'closed' && totalFailures >= this.config.failureThreshold) {
      await this.transitionToOpen();
    } else if (this.stats.state === 'half-open') {
      // Any failure in half-open state goes back to open
      await this.transitionToOpen();
    }

    // Log failure details
    logger.error('Circuit breaker operation failed', {
      service: this.config.name,
      state: this.stats.state,
      error: error.message,
      totalFailures,
      threshold: this.config.failureThreshold
    });
  }

  private async transitionToOpen(): Promise<void> {
    this.stats.state = 'open';
    this.stats.nextAttempt = Date.now() + this.config.recoveryTimeout;
    this.halfOpenSuccesses = 0;

    // Persist state to Redis
    await CCLRedisOperations.setCircuitBreakerState(
      this.config.name,
      'open',
      this.config.recoveryTimeout / 1000
    );

    CCLLogger.securityEvent('Circuit breaker opened', 'high', {
      service: this.config.name,
      failures: this.stats.failures,
      threshold: this.config.failureThreshold,
      recoveryTimeout: this.config.recoveryTimeout
    });

    logger.warn('Circuit breaker opened', {
      service: this.config.name,
      failures: this.stats.failures,
      threshold: this.config.failureThreshold,
      nextAttempt: new Date(this.stats.nextAttempt)
    });
  }

  private async transitionToHalfOpen(): Promise<void> {
    this.stats.state = 'half-open';
    this.stats.nextAttempt = null;
    this.halfOpenSuccesses = 0;

    // Persist state to Redis
    await CCLRedisOperations.setCircuitBreakerState(
      this.config.name,
      'half-open',
      this.config.recoveryTimeout / 1000
    );

    CCLLogger.securityEvent('Circuit breaker half-open', 'medium', {
      service: this.config.name,
      recoveryAttempt: true
    });

    logger.info('Circuit breaker transitioned to half-open', {
      service: this.config.name,
      successThreshold: this.config.successThreshold
    });
  }

  private async transitionToClosed(): Promise<void> {
    this.stats.state = 'closed';
    this.stats.nextAttempt = null;
    this.halfOpenSuccesses = 0;

    // Reset failure count in Redis
    await CCLRedisOperations.resetFailures(this.config.name);

    // Persist state to Redis
    await CCLRedisOperations.setCircuitBreakerState(
      this.config.name,
      'closed',
      3600 // Keep closed state for 1 hour
    );

    CCLLogger.securityEvent('Circuit breaker closed', 'low', {
      service: this.config.name,
      recovered: true
    });

    logger.info('Circuit breaker recovered and closed', {
      service: this.config.name,
      successfulRecovery: true
    });
  }

  private shouldAttemptRecovery(): boolean {
    return this.stats.nextAttempt !== null && Date.now() >= this.stats.nextAttempt;
  }

  // Get current statistics
  getStats(): CircuitBreakerStats {
    return { ...this.stats };
  }

  // Force state change (for testing/manual intervention)
  async forceState(state: CircuitBreakerState): Promise<void> {
    const oldState = this.stats.state;
    this.stats.state = state;
    
    if (state === 'closed') {
      await CCLRedisOperations.resetFailures(this.config.name);
    }
    
    await CCLRedisOperations.setCircuitBreakerState(this.config.name, state, 3600);
    
    CCLLogger.securityEvent('Circuit breaker state forced', 'medium', {
      service: this.config.name,
      oldState,
      newState: state,
      manual: true
    });
  }

  // Get configuration
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }
}

// Circuit breaker manager for CCL-3 services
export class CCLCircuitBreakerManager {
  private static breakers = new Map<string, CCLCircuitBreaker>();

  // Get or create circuit breaker for a service
  static getBreaker(
    serviceName: string, 
    config?: Partial<CircuitBreakerConfig>
  ): CCLCircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const breakerConfig = config ? { name: serviceName, ...config } : { name: serviceName };
      this.breakers.set(serviceName, new CCLCircuitBreaker(breakerConfig));
    }
    return this.breakers.get(serviceName)!;
  }

  // Execute operation with circuit breaker protection
  static async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getBreaker(serviceName, config);
    return breaker.execute(operation);
  }

  // Get all circuit breaker statistics
  static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  // Health check for all circuit breakers
  static getHealthStatus(): {
    healthy: string[];
    degraded: string[];
    unhealthy: string[];
  } {
    const healthy: string[] = [];
    const degraded: string[] = [];
    const unhealthy: string[] = [];

    for (const [name, breaker] of this.breakers) {
      const stats = breaker.getStats();
      switch (stats.state) {
        case 'closed':
          healthy.push(name);
          break;
        case 'half-open':
          degraded.push(name);
          break;
        case 'open':
          unhealthy.push(name);
          break;
      }
    }

    return { healthy, degraded, unhealthy };
  }

  // Force reset all circuit breakers (emergency use)
  static async resetAll(): Promise<void> {
    const resetPromises = Array.from(this.breakers.values()).map(breaker => 
      breaker.forceState('closed')
    );
    
    await Promise.all(resetPromises);
    
    CCLLogger.securityEvent('All circuit breakers reset', 'high', {
      count: this.breakers.size,
      manual: true,
      emergency: true
    });
  }

  // Remove a circuit breaker (cleanup)
  static removeBreaker(serviceName: string): void {
    this.breakers.delete(serviceName);
  }

  // Clear all circuit breakers (cleanup)
  static clearAll(): void {
    this.breakers.clear();
  }
}

// Convenience functions for common CCL-3 services
export const executeWithMailgunBreaker = <T>(operation: () => Promise<T>) =>
  CCLCircuitBreakerManager.execute('mailgun', operation);

export const executeWithTwilioBreaker = <T>(operation: () => Promise<T>) =>
  CCLCircuitBreakerManager.execute('twilio', operation);

export const executeWithOpenRouterBreaker = <T>(operation: () => Promise<T>) =>
  CCLCircuitBreakerManager.execute('openrouter', operation);

export const executeWithBoberdooBreaker = <T>(operation: () => Promise<T>) =>
  CCLCircuitBreakerManager.execute('boberdoo', operation);

export const executeWithDatabaseBreaker = <T>(operation: () => Promise<T>) =>
  CCLCircuitBreakerManager.execute('database', operation);

export const executeWithWebSocketBreaker = <T>(operation: () => Promise<T>) =>
  CCLCircuitBreakerManager.execute('websocket', operation);

export default {
  CCLCircuitBreaker,
  CCLCircuitBreakerManager,
  executeWithMailgunBreaker,
  executeWithTwilioBreaker,
  executeWithOpenRouterBreaker,
  executeWithBoberdooBreaker,
  executeWithDatabaseBreaker,
  executeWithWebSocketBreaker
};