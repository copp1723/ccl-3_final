// Performance monitoring and alerting system for CCL-3 SWARM
// Tracks performance metrics and triggers alerts for anomalies

import { logger, CCLLogger } from './logger.js';
import { metricsCollector } from './metrics.js';
import { healthChecker } from './health-checker.js';
import cron from 'node-cron';

// Performance threshold configuration
export interface PerformanceThresholds {
  responseTime: {
    warning: number;    // milliseconds
    critical: number;   // milliseconds
  };
  memory: {
    warning: number;    // percentage
    critical: number;   // percentage
  };
  errorRate: {
    warning: number;    // percentage
    critical: number;   // percentage
  };
  queueDepth: {
    warning: number;    // number of jobs
    critical: number;   // number of jobs
  };
  leadProcessingTime: {
    warning: number;    // seconds
    critical: number;   // seconds
  };
  externalApiLatency: {
    warning: number;    // milliseconds
    critical: number;   // milliseconds
  };
  conversionRate: {
    warning: number;    // percentage (lower bound)
    critical: number;   // percentage (lower bound)
  };
}

// Default thresholds
export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  responseTime: {
    warning: 1000,      // 1 second
    critical: 5000      // 5 seconds
  },
  memory: {
    warning: 75,        // 75%
    critical: 90        // 90%
  },
  errorRate: {
    warning: 5,         // 5%
    critical: 10        // 10%
  },
  queueDepth: {
    warning: 100,       // 100 jobs
    critical: 500       // 500 jobs
  },
  leadProcessingTime: {
    warning: 30,        // 30 seconds
    critical: 120       // 2 minutes
  },
  externalApiLatency: {
    warning: 2000,      // 2 seconds
    critical: 10000     // 10 seconds
  },
  conversionRate: {
    warning: 5,         // 5% minimum
    critical: 2         // 2% minimum
  }
};

// Alert levels
export type AlertLevel = 'info' | 'warning' | 'critical';

// Alert interface
export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  level: AlertLevel;
  component: string;
  metric: string;
  message: string;
  value: number;
  threshold: number;
  data: any;
  resolved?: boolean;
  resolvedAt?: Date;
}

// Performance snapshot interface
export interface PerformanceSnapshot {
  timestamp: Date;
  metrics: {
    responseTime: {
      average: number;
      p95: number;
      p99: number;
    };
    memory: {
      usage: number;
      percentage: number;
    };
    errorRate: {
      rate: number;
      count: number;
      total: number;
    };
    throughput: {
      leadsPerMinute: number;
      requestsPerMinute: number;
    };
    queues: {
      [queueType: string]: {
        waiting: number;
        active: number;
        failed: number;
      };
    };
    externalServices: {
      [service: string]: {
        averageLatency: number;
        errorRate: number;
        circuitBreakerState: string;
      };
    };
  };
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: number;
    healthyComponents: number;
  };
}

export class CCLPerformanceMonitor {
  private thresholds: PerformanceThresholds;
  private alerts: Map<string, PerformanceAlert> = new Map();
  private snapshots: PerformanceSnapshot[] = [];
  private maxSnapshots = 1440; // 24 hours of minute snapshots
  private isInitialized = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
    this.initialize();
  }

  private initialize(): void {
    try {
      // Start performance monitoring
      this.startMonitoring();
      
      // Schedule periodic health checks
      this.scheduleHealthChecks();
      
      // Schedule performance reports
      this.scheduleReports();

      this.isInitialized = true;
      logger.info('Performance monitor initialized', {
        thresholds: this.thresholds,
        maxSnapshots: this.maxSnapshots
      });

      CCLLogger.securityEvent('Performance monitoring started', 'low', {
        thresholds: this.thresholds
      });

    } catch (error) {
      logger.error('Failed to initialize performance monitor', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private startMonitoring(): void {
    // Take performance snapshots every minute
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.takePerformanceSnapshot();
        await this.checkPerformanceThresholds();
      } catch (error) {
        logger.error('Error during performance monitoring cycle', {
          error: (error as Error).message
        });
      }
    }, 60000); // Every minute

    logger.info('Performance monitoring started with 1-minute intervals');
  }

  private scheduleHealthChecks(): void {
    // Run comprehensive health check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.runHealthCheck();
      } catch (error) {
        logger.error('Scheduled health check failed', {
          error: (error as Error).message
        });
      }
    });

    logger.info('Health checks scheduled every 5 minutes');
  }

  private scheduleReports(): void {
    // Generate hourly performance report
    cron.schedule('0 * * * *', async () => {
      try {
        await this.generateHourlyReport();
      } catch (error) {
        logger.error('Hourly report generation failed', {
          error: (error as Error).message
        });
      }
    });

    // Generate daily performance summary
    cron.schedule('0 0 * * *', async () => {
      try {
        await this.generateDailyReport();
      } catch (error) {
        logger.error('Daily report generation failed', {
          error: (error as Error).message
        });
      }
    });

    logger.info('Performance reports scheduled (hourly and daily)');
  }

  async takePerformanceSnapshot(): Promise<PerformanceSnapshot> {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      // Get queue statistics
      const queueStats = await this.getQueueStatistics();
      
      // Get health status
      const healthStatus = await healthChecker.runAllChecks();
      
      // Calculate basic metrics
      const snapshot: PerformanceSnapshot = {
        timestamp: new Date(),
        metrics: {
          responseTime: {
            average: 0, // Would be calculated from actual metrics
            p95: 0,
            p99: 0
          },
          memory: {
            usage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            percentage: Math.round(memoryPercentage)
          },
          errorRate: {
            rate: 0, // Would be calculated from error counters
            count: 0,
            total: 0
          },
          throughput: {
            leadsPerMinute: 0, // Would be calculated from lead counters
            requestsPerMinute: 0 // Would be calculated from HTTP counters
          },
          queues: queueStats,
          externalServices: await this.getExternalServiceMetrics()
        },
        health: {
          overall: healthStatus.status,
          components: healthStatus.checks.length,
          healthyComponents: healthStatus.summary.healthy
        }
      };

      // Store snapshot
      this.snapshots.push(snapshot);
      
      // Maintain max snapshots
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots = this.snapshots.slice(-this.maxSnapshots);
      }

      // Update metrics
      metricsCollector.updateHealthCheckStatus('overall_system', healthStatus.status);

      logger.debug('Performance snapshot taken', {
        memoryPercentage: snapshot.metrics.memory.percentage,
        healthStatus: snapshot.health.overall,
        queueCount: Object.keys(snapshot.metrics.queues).length
      });

      return snapshot;

    } catch (error) {
      logger.error('Failed to take performance snapshot', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async checkPerformanceThresholds(): Promise<void> {
    if (this.snapshots.length === 0) return;

    const latestSnapshot = this.snapshots[this.snapshots.length - 1];

    // Check memory usage
    await this.checkMemoryThreshold(latestSnapshot);
    
    // Check queue depth
    await this.checkQueueThresholds(latestSnapshot);
    
    // Check error rates
    await this.checkErrorRateThresholds(latestSnapshot);
    
    // Check external service latency
    await this.checkExternalServiceThresholds(latestSnapshot);
  }

  private async checkMemoryThreshold(snapshot: PerformanceSnapshot): Promise<void> {
    const memoryPercentage = snapshot.metrics.memory.percentage;
    
    if (memoryPercentage >= this.thresholds.memory.critical) {
      await this.createAlert('critical', 'system', 'memory_usage', 
        `Critical memory usage: ${memoryPercentage}%`,
        memoryPercentage, this.thresholds.memory.critical, { snapshot });
    } else if (memoryPercentage >= this.thresholds.memory.warning) {
      await this.createAlert('warning', 'system', 'memory_usage',
        `High memory usage: ${memoryPercentage}%`,
        memoryPercentage, this.thresholds.memory.warning, { snapshot });
    }
  }

  private async checkQueueThresholds(snapshot: PerformanceSnapshot): Promise<void> {
    for (const [queueType, stats] of Object.entries(snapshot.metrics.queues)) {
      const totalJobs = stats.waiting + stats.active;
      
      if (totalJobs >= this.thresholds.queueDepth.critical) {
        await this.createAlert('critical', 'queue', 'queue_depth',
          `Critical queue depth in ${queueType}: ${totalJobs} jobs`,
          totalJobs, this.thresholds.queueDepth.critical, { queueType, stats });
      } else if (totalJobs >= this.thresholds.queueDepth.warning) {
        await this.createAlert('warning', 'queue', 'queue_depth',
          `High queue depth in ${queueType}: ${totalJobs} jobs`,
          totalJobs, this.thresholds.queueDepth.warning, { queueType, stats });
      }
    }
  }

  private async checkErrorRateThresholds(snapshot: PerformanceSnapshot): Promise<void> {
    const errorRate = snapshot.metrics.errorRate.rate;
    
    if (errorRate >= this.thresholds.errorRate.critical) {
      await this.createAlert('critical', 'system', 'error_rate',
        `Critical error rate: ${errorRate}%`,
        errorRate, this.thresholds.errorRate.critical, { snapshot });
    } else if (errorRate >= this.thresholds.errorRate.warning) {
      await this.createAlert('warning', 'system', 'error_rate',
        `High error rate: ${errorRate}%`,
        errorRate, this.thresholds.errorRate.warning, { snapshot });
    }
  }

  private async checkExternalServiceThresholds(snapshot: PerformanceSnapshot): Promise<void> {
    for (const [service, metrics] of Object.entries(snapshot.metrics.externalServices)) {
      if (metrics.averageLatency >= this.thresholds.externalApiLatency.critical) {
        await this.createAlert('critical', 'external_service', 'latency',
          `Critical latency for ${service}: ${metrics.averageLatency}ms`,
          metrics.averageLatency, this.thresholds.externalApiLatency.critical, 
          { service, metrics });
      } else if (metrics.averageLatency >= this.thresholds.externalApiLatency.warning) {
        await this.createAlert('warning', 'external_service', 'latency',
          `High latency for ${service}: ${metrics.averageLatency}ms`,
          metrics.averageLatency, this.thresholds.externalApiLatency.warning,
          { service, metrics });
      }
    }
  }

  private async createAlert(
    level: AlertLevel,
    component: string,
    metric: string,
    message: string,
    value: number,
    threshold: number,
    data: any
  ): Promise<void> {
    const alertId = `${component}_${metric}_${level}`;
    
    // Check if alert already exists and is not resolved
    const existingAlert = this.alerts.get(alertId);
    if (existingAlert && !existingAlert.resolved) {
      return; // Don't create duplicate alerts
    }

    const alert: PerformanceAlert = {
      id: alertId,
      timestamp: new Date(),
      level,
      component,
      metric,
      message,
      value,
      threshold,
      data
    };

    this.alerts.set(alertId, alert);

    // Log alert
    const logLevel = level === 'critical' ? 'error' : level === 'warning' ? 'warn' : 'info';
    logger[logLevel]('Performance alert created', {
      alertId,
      level,
      component,
      metric,
      message,
      value,
      threshold
    });

    // Record in CCL logger
    CCLLogger.securityEvent(`Performance alert: ${level}`, level === 'critical' ? 'high' : 'medium', {
      alertId,
      component,
      metric,
      message,
      value,
      threshold
    });

    // Update metrics
    metricsCollector.updateHealthCheckStatus(`alert_${component}_${metric}`, 
      level === 'critical' ? 'unhealthy' : 'degraded');
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    logger.info('Performance alert resolved', {
      alertId,
      resolvedAt: alert.resolvedAt,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime()
    });

    return true;
  }

  private async runHealthCheck(): Promise<void> {
    try {
      const healthStatus = await healthChecker.runAllChecks();
      
      // Update individual health check metrics
      healthStatus.checks.forEach(check => {
        metricsCollector.updateHealthCheckStatus(check.name, check.status);
      });

      // Check for degraded services
      const degradedServices = healthStatus.checks.filter(c => c.status === 'degraded');
      const unhealthyServices = healthStatus.checks.filter(c => c.status === 'unhealthy');

      if (unhealthyServices.length > 0) {
        await this.createAlert('critical', 'health_check', 'unhealthy_services',
          `${unhealthyServices.length} services are unhealthy`,
          unhealthyServices.length, 0, { services: unhealthyServices.map(s => s.name) });
      } else if (degradedServices.length > 0) {
        await this.createAlert('warning', 'health_check', 'degraded_services',
          `${degradedServices.length} services are degraded`,
          degradedServices.length, 0, { services: degradedServices.map(s => s.name) });
      }

    } catch (error) {
      logger.error('Health check execution failed', {
        error: (error as Error).message
      });
    }
  }

  private async getQueueStatistics(): Promise<any> {
    try {
      // This would integrate with the queue manager
      return {
        critical: { waiting: 0, active: 0, failed: 0 },
        standard: { waiting: 0, active: 0, failed: 0 },
        background: { waiting: 0, active: 0, failed: 0 }
      };
    } catch (error) {
      logger.error('Failed to get queue statistics', {
        error: (error as Error).message
      });
      return {};
    }
  }

  private async getExternalServiceMetrics(): Promise<any> {
    try {
      return {
        mailgun: { averageLatency: 0, errorRate: 0, circuitBreakerState: 'closed' },
        twilio: { averageLatency: 0, errorRate: 0, circuitBreakerState: 'closed' },
        openrouter: { averageLatency: 0, errorRate: 0, circuitBreakerState: 'closed' },
        boberdoo: { averageLatency: 0, errorRate: 0, circuitBreakerState: 'closed' }
      };
    } catch (error) {
      logger.error('Failed to get external service metrics', {
        error: (error as Error).message
      });
      return {};
    }
  }

  private async generateHourlyReport(): Promise<void> {
    try {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentSnapshots = this.snapshots.filter(s => s.timestamp >= hourAgo);
      
      if (recentSnapshots.length === 0) return;

      const report = {
        period: 'hour',
        timestamp: new Date(),
        snapshots: recentSnapshots.length,
        averageMemoryUsage: this.calculateAverage(recentSnapshots, 'memory.percentage'),
        healthStatus: {
          healthy: recentSnapshots.filter(s => s.health.overall === 'healthy').length,
          degraded: recentSnapshots.filter(s => s.health.overall === 'degraded').length,
          unhealthy: recentSnapshots.filter(s => s.health.overall === 'unhealthy').length
        },
        alerts: Array.from(this.alerts.values()).filter(a => 
          a.timestamp >= hourAgo && !a.resolved
        )
      };

      CCLLogger.analyticsEvent('hourly_performance_report', report, {
        automated: true,
        reportType: 'performance'
      });

    } catch (error) {
      logger.error('Failed to generate hourly report', {
        error: (error as Error).message
      });
    }
  }

  private async generateDailyReport(): Promise<void> {
    try {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dailySnapshots = this.snapshots.filter(s => s.timestamp >= dayAgo);
      
      const report = {
        period: 'day',
        timestamp: new Date(),
        snapshots: dailySnapshots.length,
        performance: {
          averageMemoryUsage: this.calculateAverage(dailySnapshots, 'memory.percentage'),
          peakMemoryUsage: this.calculateMax(dailySnapshots, 'memory.percentage'),
          healthyPercentage: (dailySnapshots.filter(s => s.health.overall === 'healthy').length / dailySnapshots.length) * 100
        },
        alerts: {
          total: Array.from(this.alerts.values()).filter(a => a.timestamp >= dayAgo).length,
          critical: Array.from(this.alerts.values()).filter(a => 
            a.timestamp >= dayAgo && a.level === 'critical'
          ).length,
          resolved: Array.from(this.alerts.values()).filter(a => 
            a.timestamp >= dayAgo && a.resolved
          ).length
        }
      };

      CCLLogger.analyticsEvent('daily_performance_report', report, {
        automated: true,
        reportType: 'performance'
      });

    } catch (error) {
      logger.error('Failed to generate daily report', {
        error: (error as Error).message
      });
    }
  }

  private calculateAverage(snapshots: PerformanceSnapshot[], path: string): number {
    if (snapshots.length === 0) return 0;
    
    const values = snapshots.map(s => this.getNestedValue(s.metrics, path)).filter(v => v !== undefined);
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateMax(snapshots: PerformanceSnapshot[], path: string): number {
    if (snapshots.length === 0) return 0;
    
    const values = snapshots.map(s => this.getNestedValue(s.metrics, path)).filter(v => v !== undefined);
    return Math.max(...values);
  }

  private getNestedValue(obj: any, path: string): number | undefined {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Public methods
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  getRecentSnapshots(count: number = 60): PerformanceSnapshot[] {
    return this.snapshots.slice(-count);
  }

  getPerformanceSummary(): any {
    const recent = this.getRecentSnapshots(60); // Last hour
    if (recent.length === 0) return null;

    return {
      timestamp: new Date(),
      period: 'last_hour',
      snapshots: recent.length,
      averages: {
        memoryUsage: this.calculateAverage(recent, 'memory.percentage'),
        healthyComponents: this.calculateAverage(recent, 'health.healthyComponents')
      },
      current: recent[recent.length - 1],
      alerts: this.getActiveAlerts().length
    };
  }

  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Performance thresholds updated', { thresholds: this.thresholds });
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.info('Performance monitor shutdown complete');
  }
}

// Global performance monitor instance
export const performanceMonitor = new CCLPerformanceMonitor();

export default {
  CCLPerformanceMonitor,
  performanceMonitor,
  DEFAULT_THRESHOLDS
};