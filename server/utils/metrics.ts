// Prometheus metrics collection for CCL-3 SWARM
// Provides comprehensive application and business metrics

import { register, collectDefaultMetrics, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { logger, CCLLogger } from './logger.js';

// Initialize default metrics collection
collectDefaultMetrics({
  prefix: 'ccl3_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP request metrics
export const httpRequestTotal = new Counter({
  name: 'ccl3_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'user_tier']
});

export const httpRequestDuration = new Histogram({
  name: 'ccl3_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

export const httpRequestSize = new Histogram({
  name: 'ccl3_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000]
});

export const httpResponseSize = new Histogram({
  name: 'ccl3_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000]
});

// Lead processing metrics
export const leadsProcessedTotal = new Counter({
  name: 'ccl3_leads_processed_total',
  help: 'Total number of leads processed',
  labelNames: ['source', 'campaign_id', 'status', 'agent_type']
});

export const leadProcessingDuration = new Histogram({
  name: 'ccl3_lead_processing_duration_seconds',
  help: 'Duration of lead processing in seconds',
  labelNames: ['source', 'agent_type', 'decision'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
});

export const leadConversionsTotal = new Counter({
  name: 'ccl3_lead_conversions_total',
  help: 'Total number of lead conversions',
  labelNames: ['source', 'campaign_id', 'conversion_type']
});

export const activeLeadsGauge = new Gauge({
  name: 'ccl3_active_leads',
  help: 'Number of leads currently being processed',
  labelNames: ['status']
});

// Agent metrics
export const agentDecisionsTotal = new Counter({
  name: 'ccl3_agent_decisions_total',
  help: 'Total number of agent decisions made',
  labelNames: ['agent_type', 'decision', 'lead_source']
});

export const agentResponseTime = new Histogram({
  name: 'ccl3_agent_response_time_seconds',
  help: 'Agent response time in seconds',
  labelNames: ['agent_type', 'decision_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

export const agentErrors = new Counter({
  name: 'ccl3_agent_errors_total',
  help: 'Total number of agent errors',
  labelNames: ['agent_type', 'error_type']
});

export const agentActiveGauge = new Gauge({
  name: 'ccl3_agent_active',
  help: 'Whether agent is active (1) or inactive (0)',
  labelNames: ['agent_type']
});

// Communication metrics
export const communicationsSentTotal = new Counter({
  name: 'ccl3_communications_sent_total',
  help: 'Total number of communications sent',
  labelNames: ['channel', 'campaign_id', 'status']
});

export const communicationDeliveryTime = new Histogram({
  name: 'ccl3_communication_delivery_time_seconds',
  help: 'Communication delivery time in seconds',
  labelNames: ['channel', 'provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

export const communicationErrors = new Counter({
  name: 'ccl3_communication_errors_total',
  help: 'Total number of communication errors',
  labelNames: ['channel', 'error_type', 'provider']
});

export const pendingCommunicationsGauge = new Gauge({
  name: 'ccl3_pending_communications',
  help: 'Number of pending communications',
  labelNames: ['channel']
});

// External service metrics
export const externalApiCallsTotal = new Counter({
  name: 'ccl3_external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['service', 'endpoint', 'status', 'method']
});

export const externalApiDuration = new Histogram({
  name: 'ccl3_external_api_duration_seconds',
  help: 'External API call duration in seconds',
  labelNames: ['service', 'endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

export const externalApiErrors = new Counter({
  name: 'ccl3_external_api_errors_total',
  help: 'Total number of external API errors',
  labelNames: ['service', 'error_type', 'endpoint']
});

// Queue metrics
export const queueJobsTotal = new Counter({
  name: 'ccl3_queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue_type', 'job_type', 'status']
});

export const queueJobDuration = new Histogram({
  name: 'ccl3_queue_job_duration_seconds',
  help: 'Queue job processing duration in seconds',
  labelNames: ['queue_type', 'job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300]
});

export const queueSizeGauge = new Gauge({
  name: 'ccl3_queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue_type', 'status']
});

export const queueWorkersGauge = new Gauge({
  name: 'ccl3_queue_workers',
  help: 'Number of active queue workers',
  labelNames: ['queue_type']
});

// Database metrics
export const databaseQueriesTotal = new Counter({
  name: 'ccl3_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status']
});

export const databaseQueryDuration = new Histogram({
  name: 'ccl3_database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

export const databaseConnectionsGauge = new Gauge({
  name: 'ccl3_database_connections',
  help: 'Number of active database connections',
  labelNames: ['pool', 'status']
});

// Redis metrics
export const redisOperationsTotal = new Counter({
  name: 'ccl3_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status', 'client_type']
});

export const redisOperationDuration = new Histogram({
  name: 'ccl3_redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['operation', 'client_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

export const redisConnectionsGauge = new Gauge({
  name: 'ccl3_redis_connections',
  help: 'Number of Redis connections',
  labelNames: ['client_type', 'status']
});

// Rate limiting metrics
export const rateLimitHitsTotal = new Counter({
  name: 'ccl3_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['limiter_type', 'user_tier', 'endpoint']
});

export const rateLimitViolationsTotal = new Counter({
  name: 'ccl3_rate_limit_violations_total',
  help: 'Total number of rate limit violations',
  labelNames: ['limiter_type', 'user_tier', 'endpoint']
});

// Circuit breaker metrics
export const circuitBreakerStateGauge = new Gauge({
  name: 'ccl3_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service']
});

export const circuitBreakerTripsTotal = new Counter({
  name: 'ccl3_circuit_breaker_trips_total',
  help: 'Total number of circuit breaker trips',
  labelNames: ['service', 'reason']
});

// Business metrics
export const campaignsExecutedTotal = new Counter({
  name: 'ccl3_campaigns_executed_total',
  help: 'Total number of campaigns executed',
  labelNames: ['campaign_type', 'status']
});

export const campaignPerformanceGauge = new Gauge({
  name: 'ccl3_campaign_performance',
  help: 'Campaign performance metrics',
  labelNames: ['campaign_id', 'metric_type']
});

export const revenueTotal = new Counter({
  name: 'ccl3_revenue_total',
  help: 'Total revenue generated',
  labelNames: ['source', 'campaign_id']
});

export const conversionRateGauge = new Gauge({
  name: 'ccl3_conversion_rate',
  help: 'Conversion rate percentage',
  labelNames: ['source', 'time_period']
});

// System health metrics
export const healthCheckStatusGauge = new Gauge({
  name: 'ccl3_health_check_status',
  help: 'Health check status (1=healthy, 0.5=degraded, 0=unhealthy)',
  labelNames: ['check_name']
});

export const systemUptimeGauge = new Gauge({
  name: 'ccl3_system_uptime_seconds',
  help: 'System uptime in seconds'
});

export const errorRateGauge = new Gauge({
  name: 'ccl3_error_rate',
  help: 'Error rate percentage',
  labelNames: ['component', 'time_window']
});

// Custom metrics collection class
export class CCLMetricsCollector {
  private static instance: CCLMetricsCollector;
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): CCLMetricsCollector {
    if (!CCLMetricsCollector.instance) {
      CCLMetricsCollector.instance = new CCLMetricsCollector();
    }
    return CCLMetricsCollector.instance;
  }

  private initialize(): void {
    try {
      // Set initial values for gauge metrics
      systemUptimeGauge.set(process.uptime());
      
      // Set up periodic updates
      setInterval(() => {
        this.updateSystemMetrics();
      }, 30000); // Update every 30 seconds

      this.isInitialized = true;
      logger.info('Metrics collector initialized');

    } catch (error) {
      logger.error('Failed to initialize metrics collector', {
        error: (error as Error).message
      });
    }
  }

  private updateSystemMetrics(): void {
    try {
      // Update system uptime
      systemUptimeGauge.set(process.uptime());

      // Update memory metrics (already handled by default metrics)
      
      // Log metrics update
      logger.debug('System metrics updated');
      
    } catch (error) {
      logger.error('Failed to update system metrics', {
        error: (error as Error).message
      });
    }
  }

  // Business logic metric helpers
  recordLeadProcessed(source: string, campaignId: string, status: string, agentType: string): void {
    leadsProcessedTotal.labels(source, campaignId, status, agentType).inc();
  }

  recordLeadProcessingTime(duration: number, source: string, agentType: string, decision: string): void {
    leadProcessingDuration.labels(source, agentType, decision).observe(duration);
  }

  recordAgentDecision(agentType: string, decision: string, leadSource: string): void {
    agentDecisionsTotal.labels(agentType, decision, leadSource).inc();
  }

  recordAgentResponseTime(duration: number, agentType: string, decisionType: string): void {
    agentResponseTime.labels(agentType, decisionType).observe(duration);
  }

  recordCommunicationSent(channel: string, campaignId: string, status: string): void {
    communicationsSentTotal.labels(channel, campaignId, status).inc();
  }

  recordExternalApiCall(service: string, endpoint: string, status: string, method: string, duration: number): void {
    externalApiCallsTotal.labels(service, endpoint, status, method).inc();
    externalApiDuration.labels(service, endpoint, status).observe(duration);
  }

  recordQueueJob(queueType: string, jobType: string, status: string, duration?: number): void {
    queueJobsTotal.labels(queueType, jobType, status).inc();
    if (duration !== undefined) {
      queueJobDuration.labels(queueType, jobType).observe(duration);
    }
  }

  updateQueueSize(queueType: string, status: string, size: number): void {
    queueSizeGauge.labels(queueType, status).set(size);
  }

  recordDatabaseQuery(operation: string, table: string, status: string, duration: number): void {
    databaseQueriesTotal.labels(operation, table, status).inc();
    databaseQueryDuration.labels(operation, table).observe(duration);
  }

  recordRateLimitHit(limiterType: string, userTier: string, endpoint: string, violated: boolean): void {
    rateLimitHitsTotal.labels(limiterType, userTier, endpoint).inc();
    if (violated) {
      rateLimitViolationsTotal.labels(limiterType, userTier, endpoint).inc();
    }
  }

  updateCircuitBreakerState(service: string, state: 'closed' | 'open' | 'half-open'): void {
    const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
    circuitBreakerStateGauge.labels(service).set(stateValue);
  }

  recordCircuitBreakerTrip(service: string, reason: string): void {
    circuitBreakerTripsTotal.labels(service, reason).inc();
  }

  updateHealthCheckStatus(checkName: string, status: 'healthy' | 'degraded' | 'unhealthy'): void {
    const statusValue = status === 'healthy' ? 1 : status === 'degraded' ? 0.5 : 0;
    healthCheckStatusGauge.labels(checkName).set(statusValue);
  }

  recordCampaignExecution(campaignType: string, status: string): void {
    campaignsExecutedTotal.labels(campaignType, status).inc();
  }

  updateConversionRate(source: string, timePeriod: string, rate: number): void {
    conversionRateGauge.labels(source, timePeriod).set(rate);
  }

  recordRevenue(amount: number, source: string, campaignId: string): void {
    revenueTotal.labels(source, campaignId).inc(amount);
  }

  // Get metrics for Prometheus endpoint
  getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Clear all metrics (for testing)
  clearMetrics(): void {
    register.clear();
    logger.info('All metrics cleared');
  }

  // Get metric registry
  getRegistry() {
    return register;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Global metrics collector instance
export const metricsCollector = CCLMetricsCollector.getInstance();

// Helper function to create custom business metrics
export function createBusinessMetric(name: string, help: string, type: 'counter' | 'gauge' | 'histogram', labelNames: string[] = []) {
  const metricName = `ccl3_business_${name}`;
  
  switch (type) {
    case 'counter':
      return new Counter({ name: metricName, help, labelNames });
    case 'gauge':
      return new Gauge({ name: metricName, help, labelNames });
    case 'histogram':
      return new Histogram({ name: metricName, help, labelNames });
    default:
      throw new Error(`Unsupported metric type: ${type}`);
  }
}

export default {
  metricsCollector,
  register,
  // Export all metrics for direct access
  httpRequestTotal,
  httpRequestDuration,
  leadsProcessedTotal,
  leadProcessingDuration,
  agentDecisionsTotal,
  agentResponseTime,
  communicationsSentTotal,
  externalApiCallsTotal,
  queueJobsTotal,
  healthCheckStatusGauge,
  createBusinessMetric
};