// System health and protection monitoring routes for CCL-3
// Provides visibility into rate limiting, circuit breakers, and Redis health

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CCLCircuitBreakerManager } from '../utils/circuit-breaker';
import { checkRedisHealth } from '../utils/redis';
import { logger, CCLLogger } from '../utils/logger';
import { CCLResponseHelper } from '../utils/error-handler';

const router = Router();

// Health check endpoint (public)
router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check Redis health
    const redisHealth = await checkRedisHealth();
    
    // Check circuit breaker status
    const circuitBreakerHealth = CCLCircuitBreakerManager.getHealthStatus();
    const circuitBreakerStats = CCLCircuitBreakerManager.getAllStats();
    
    // Basic system metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      services: {
        redis: {
          main: redisHealth.main,
          rateLimit: redisHealth.rateLimit,
          session: redisHealth.session
        },
        circuitBreakers: {
          healthy: circuitBreakerHealth.healthy,
          degraded: circuitBreakerHealth.degraded,
          unhealthy: circuitBreakerHealth.unhealthy,
          total: Object.keys(circuitBreakerStats).length
        }
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024) // MB
      },
      responseTime: Date.now() - startTime
    };

    // Determine overall health status
    const hasUnhealthyServices = circuitBreakerHealth.unhealthy.length > 0;
    const hasRedisIssues = !redisHealth.main || !redisHealth.rateLimit;
    
    if (hasUnhealthyServices || hasRedisIssues) {
      healthData.status = 'degraded';
    }

    // Log health check
    CCLLogger.healthCheck('system', healthData.status as any, 
      `Redis: ${redisHealth.main ? 'OK' : 'FAIL'}, Circuit Breakers: ${circuitBreakerHealth.unhealthy.length} unhealthy`,
      {}
    );

    res.status(healthData.status === 'healthy' ? 200 : 503)
       .json(CCLResponseHelper.success(healthData, 'Health check completed'));
    
  } catch (error) {
    logger.error('Health check failed', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Detailed system metrics (requires authentication)
router.get('/metrics', authenticate, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get circuit breaker statistics
    const circuitBreakerStats = CCLCircuitBreakerManager.getAllStats();
    
    // Get Redis health
    const redisHealth = await checkRedisHealth();
    
    // System metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      redis: {
        health: redisHealth,
        connected: redisHealth.main && redisHealth.rateLimit && redisHealth.session
      },
      circuitBreakers: circuitBreakerStats,
      responseTime: Date.now() - startTime
    };

    // Log metrics request
    CCLLogger.info('System metrics requested', {
      event: 'system_metrics_requested',
      metrics,
      userId: req.user?.id,
      ip: req.ip
    });

    res.json(CCLResponseHelper.success(metrics, 'System metrics retrieved'));
    
  } catch (error) {
    logger.error('Failed to retrieve system metrics', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Circuit breaker management (admin only)
router.post('/circuit-breakers/:service/reset', authenticate, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new Error('Admin privileges required for circuit breaker management')
      ));
    }

    const { service } = req.params;
    const breaker = CCLCircuitBreakerManager.getBreaker(service);
    
    await breaker.forceState('closed');
    
    CCLLogger.warn('Circuit breaker manually reset', {
      service,
      userId: req.user.id,
      ip: req.ip,
      manual: true,
      severity: 'high'
    });

    res.json(CCLResponseHelper.success(
      { service, status: 'reset' },
      `Circuit breaker for ${service} has been reset`
    ));
    
  } catch (error) {
    logger.error('Failed to reset circuit breaker', { 
      service: req.params.service,
      error: (error as Error).message 
    });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Get circuit breaker status for specific service
router.get('/circuit-breakers/:service', authenticate, async (req, res) => {
  try {
    const { service } = req.params;
    const breaker = CCLCircuitBreakerManager.getBreaker(service);
    
    const stats = breaker.getStats();
    const config = breaker.getConfig();
    
    const data = {
      service,
      stats,
      config,
      timestamp: new Date().toISOString()
    };

    res.json(CCLResponseHelper.success(data, `Circuit breaker status for ${service}`));
    
  } catch (error) {
    logger.error('Failed to get circuit breaker status', { 
      service: req.params.service,
      error: (error as Error).message 
    });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Emergency reset all circuit breakers (admin only)
router.post('/circuit-breakers/reset-all', authenticate, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new Error('Admin privileges required for emergency operations')
      ));
    }

    await CCLCircuitBreakerManager.resetAll();
    
    CCLLogger.error('All circuit breakers emergency reset', {
      userId: req.user.id,
      ip: req.ip,
      emergency: true,
      manual: true,
      severity: 'critical'
    });

    res.json(CCLResponseHelper.success(
      { resetCount: Object.keys(CCLCircuitBreakerManager.getAllStats()).length },
      'All circuit breakers have been reset'
    ));
    
  } catch (error) {
    logger.error('Failed to reset all circuit breakers', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Rate limiting status (admin only)
router.get('/rate-limits', authenticate, async (req, res) => {
  try {
    // Check if user has admin privileges  
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new Error('Admin privileges required for rate limit monitoring')
      ));
    }

    // This would require implementing rate limit tracking
    // For now, return basic information
    const rateLimitInfo = {
      timestamp: new Date().toISOString(),
      tiers: {
        free: {
          api: { windowMs: 15 * 60 * 1000, max: 100 },
          leadSubmission: { windowMs: 60 * 60 * 1000, max: 50 },
          export: { windowMs: 60 * 60 * 1000, max: 5 }
        },
        pro: {
          api: { windowMs: 15 * 60 * 1000, max: 1000 },
          leadSubmission: { windowMs: 60 * 60 * 1000, max: 500 },
          export: { windowMs: 60 * 60 * 1000, max: 50 }
        },
        enterprise: {
          api: { windowMs: 15 * 60 * 1000, max: 10000 },
          leadSubmission: { windowMs: 60 * 60 * 1000, max: 5000 },
          export: { windowMs: 60 * 60 * 1000, max: 500 }
        }
      },
      redisConnected: (await checkRedisHealth()).rateLimit,
      note: 'Detailed rate limit usage tracking requires Redis analytics implementation'
    };

    res.json(CCLResponseHelper.success(rateLimitInfo, 'Rate limit configuration retrieved'));
    
  } catch (error) {
    logger.error('Failed to get rate limit status', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

export default router;