// Comprehensive monitoring and observability routes for CCL-3
// Provides metrics, health checks, and operational dashboards

import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { healthChecker } from '../utils/health-checker.js';
import { metricsCollector } from '../utils/metrics.js';
import { performanceMonitor } from '../utils/performance-monitor.js';
import { queueManager } from '../workers/queue-manager.js';
import { CCLCircuitBreakerManager } from '../utils/circuit-breaker.js';
import { checkRedisHealth } from '../utils/redis.js';
import { logger, CCLLogger } from '../utils/logger.js';
import { CCLResponseHelper, CCLCustomError, CCLErrorCode } from '../utils/error-handler.js';
import { cclApiRateLimit, rateLimitInfo } from '../middleware/rate-limit.js';

const router = Router();

// Prometheus metrics endpoint (public, no auth required)
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsCollector.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to get Prometheus metrics', { error: (error as Error).message });
    res.status(500).send('Error retrieving metrics');
  }
});

// System health overview (public with basic info)
router.get('/health', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Run basic health checks
    const systemHealth = await healthChecker.runAllChecks(false);
    
    // Get basic system info
    const basicInfo = {
      status: systemHealth.status,
      timestamp: systemHealth.timestamp,
      uptime: systemHealth.uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      summary: systemHealth.summary,
      responseTime: Date.now() - startTime
    };

    const statusCode = systemHealth.status === 'healthy' ? 200 : 
                      systemHealth.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(CCLResponseHelper.success(basicInfo, 'Health check completed'));
    
  } catch (error) {
    logger.error('Health check failed', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Detailed health check (requires authentication)
router.get('/health/detailed', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    const systemHealth = await healthChecker.runAllChecks(true);
    
    CCLLogger.analyticsEvent('detailed_health_check', {
      status: systemHealth.status,
      checksRun: systemHealth.checks.length,
      userId: req.user?.id
    }, { userId: req.user?.id });

    res.json(CCLResponseHelper.success(systemHealth, 'Detailed health check completed'));
    
  } catch (error) {
    logger.error('Detailed health check failed', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Individual health check
router.get('/health/:checkName', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    const { checkName } = req.params;
    const checkResult = await healthChecker.runCheck(checkName);
    
    const statusCode = checkResult.status === 'healthy' ? 200 :
                      checkResult.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(CCLResponseHelper.success(checkResult, 
      `Health check for ${checkName} completed`));
    
  } catch (error) {
    logger.error(`Health check for ${req.params.checkName} failed`, { 
      error: (error as Error).message 
    });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Performance monitoring dashboard
router.get('/performance', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    const { timeframe = '1h' } = req.query;
    
    let snapshotCount = 60; // Default 1 hour
    switch (timeframe) {
      case '15m': snapshotCount = 15; break;
      case '1h': snapshotCount = 60; break;
      case '6h': snapshotCount = 360; break;
      case '24h': snapshotCount = 1440; break;
    }

    const performanceData = {
      summary: performanceMonitor.getPerformanceSummary(),
      snapshots: performanceMonitor.getRecentSnapshots(snapshotCount),
      alerts: performanceMonitor.getActiveAlerts(),
      timestamp: new Date().toISOString(),
      timeframe
    };

    CCLLogger.analyticsEvent('performance_dashboard_viewed', {
      timeframe,
      snapshotsReturned: performanceData.snapshots.length,
      activeAlerts: performanceData.alerts.length
    }, { userId: req.user?.id });

    res.json(CCLResponseHelper.success(performanceData, 'Performance data retrieved'));
    
  } catch (error) {
    logger.error('Failed to get performance data', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Performance alerts
router.get('/performance/alerts', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    const { resolved = 'false' } = req.query;
    const alerts = performanceMonitor.getActiveAlerts();
    
    const filteredAlerts = resolved === 'true' ? 
      alerts : alerts.filter(a => !a.resolved);

    res.json(CCLResponseHelper.success({
      alerts: filteredAlerts,
      count: filteredAlerts.length,
      timestamp: new Date().toISOString()
    }, 'Performance alerts retrieved'));
    
  } catch (error) {
    logger.error('Failed to get performance alerts', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Resolve performance alert (admin only)
router.post('/performance/alerts/:alertId/resolve', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Admin privileges required for alert management',
          CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
          403
        )
      ));
    }

    const { alertId } = req.params;
    const resolved = await performanceMonitor.resolveAlert(alertId);
    
    if (resolved) {
      CCLLogger.securityEvent('Performance alert resolved manually', 'medium', {
        alertId,
        userId: req.user.id,
        ip: req.ip
      });

      res.json(CCLResponseHelper.success(
        { alertId, resolved: true },
        'Alert resolved successfully'
      ));
    } else {
      res.status(404).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Alert not found or already resolved',
          CCLErrorCode.RESOURCE_NOT_FOUND,
          404
        )
      ));
    }
    
  } catch (error) {
    logger.error('Failed to resolve alert', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// System overview dashboard
router.get('/dashboard', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    // Gather comprehensive system information
    const [
      healthStatus,
      queueStats,
      performanceSummary,
      redisHealth,
      circuitBreakerStatus
    ] = await Promise.all([
      healthChecker.runAllChecks(),
      queueManager.getQueueStatistics(),
      performanceMonitor.getPerformanceSummary(),
      checkRedisHealth(),
      CCLCircuitBreakerManager.getHealthStatus()
    ]);

    const dashboard = {
      timestamp: new Date().toISOString(),
      system: {
        status: healthStatus.status,
        uptime: process.uptime(),
        memory: {
          usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        },
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      },
      health: {
        overall: healthStatus.status,
        checks: healthStatus.summary,
        components: healthStatus.checks.map(c => ({
          name: c.name,
          status: c.status,
          duration: c.duration
        }))
      },
      queues: {
        healthy: queueManager.isHealthy(),
        stats: queueStats.summary || {},
        details: queueStats.queues || {}
      },
      performance: performanceSummary,
      infrastructure: {
        redis: redisHealth,
        circuitBreakers: circuitBreakerStatus
      },
      alerts: {
        active: performanceMonitor.getActiveAlerts().length,
        critical: performanceMonitor.getActiveAlerts().filter(a => a.level === 'critical').length
      }
    };

    CCLLogger.analyticsEvent('system_dashboard_viewed', {
      systemStatus: dashboard.system.status,
      activeAlerts: dashboard.alerts.active
    }, { userId: req.user?.id });

    res.json(CCLResponseHelper.success(dashboard, 'System dashboard data retrieved'));
    
  } catch (error) {
    logger.error('Failed to get dashboard data', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Real-time metrics endpoint (streaming)
router.get('/realtime', authenticate, async (req: Request, res: Response) => {
  try {
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendUpdate = async () => {
      try {
        const realtimeData = {
          timestamp: new Date().toISOString(),
          memory: {
            usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
          },
          uptime: process.uptime(),
          alerts: performanceMonitor.getActiveAlerts().length,
          queues: queueManager.isHealthy()
        };

        res.write(`data: ${JSON.stringify(realtimeData)}\n\n`);
      } catch (error) {
        logger.error('Error sending realtime update', { error: (error as Error).message });
      }
    };

    // Send initial data
    await sendUpdate();

    // Set up interval for updates
    const interval = setInterval(sendUpdate, 5000); // Every 5 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      logger.debug('Realtime monitoring client disconnected');
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    logger.error('Failed to start realtime monitoring', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Business metrics dashboard
router.get('/business', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    // This would integrate with actual business metrics
    const businessMetrics = {
      timestamp: new Date().toISOString(),
      leads: {
        processed: 0,     // Would come from lead counters
        converted: 0,     // Would come from conversion tracking
        revenue: 0        // Would come from revenue tracking
      },
      campaigns: {
        active: 0,        // Would come from campaign metrics
        performance: {}   // Would come from campaign analytics
      },
      communications: {
        sent: 0,          // Would come from communication counters
        delivered: 0,     // Would come from delivery tracking
        failed: 0         // Would come from error tracking
      },
      agents: {
        decisions: 0,     // Would come from agent metrics
        avgResponseTime: 0, // Would come from response time tracking
        efficiency: 0     // Would come from efficiency calculations
      }
    };

    CCLLogger.analyticsEvent('business_metrics_viewed', businessMetrics, {
      userId: req.user?.id
    });

    res.json(CCLResponseHelper.success(businessMetrics, 'Business metrics retrieved'));
    
  } catch (error) {
    logger.error('Failed to get business metrics', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Infrastructure status
router.get('/infrastructure', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    const [redisHealth, circuitBreakerStatus, queueHealth] = await Promise.all([
      checkRedisHealth(),
      CCLCircuitBreakerManager.getHealthStatus(),
      queueManager.getQueueStatistics()
    ]);

    const infrastructure = {
      timestamp: new Date().toISOString(),
      redis: {
        status: redisHealth.main && redisHealth.rateLimit && redisHealth.session ? 'healthy' : 'degraded',
        connections: redisHealth,
        details: {
          main: redisHealth.main ? 'connected' : 'disconnected',
          rateLimit: redisHealth.rateLimit ? 'connected' : 'disconnected',
          session: redisHealth.session ? 'connected' : 'disconnected'
        }
      },
      circuitBreakers: {
        status: circuitBreakerStatus.unhealthy.length === 0 ? 'healthy' : 'degraded',
        summary: {
          healthy: circuitBreakerStatus.healthy.length,
          degraded: circuitBreakerStatus.degraded.length,
          unhealthy: circuitBreakerStatus.unhealthy.length
        },
        services: {
          healthy: circuitBreakerStatus.healthy,
          degraded: circuitBreakerStatus.degraded,
          unhealthy: circuitBreakerStatus.unhealthy
        }
      },
      queues: {
        status: queueHealth.initialized ? 'healthy' : 'unhealthy',
        workers: queueHealth.workers || [],
        stats: queueHealth.summary || {}
      },
      database: {
        status: 'unknown', // Would require database health check
        connections: 'unknown'
      }
    };

    res.json(CCLResponseHelper.success(infrastructure, 'Infrastructure status retrieved'));
    
  } catch (error) {
    logger.error('Failed to get infrastructure status', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Logs endpoint (admin only)
router.get('/logs', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Admin privileges required for log access',
          CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
          403
        )
      ));
    }

    const { level = 'info', limit = 100, component } = req.query;

    // This would integrate with log storage system
    const logs = {
      timestamp: new Date().toISOString(),
      filters: { level, limit, component },
      entries: [], // Would come from log storage
      note: 'Log retrieval requires log storage integration'
    };

    CCLLogger.securityEvent('System logs accessed', 'medium', {
      userId: req.user.id,
      filters: { level, limit, component }
    });

    res.json(CCLResponseHelper.success(logs, 'Logs retrieved'));
    
  } catch (error) {
    logger.error('Failed to get logs', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// System statistics
router.get('/stats', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        startTime: new Date(Date.now() - process.uptime() * 1000),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      performance: performanceMonitor.getPerformanceSummary(),
      health: await healthChecker.runAllChecks()
    };

    res.json(CCLResponseHelper.success(stats, 'System statistics retrieved'));
    
  } catch (error) {
    logger.error('Failed to get system statistics', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Performance thresholds management (admin only)
router.get('/performance/thresholds', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Admin privileges required for threshold management',
          CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
          403
        )
      ));
    }

    // This would get current thresholds from performance monitor
    const thresholds = {
      current: {}, // Would come from performanceMonitor.getThresholds()
      defaults: {}, // Would come from DEFAULT_THRESHOLDS
      lastModified: null
    };

    res.json(CCLResponseHelper.success(thresholds, 'Performance thresholds retrieved'));
    
  } catch (error) {
    logger.error('Failed to get performance thresholds', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

router.put('/performance/thresholds', authenticate, cclApiRateLimit, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Admin privileges required for threshold management',
          CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
          403
        )
      ));
    }

    const { thresholds } = req.body;
    
    // This would update thresholds in performance monitor
    performanceMonitor.updateThresholds(thresholds);

    CCLLogger.securityEvent('Performance thresholds updated', 'medium', {
      userId: req.user.id,
      thresholds
    });

    res.json(CCLResponseHelper.success(
      { updated: true, timestamp: new Date().toISOString() },
      'Performance thresholds updated'
    ));
    
  } catch (error) {
    logger.error('Failed to update performance thresholds', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

export default router;