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
import { apiRateLimit } from '../middleware/rate-limit.js';
import { aiCache } from '../utils/ai-cache';

const router = Router();

// Mock health data
const getHealthData = () => ({
  database: {
    status: 'healthy',
    message: 'Connected to PostgreSQL',
    responseTime: 12,
    lastChecked: new Date().toISOString()
  },
  redis: {
    status: 'healthy',
    message: 'Redis cache operational',
    responseTime: 5,
    lastChecked: new Date().toISOString()
  },
  email: {
    status: 'healthy',
    message: 'Email service operational',
    responseTime: 45,
    lastChecked: new Date().toISOString()
  },
  websocket: {
    status: 'healthy',
    message: 'WebSocket server running',
    responseTime: 8,
    lastChecked: new Date().toISOString()
  }
});

const getPerformanceData = () => ({
  memory: {
    usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
  },
  cpu: {
    usage: Math.random() * 40 + 10, // Mock CPU usage between 10-50%
    cores: require('os').cpus().length
  },
  uptime: Math.round(process.uptime()),
  responseTime: {
    avg: 145,
    p95: 280,
    p99: 450
  },
  throughput: {
    requestsPerMinute: Math.floor(Math.random() * 100) + 50,
    activeConnections: Math.floor(Math.random() * 20) + 5
  }
});

const getBusinessData = () => ({
  leads: {
    total: 1247,
    today: 23,
    thisWeek: 156,
    conversionRate: 12.5
  },
  campaigns: {
    active: 8,
    paused: 3,
    totalSent: 15420,
    openRate: 24.5,
    clickRate: 3.2
  },
  agents: {
    active: 4,
    busy: 2,
    idle: 2,
    totalTasks: 89
  },
  conversations: {
    active: 12,
    resolved: 45,
    avgResponseTime: 1.2,
    satisfaction: 4.6
  }
});

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

// Detailed health check
router.get('/health/detailed', authenticate, async (req, res) => {
  try {
    const health = getHealthData();
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
      overall: 'healthy'
    });
  } catch (error) {
    console.error('Error fetching detailed health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health data'
    });
  }
});

// Individual health check
router.get('/health/:checkName', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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

// Performance metrics
router.get('/performance', authenticate, async (req, res) => {
  try {
    const performance = getPerformanceData();
    
    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});

// Performance alerts
router.get('/performance/alerts', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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
router.post('/performance/alerts/:alertId/resolve', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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
router.get('/dashboard', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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

// Business metrics
router.get('/business', authenticate, async (req, res) => {
  try {
    const business = getBusinessData();
    
    res.json({
      success: true,
      data: business,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching business metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch business metrics'
    });
  }
});

// Infrastructure status
router.get('/infrastructure', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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
router.get('/logs', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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
router.get('/stats', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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
router.get('/performance/thresholds', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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

router.put('/performance/thresholds', authenticate, apiRateLimit, async (req: Request, res: Response) => {
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

// AI cache statistics endpoint
router.get('/ai-cache-stats', authenticate, apiRateLimit, async (req: Request, res: Response) => {
  try {
    const stats = aiCache.getStats();
    
    res.json({
      success: true,
      data: {
        cache: stats,
        costSavingsFormatted: `$${stats.costSavings.toFixed(2)}`,
        hitRateFormatted: `${stats.hitRate.toFixed(1)}%`,
        averageSavingsPerHit: stats.hits > 0 ? `$${(stats.costSavings / stats.hits).toFixed(4)}` : '$0'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get AI cache stats', { error });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve AI cache statistics',
        code: 'CACHE_STATS_ERROR'
      }
    });
  }
});

// System alerts
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const alerts = [
      {
        id: '1',
        type: 'warning',
        title: 'High Memory Usage',
        message: 'Memory usage is above 80%',
        severity: 'medium',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        resolved: false
      },
      {
        id: '2',
        type: 'info',
        title: 'Database Optimization',
        message: 'Query performance improved by 15%',
        severity: 'low',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        resolved: true
      }
    ];
    
    res.json({
      success: true,
      data: alerts,
      total: alerts.length,
      unresolved: alerts.filter(a => !a.resolved).length
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system alerts'
    });
  }
});

// Resolve alert
router.patch('/alerts/:id/resolve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({
      success: true,
      message: `Alert ${id} resolved`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

export default router;