// Production-grade logging system for CCL-3 SWARM
// Based on foundation logger with CCL-3 specific enhancements

import winston from 'winston';
import path from 'path';

// CCL-3 specific log contexts
export interface CCLLogContext {
  leadId?: string;
  agentType?: 'overlord' | 'email' | 'sms' | 'chat';
  campaignId?: string;
  conversationId?: string;
  communicationId?: string;
  userId?: string;
  requestId?: string;
  source?: string;
  channel?: 'email' | 'sms' | 'chat';
  boberdooId?: string;
  externalId?: string;
  apiKey?: string;
  action?: string;
  status?: string;
  error?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

// Create winston logger with CCL-3 optimized configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Enhanced formatting for CCL-3 specific fields
      const logEntry = {
        timestamp,
        level,
        message,
        service: 'ccl3-swarm',
        ...meta
      };
      
      return JSON.stringify(logEntry);
    })
  ),
  defaultMeta: { 
    service: 'ccl3-swarm',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport with colors for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, leadId, agentType, ...meta }) => {
          let logLine = `${timestamp} [${level}] ${message}`;
          
          // Add CCL-3 specific context
          if (leadId) logLine += ` leadId=${leadId}`;
          if (agentType) logLine += ` agent=${agentType}`;
          
          // Add other relevant context
          if (Object.keys(meta).length > 0) {
            const contextStr = Object.entries(meta)
              .filter(([key, value]) => value !== undefined && value !== null)
              .map(([key, value]) => `${key}=${value}`)
              .join(' ');
            if (contextStr) logLine += ` ${contextStr}`;
          }
          
          return logLine;
        })
      )
    })
  ]
});

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  // Error log
  logger.add(new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 5,
    tailable: true
  }));

  // Combined log
  logger.add(new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    maxsize: 100 * 1024 * 1024, // 100MB
    maxFiles: 10,
    tailable: true
  }));

  // Agent-specific logs
  logger.add(new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'agents.log'),
    level: 'info',
    maxsize: 25 * 1024 * 1024, // 25MB
    maxFiles: 5,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format((info) => {
        // Only log agent-related entries
        return info.agentType ? info : false;
      })()
    )
  }));

  // Lead processing logs
  logger.add(new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'leads.log'),
    level: 'info',
    maxsize: 25 * 1024 * 1024, // 25MB
    maxFiles: 5,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format((info) => {
        // Only log lead-related entries
        return info.leadId || info.message.includes('lead') ? info : false;
      })()
    )
  }));
}

// CCL-3 specific logging helpers
export class CCLLogger {
  // Agent operation logging
  static agentAction(agentType: 'overlord' | 'email' | 'sms' | 'chat', action: string, context: CCLLogContext) {
    logger.info(`Agent ${agentType}: ${action}`, {
      agentType,
      action,
      ...context
    });
  }

  static agentDecision(agentType: 'overlord' | 'email' | 'sms' | 'chat', decision: string, reasoning: string, context: CCLLogContext) {
    logger.info(`Agent decision: ${decision}`, {
      agentType,
      decision,
      reasoning,
      ...context
    });
  }

  static agentError(agentType: 'overlord' | 'email' | 'sms' | 'chat', action: string, error: Error, context: CCLLogContext) {
    logger.error(`Agent ${agentType} error in ${action}`, {
      agentType,
      action,
      error: error.message,
      stack: error.stack,
      ...context
    });
  }

  // Lead lifecycle logging
  static leadCreated(leadId: string, context: CCLLogContext) {
    logger.info('Lead created', {
      leadId,
      action: 'lead_created',
      ...context
    });
  }

  static leadProcessing(leadId: string, step: string, context: CCLLogContext) {
    logger.info(`Lead processing: ${step}`, {
      leadId,
      action: 'lead_processing',
      step,
      ...context
    });
  }

  static leadStatusChange(leadId: string, fromStatus: string, toStatus: string, context: CCLLogContext) {
    logger.info('Lead status changed', {
      leadId,
      action: 'status_change',
      fromStatus,
      toStatus,
      ...context
    });
  }

  static leadError(leadId: string, error: Error, context: CCLLogContext) {
    logger.error('Lead processing error', {
      leadId,
      action: 'lead_error',
      error: error.message,
      stack: error.stack,
      ...context
    });
  }

  // Communication logging
  static communicationSent(channel: 'email' | 'sms' | 'chat', leadId: string, context: CCLLogContext) {
    logger.info(`${channel} sent`, {
      leadId,
      channel,
      action: 'communication_sent',
      ...context
    });
  }

  static communicationFailed(channel: 'email' | 'sms' | 'chat', leadId: string, error: Error, context: CCLLogContext) {
    logger.error(`${channel} failed`, {
      leadId,
      channel,
      action: 'communication_failed',
      error: error.message,
      stack: error.stack,
      ...context
    });
  }

  static communicationReceived(channel: 'email' | 'sms' | 'chat', leadId: string, content: string, context: CCLLogContext) {
    logger.info(`${channel} received`, {
      leadId,
      channel,
      action: 'communication_received',
      contentLength: content.length,
      contentPreview: content.substring(0, 100),
      ...context
    });
  }

  // External service logging
  static externalApiCall(service: string, endpoint: string, method: string, context: CCLLogContext) {
    logger.info(`External API call: ${service}`, {
      service,
      endpoint,
      method,
      action: 'external_api_call',
      ...context
    });
  }

  static externalApiSuccess(service: string, endpoint: string, duration: number, context: CCLLogContext) {
    logger.info(`External API success: ${service}`, {
      service,
      endpoint,
      duration,
      action: 'external_api_success',
      ...context
    });
  }

  static externalApiError(service: string, endpoint: string, error: Error, duration: number, context: CCLLogContext) {
    logger.error(`External API error: ${service}`, {
      service,
      endpoint,
      duration,
      error: error.message,
      stack: error.stack,
      action: 'external_api_error',
      ...context
    });
  }

  // Database operation logging
  static dbOperation(operation: string, table: string, context: CCLLogContext) {
    logger.debug(`Database operation: ${operation}`, {
      operation,
      table,
      action: 'db_operation',
      ...context
    });
  }

  static dbError(operation: string, table: string, error: Error, context: CCLLogContext) {
    logger.error(`Database error: ${operation}`, {
      operation,
      table,
      error: error.message,
      stack: error.stack,
      action: 'db_error',
      ...context
    });
  }

  // Campaign and analytics logging
  static campaignEvent(campaignId: string, event: string, context: CCLLogContext) {
    logger.info(`Campaign event: ${event}`, {
      campaignId,
      event,
      action: 'campaign_event',
      ...context
    });
  }

  static analyticsEvent(event: string, data: Record<string, any>, context: CCLLogContext) {
    logger.info(`Analytics: ${event}`, {
      event,
      data,
      action: 'analytics',
      ...context
    });
  }

  // Performance logging
  static performance(operation: string, duration: number, context: CCLLogContext) {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    logger.log(level, `Performance: ${operation}`, {
      operation,
      duration,
      action: 'performance',
      ...context
    });
  }

  // Security logging
  static securityEvent(event: string, severity: 'low' | 'medium' | 'high', context: CCLLogContext) {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    logger.log(level, `Security: ${event}`, {
      event,
      severity,
      action: 'security',
      ...context
    });
  }

  // System health logging
  static healthCheck(service: string, status: 'healthy' | 'degraded' | 'unhealthy', details: string, context: CCLLogContext) {
    const level = status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warn' : 'info';
    logger.log(level, `Health check: ${service} is ${status}`, {
      service,
      status,
      details,
      action: 'health_check',
      ...context
    });
  }
}

// Export both the winston logger and CCL-3 specific logger
export { logger };
export default logger;