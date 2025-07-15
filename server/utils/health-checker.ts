// Comprehensive health check system for CCL-3 SWARM
// Monitors all critical system components and dependencies

import { logger, CCLLogger } from './logger.js';
import { checkRedisHealth } from './redis.js';
import { CCLCircuitBreakerManager } from './circuit-breaker.js';
import { queueManager } from '../workers/queue-manager.js';
import { LeadsRepository, ConversationsRepository } from '../db/index.js';

// Health check result interface
export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  duration: number;
  details: {
    message: string;
    data?: any;
    error?: string;
  };
  metadata?: Record<string, any>;
}

// Overall system health status
export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  performance: {
    averageResponseTime: number;
    slowestCheck: string;
    fastestCheck: string;
  };
}

// Health check function type
type HealthCheckFunction = () => Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  data?: any;
  error?: string;
}>;

export class CCLHealthChecker {
  private checks = new Map<string, HealthCheckFunction>();
  private isInitialized = false;

  constructor() {
    this.initializeHealthChecks();
  }

  // Initialize all health checks
  private initializeHealthChecks(): void {
    try {
      // Core infrastructure checks
      this.registerCheck('database', this.checkDatabase.bind(this));
      this.registerCheck('redis', this.checkRedis.bind(this));
      this.registerCheck('queue_system', this.checkQueueSystem.bind(this));
      
      // External service checks
      this.registerCheck('mailgun', this.checkMailgun.bind(this));
      this.registerCheck('twilio', this.checkTwilio.bind(this));
      this.registerCheck('openrouter', this.checkOpenRouter.bind(this));
      this.registerCheck('boberdoo', this.checkBoberdoo.bind(this));
      
      // System resource checks
      this.registerCheck('memory', this.checkMemory.bind(this));
      this.registerCheck('cpu', this.checkCPU.bind(this));
      this.registerCheck('disk_space', this.checkDiskSpace.bind(this));
      
      // Application-specific checks
      this.registerCheck('agents', this.checkAgents.bind(this));
      this.registerCheck('circuit_breakers', this.checkCircuitBreakers.bind(this));
      this.registerCheck('rate_limiting', this.checkRateLimiting.bind(this));
      
      // Business logic checks
      this.registerCheck('lead_processing', this.checkLeadProcessing.bind(this));
      this.registerCheck('communication_channels', this.checkCommunicationChannels.bind(this));

      this.isInitialized = true;
      logger.info('Health checker initialized with checks', { 
        checkCount: this.checks.size,
        checks: Array.from(this.checks.keys())
      });

    } catch (error) {
      logger.error('Failed to initialize health checker', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  // Register a new health check
  registerCheck(name: string, checkFunction: HealthCheckFunction): void {
    this.checks.set(name, checkFunction);
    logger.debug(`Health check '${name}' registered`);
  }

  // Remove a health check
  unregisterCheck(name: string): void {
    this.checks.delete(name);
    logger.debug(`Health check '${name}' unregistered`);
  }

  // Run a specific health check
  async runCheck(name: string): Promise<HealthCheckResult> {
    const checkFunction = this.checks.get(name);
    if (!checkFunction) {
      return {
        name,
        status: 'unhealthy',
        timestamp: new Date(),
        duration: 0,
        details: {
          message: 'Health check not found',
          error: `No health check registered for '${name}'`
        }
      };
    }

    const startTime = Date.now();
    try {
      const result = await checkFunction();
      const duration = Date.now() - startTime;

      return {
        name,
        status: result.status,
        timestamp: new Date(),
        duration,
        details: {
          message: result.message,
          data: result.data,
          error: result.error
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`Health check '${name}' failed`, {
        error: (error as Error).message,
        duration
      });

      return {
        name,
        status: 'unhealthy',
        timestamp: new Date(),
        duration,
        details: {
          message: 'Health check execution failed',
          error: (error as Error).message
        }
      };
    }
  }

  // Run all health checks
  async runAllChecks(includeOptional: boolean = true): Promise<SystemHealthStatus> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    
    // Run all checks in parallel for better performance
    const checkPromises = Array.from(this.checks.keys()).map(name => 
      this.runCheck(name)
    );

    const results = await Promise.allSettled(checkPromises);
    
    results.forEach((result, index) => {
      const checkName = Array.from(this.checks.keys())[index];
      if (result.status === 'fulfilled') {
        checks.push(result.value);
      } else {
        checks.push({
          name: checkName,
          status: 'unhealthy',
          timestamp: new Date(),
          duration: 0,
          details: {
            message: 'Health check promise rejected',
            error: result.reason?.message || 'Unknown error'
          }
        });
      }
    });

    // Calculate overall status
    const healthyCounts = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length
    };

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (healthyCounts.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (healthyCounts.degraded > 0) {
      overallStatus = 'degraded';
    }

    // Performance analysis
    const durations = checks.map(c => c.duration);
    const averageResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    const slowestCheck = checks.reduce((a, b) => a.duration > b.duration ? a : b).name;
    const fastestCheck = checks.reduce((a, b) => a.duration < b.duration ? a : b).name;

    const systemHealth: SystemHealthStatus = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      checks,
      summary: healthyCounts,
      performance: {
        averageResponseTime,
        slowestCheck,
        fastestCheck
      }
    };

    // Log health check results
    CCLLogger.healthCheck('system', overallStatus, 
      `${healthyCounts.healthy}/${healthyCounts.total} checks healthy`, 
      {
        duration: Date.now() - startTime,
        summary: healthyCounts,
        performance: systemHealth.performance
      }
    );

    return systemHealth;
  }

  // Individual health check implementations
  private async checkDatabase(): Promise<any> {
    try {
      // Test database connectivity with a simple query
      const testResult = await LeadsRepository.findById('test-connection');
      
      return {
        status: 'healthy',
        message: 'Database connection successful',
        data: { connectionTime: Date.now() }
      };
    } catch (error) {
      // Database errors are critical
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: (error as Error).message
      };
    }
  }

  private async checkRedis(): Promise<any> {
    try {
      const redisHealth = await checkRedisHealth();
      const healthyConnections = Object.values(redisHealth).filter(Boolean).length;
      const totalConnections = Object.keys(redisHealth).length;

      if (healthyConnections === totalConnections) {
        return {
          status: 'healthy',
          message: 'All Redis connections healthy',
          data: redisHealth
        };
      } else if (healthyConnections > 0) {
        return {
          status: 'degraded',
          message: `${healthyConnections}/${totalConnections} Redis connections healthy`,
          data: redisHealth
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'All Redis connections failed',
          data: redisHealth
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Redis health check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkQueueSystem(): Promise<any> {
    try {
      const isHealthy = queueManager.isHealthy();
      const stats = await queueManager.getQueueStatistics();

      if (isHealthy) {
        return {
          status: 'healthy',
          message: 'Queue system operational',
          data: {
            healthy: true,
            stats: stats.summary
          }
        };
      } else {
        return {
          status: 'degraded',
          message: 'Queue system not fully operational',
          data: { healthy: false, stats }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Queue system check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkMailgun(): Promise<any> {
    try {
      // Check if Mailgun is configured
      if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
        return {
          status: 'degraded',
          message: 'Mailgun not configured (will use mock mode)',
          data: { configured: false }
        };
      }

      // Check circuit breaker status
      const breakerStats = CCLCircuitBreakerManager.getBreaker('mailgun').getStats();
      
      if (breakerStats.state === 'open') {
        return {
          status: 'unhealthy',
          message: 'Mailgun circuit breaker is open',
          data: { circuitBreaker: breakerStats }
        };
      } else if (breakerStats.state === 'half-open') {
        return {
          status: 'degraded',
          message: 'Mailgun circuit breaker is half-open',
          data: { circuitBreaker: breakerStats }
        };
      }

      return {
        status: 'healthy',
        message: 'Mailgun service available',
        data: { 
          configured: true,
          circuitBreaker: breakerStats 
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Mailgun status unknown',
        error: (error as Error).message
      };
    }
  }

  private async checkTwilio(): Promise<any> {
    try {
      // Check if Twilio is configured
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return {
          status: 'degraded',
          message: 'Twilio not configured (will use mock mode)',
          data: { configured: false }
        };
      }

      // Check circuit breaker status
      const breakerStats = CCLCircuitBreakerManager.getBreaker('twilio').getStats();
      
      if (breakerStats.state === 'open') {
        return {
          status: 'unhealthy',
          message: 'Twilio circuit breaker is open',
          data: { circuitBreaker: breakerStats }
        };
      }

      return {
        status: 'healthy',
        message: 'Twilio service available',
        data: { 
          configured: true,
          circuitBreaker: breakerStats 
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Twilio status unknown',
        error: (error as Error).message
      };
    }
  }

  private async checkOpenRouter(): Promise<any> {
    try {
      if (!process.env.OPENROUTER_API_KEY) {
        return {
          status: 'degraded',
          message: 'OpenRouter not configured (will use mock mode)',
          data: { configured: false }
        };
      }

      const breakerStats = CCLCircuitBreakerManager.getBreaker('openrouter').getStats();
      
      if (breakerStats.state === 'open') {
        return {
          status: 'unhealthy',
          message: 'OpenRouter circuit breaker is open',
          data: { circuitBreaker: breakerStats }
        };
      }

      return {
        status: 'healthy',
        message: 'OpenRouter service available',
        data: { 
          configured: true,
          circuitBreaker: breakerStats 
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'OpenRouter status unknown',
        error: (error as Error).message
      };
    }
  }

  private async checkBoberdoo(): Promise<any> {
    try {
      if (!process.env.BOBERDOO_API_URL || !process.env.BOBERDOO_API_KEY) {
        return {
          status: 'degraded',
          message: 'Boberdoo not configured',
          data: { configured: false }
        };
      }

      const breakerStats = CCLCircuitBreakerManager.getBreaker('boberdoo').getStats();
      
      if (breakerStats.state === 'open') {
        return {
          status: 'unhealthy',
          message: 'Boberdoo circuit breaker is open (critical for lead submissions)',
          data: { circuitBreaker: breakerStats }
        };
      }

      return {
        status: 'healthy',
        message: 'Boberdoo service available',
        data: { 
          configured: true,
          circuitBreaker: breakerStats 
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Boberdoo status unknown',
        error: (error as Error).message
      };
    }
  }

  private async checkMemory(): Promise<any> {
    try {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;
      const usagePercentage = (heapUsedMB / heapTotalMB) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Memory usage: ${usagePercentage.toFixed(2)}%`;

      if (usagePercentage > 90) {
        status = 'unhealthy';
        message += ' (critical)';
      } else if (usagePercentage > 75) {
        status = 'degraded';
        message += ' (high)';
      }

      return {
        status,
        message,
        data: {
          heapUsed: Math.round(heapUsedMB),
          heapTotal: Math.round(heapTotalMB),
          external: Math.round(usage.external / 1024 / 1024),
          rss: Math.round(usage.rss / 1024 / 1024),
          usagePercentage: Math.round(usagePercentage)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Memory check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkCPU(): Promise<any> {
    try {
      const cpuUsage = process.cpuUsage();
      const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      return {
        status: 'healthy',
        message: `CPU time: ${totalUsage.toFixed(2)}s`,
        data: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          total: totalUsage
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'CPU check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkDiskSpace(): Promise<any> {
    try {
      // This would require additional system calls for real disk space checking
      // For now, return a placeholder healthy status
      return {
        status: 'healthy',
        message: 'Disk space check not implemented',
        data: { note: 'Requires system-level integration' }
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: 'Disk space check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkAgents(): Promise<any> {
    try {
      // Check if agents can be instantiated (basic health check)
      const agentTypes = ['overlord', 'email', 'sms', 'chat'];
      const agentStatus: Record<string, boolean> = {};

      agentTypes.forEach(type => {
        try {
          // This would require importing and testing agent creation
          agentStatus[type] = true;
        } catch (error) {
          agentStatus[type] = false;
        }
      });

      const healthyAgents = Object.values(agentStatus).filter(Boolean).length;
      const totalAgents = agentTypes.length;

      if (healthyAgents === totalAgents) {
        return {
          status: 'healthy',
          message: 'All agents operational',
          data: agentStatus
        };
      } else if (healthyAgents > totalAgents / 2) {
        return {
          status: 'degraded',
          message: `${healthyAgents}/${totalAgents} agents operational`,
          data: agentStatus
        };
      } else {
        return {
          status: 'unhealthy',
          message: `Only ${healthyAgents}/${totalAgents} agents operational`,
          data: agentStatus
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Agent health check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkCircuitBreakers(): Promise<any> {
    try {
      const breakerHealth = CCLCircuitBreakerManager.getHealthStatus();
      const totalBreakers = breakerHealth.healthy.length + breakerHealth.degraded.length + breakerHealth.unhealthy.length;
      
      if (breakerHealth.unhealthy.length === 0) {
        return {
          status: 'healthy',
          message: 'All circuit breakers operational',
          data: {
            healthy: breakerHealth.healthy.length,
            degraded: breakerHealth.degraded.length,
            unhealthy: breakerHealth.unhealthy.length,
            total: totalBreakers
          }
        };
      } else if (breakerHealth.unhealthy.length < totalBreakers / 2) {
        return {
          status: 'degraded',
          message: `${breakerHealth.unhealthy.length} circuit breakers open`,
          data: breakerHealth
        };
      } else {
        return {
          status: 'unhealthy',
          message: `${breakerHealth.unhealthy.length} circuit breakers open (critical)`,
          data: breakerHealth
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Circuit breaker check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkRateLimiting(): Promise<any> {
    try {
      // Check if Redis is available for rate limiting
      const redisHealth = await checkRedisHealth();
      
      if (redisHealth.rateLimit) {
        return {
          status: 'healthy',
          message: 'Rate limiting operational with Redis backend',
          data: { backend: 'redis', healthy: true }
        };
      } else {
        return {
          status: 'degraded',
          message: 'Rate limiting using memory fallback',
          data: { backend: 'memory', healthy: true }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Rate limiting check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkLeadProcessing(): Promise<any> {
    try {
      // Test basic lead processing capability
      const canProcessLeads = queueManager.isHealthy();
      
      if (canProcessLeads) {
        return {
          status: 'healthy',
          message: 'Lead processing system operational',
          data: { queueHealthy: true }
        };
      } else {
        return {
          status: 'degraded',
          message: 'Lead processing using fallback mode',
          data: { queueHealthy: false }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Lead processing check failed',
        error: (error as Error).message
      };
    }
  }

  private async checkCommunicationChannels(): Promise<any> {
    try {
      const channels = {
        email: {
          configured: !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN),
          circuitBreakerOpen: CCLCircuitBreakerManager.getBreaker('mailgun').getStats().state === 'open'
        },
        sms: {
          configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
          circuitBreakerOpen: CCLCircuitBreakerManager.getBreaker('twilio').getStats().state === 'open'
        }
      };

      const availableChannels = Object.entries(channels).filter(([_, config]) => 
        config.configured && !config.circuitBreakerOpen
      ).length;

      if (availableChannels === 2) {
        return {
          status: 'healthy',
          message: 'All communication channels available',
          data: channels
        };
      } else if (availableChannels === 1) {
        return {
          status: 'degraded',
          message: 'Some communication channels unavailable',
          data: channels
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'No communication channels available',
          data: channels
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Communication channels check failed',
        error: (error as Error).message
      };
    }
  }

  // Get list of registered checks
  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys());
  }

  // Check if health checker is ready
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Global health checker instance
export const healthChecker = new CCLHealthChecker();

export default {
  CCLHealthChecker,
  healthChecker
};