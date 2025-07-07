// Enhanced error handling system for CCL-3 SWARM
// Based on foundation error handling with CCL-3 specific enhancements

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ValidationError } from 'zod-validation-error';
import { v4 as uuidv4 } from 'uuid';
import { logger, CCLLogger } from './logger.js';

// CCL-3 specific error codes
export enum CCLErrorCode {
  // Agent errors
  AGENT_INITIALIZATION_FAILED = 'AGENT_INITIALIZATION_FAILED',
  AGENT_PROCESSING_ERROR = 'AGENT_PROCESSING_ERROR',
  AGENT_DECISION_ERROR = 'AGENT_DECISION_ERROR',
  OVERLORD_COORDINATION_ERROR = 'OVERLORD_COORDINATION_ERROR',
  
  // Lead processing errors
  LEAD_VALIDATION_ERROR = 'LEAD_VALIDATION_ERROR',
  LEAD_PROCESSING_ERROR = 'LEAD_PROCESSING_ERROR',
  LEAD_STATUS_UPDATE_ERROR = 'LEAD_STATUS_UPDATE_ERROR',
  LEAD_ASSIGNMENT_ERROR = 'LEAD_ASSIGNMENT_ERROR',
  
  // Communication errors
  EMAIL_SEND_ERROR = 'EMAIL_SEND_ERROR',
  SMS_SEND_ERROR = 'SMS_SEND_ERROR',
  CHAT_MESSAGE_ERROR = 'CHAT_MESSAGE_ERROR',
  COMMUNICATION_TEMPLATE_ERROR = 'COMMUNICATION_TEMPLATE_ERROR',
  
  // External service errors
  MAILGUN_API_ERROR = 'MAILGUN_API_ERROR',
  TWILIO_API_ERROR = 'TWILIO_API_ERROR',
  OPENROUTER_API_ERROR = 'OPENROUTER_API_ERROR',
  BOBERDOO_API_ERROR = 'BOBERDOO_API_ERROR',
  
  // Database errors
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',
  DATABASE_MIGRATION_ERROR = 'DATABASE_MIGRATION_ERROR',
  DATABASE_CONSTRAINT_ERROR = 'DATABASE_CONSTRAINT_ERROR',
  
  // Campaign errors
  CAMPAIGN_CREATION_ERROR = 'CAMPAIGN_CREATION_ERROR',
  CAMPAIGN_EXECUTION_ERROR = 'CAMPAIGN_EXECUTION_ERROR',
  CAMPAIGN_VALIDATION_ERROR = 'CAMPAIGN_VALIDATION_ERROR',
  
  // Authentication and authorization
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',
  
  // System errors
  SYSTEM_OVERLOAD = 'SYSTEM_OVERLOAD',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

// Extended error class with CCL-3 specific context
export class CCLCustomError extends Error {
  public readonly code: CCLErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context: Record<string, any>;
  public readonly timestamp: Date;
  public readonly requestId: string;
  public readonly retryable: boolean;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    code: CCLErrorCode,
    statusCode: number = 500,
    context: Record<string, any> = {},
    isOperational: boolean = true,
    retryable: boolean = false,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();
    this.requestId = uuidv4();
    this.retryable = retryable;
    this.severity = severity;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
      timestamp: this.timestamp,
      requestId: this.requestId,
      retryable: this.retryable,
      severity: this.severity,
      stack: this.stack
    };
  }
}

// Response helper for consistent API responses
export class CCLResponseHelper {
  static success(data: any, message: string = 'Success', statusCode: number = 200) {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static error(
    error: CCLCustomError | Error,
    requestId?: string,
    includeStack: boolean = process.env.NODE_ENV === 'development'
  ) {
    const isCustomError = error instanceof CCLCustomError;
    
    const response: any = {
      success: false,
      error: {
        message: error.message,
        code: isCustomError ? error.code : CCLErrorCode.INTERNAL_SERVER_ERROR,
        requestId: isCustomError ? error.requestId : requestId || uuidv4(),
        timestamp: new Date().toISOString(),
        retryable: isCustomError ? error.retryable : false
      }
    };

    if (isCustomError && Object.keys(error.context).length > 0) {
      response.error.context = error.context;
    }

    if (includeStack) {
      response.error.stack = error.stack;
    }

    return response;
  }

  static validation(errors: any[], message: string = 'Validation failed') {
    return {
      success: false,
      error: {
        message,
        code: CCLErrorCode.LEAD_VALIDATION_ERROR,
        errors,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Async handler wrapper to catch errors
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Database operation wrapper with retry logic
export async function cclDbOperation<T>(
  operation: () => Promise<T>,
  context: Record<string, any> = {},
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        CCLLogger.dbOperation('retry_success', 'unknown', {
          attempt,
          maxRetries,
          ...context
        });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      CCLLogger.dbError('operation_failed', 'unknown', lastError, {
        attempt,
        maxRetries,
        ...context
      });

      if (attempt === maxRetries) {
        throw new CCLCustomError(
          `Database operation failed after ${maxRetries} attempts: ${lastError.message}`,
          CCLErrorCode.DATABASE_QUERY_ERROR,
          500,
          { ...context, attempts: maxRetries, originalError: lastError.message },
          true,
          false,
          'high'
        );
      }

      // Exponential backoff with jitter
      const delay = retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// External API operation wrapper with circuit breaker pattern
export async function cclExternalOperation<T>(
  service: string,
  operation: () => Promise<T>,
  context: Record<string, any> = {},
  timeoutMs: number = 30000
): Promise<T> {
  const startTime = Date.now();
  
  try {
    CCLLogger.externalApiCall(service, context.endpoint || 'unknown', context.method || 'unknown', context);
    
    const result = await Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
      )
    ]);
    
    const duration = Date.now() - startTime;
    CCLLogger.externalApiSuccess(service, context.endpoint || 'unknown', duration, context);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorObj = error as Error;
    
    CCLLogger.externalApiError(service, context.endpoint || 'unknown', errorObj, duration, context);
    
    // Map specific service errors to CCL error codes
    let errorCode: CCLErrorCode;
    let retryable = false;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    
    switch (service.toLowerCase()) {
      case 'mailgun':
        errorCode = CCLErrorCode.MAILGUN_API_ERROR;
        retryable = errorObj.message.includes('rate limit') || errorObj.message.includes('timeout');
        break;
      case 'twilio':
        errorCode = CCLErrorCode.TWILIO_API_ERROR;
        retryable = errorObj.message.includes('rate limit') || errorObj.message.includes('timeout');
        break;
      case 'openrouter':
        errorCode = CCLErrorCode.OPENROUTER_API_ERROR;
        retryable = errorObj.message.includes('rate limit') || errorObj.message.includes('timeout');
        break;
      case 'boberdoo':
        errorCode = CCLErrorCode.BOBERDOO_API_ERROR;
        retryable = true; // Lead submission often retryable
        severity = 'high'; // Lead processing is critical
        break;
      default:
        errorCode = CCLErrorCode.INTERNAL_SERVER_ERROR;
    }
    
    throw new CCLCustomError(
      `${service} API operation failed: ${errorObj.message}`,
      errorCode,
      500,
      { service, duration, ...context, originalError: errorObj.message },
      true,
      retryable,
      severity
    );
  }
}

// Global error handler middleware
export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Don't handle if response already sent
  if (res.headersSent) {
    return next(error);
  }

  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = ValidationError.fromZodError(error);
    const response = CCLResponseHelper.validation(
      validationError.details,
      'Request validation failed'
    );
    res.status(400).json(response);
    return;
  }

  // Handle custom CCL errors
  if (error instanceof CCLCustomError) {
    // Log based on severity
    switch (error.severity) {
      case 'critical':
        CCLLogger.securityEvent(`Critical error: ${error.message}`, 'high', {
          requestId: error.requestId,
          code: error.code,
          context: error.context
        });
        break;
      case 'high':
        logger.error('CCL Custom Error', {
          requestId: error.requestId,
          code: error.code,
          message: error.message,
          context: error.context,
          stack: error.stack
        });
        break;
      default:
        logger.warn('CCL Custom Error', {
          requestId: error.requestId,
          code: error.code,
          message: error.message,
          context: error.context
        });
    }

    const response = CCLResponseHelper.error(error, requestId);
    res.status(error.statusCode).json(response);
    return;
  }

  // Handle known operational errors
  let statusCode = 500;
  let errorCode = CCLErrorCode.INTERNAL_SERVER_ERROR;
  let retryable = false;

  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = CCLErrorCode.LEAD_VALIDATION_ERROR;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = CCLErrorCode.AUTH_TOKEN_INVALID;
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS;
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = CCLErrorCode.RESOURCE_NOT_FOUND;
  } else if (error.message.includes('rate limit')) {
    statusCode = 429;
    errorCode = CCLErrorCode.RATE_LIMIT_EXCEEDED;
    retryable = true;
  }

  // Create standardized error
  const cclError = new CCLCustomError(
    error.message,
    errorCode,
    statusCode,
    { originalError: error.name },
    true,
    retryable
  );

  // Log unexpected errors
  if (statusCode >= 500) {
    logger.error('Unhandled Error', {
      requestId,
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }

  const response = CCLResponseHelper.error(cclError, requestId);
  res.status(statusCode).json(response);
}

// Not found handler
export function notFoundHandler(req: Request, res: Response): void {
  const error = new CCLCustomError(
    `Route ${req.originalUrl} not found`,
    CCLErrorCode.RESOURCE_NOT_FOUND,
    404,
    { method: req.method, url: req.originalUrl }
  );

  const response = CCLResponseHelper.error(error);
  res.status(404).json(response);
}

// Export error factory functions for common CCL errors
export const CCLErrors = {
  agentError: (agentType: string, action: string, originalError: string, context: Record<string, any> = {}) =>
    new CCLCustomError(
      `${agentType} agent failed during ${action}: ${originalError}`,
      CCLErrorCode.AGENT_PROCESSING_ERROR,
      500,
      { agentType, action, originalError, ...context },
      true,
      true,
      'high'
    ),

  leadError: (leadId: string, operation: string, originalError: string, context: Record<string, any> = {}) =>
    new CCLCustomError(
      `Lead processing failed for ${leadId} during ${operation}: ${originalError}`,
      CCLErrorCode.LEAD_PROCESSING_ERROR,
      500,
      { leadId, operation, originalError, ...context },
      true,
      true,
      'high'
    ),

  communicationError: (channel: string, leadId: string, originalError: string, context: Record<string, any> = {}) =>
    new CCLCustomError(
      `${channel} communication failed for lead ${leadId}: ${originalError}`,
      channel === 'email' ? CCLErrorCode.EMAIL_SEND_ERROR :
      channel === 'sms' ? CCLErrorCode.SMS_SEND_ERROR :
      CCLErrorCode.CHAT_MESSAGE_ERROR,
      500,
      { channel, leadId, originalError, ...context },
      true,
      true,
      'high'
    ),

  externalServiceError: (service: string, operation: string, originalError: string, context: Record<string, any> = {}) => {
    const errorCodes: Record<string, CCLErrorCode> = {
      mailgun: CCLErrorCode.MAILGUN_API_ERROR,
      twilio: CCLErrorCode.TWILIO_API_ERROR,
      openrouter: CCLErrorCode.OPENROUTER_API_ERROR,
      boberdoo: CCLErrorCode.BOBERDOO_API_ERROR
    };

    return new CCLCustomError(
      `${service} ${operation} failed: ${originalError}`,
      errorCodes[service.toLowerCase()] || CCLErrorCode.INTERNAL_SERVER_ERROR,
      500,
      { service, operation, originalError, ...context },
      true,
      true,
      'high'
    );
  }
};

// Legacy compatibility functions
export function handleApiError(res: Response, error: any) {
  const customError = error instanceof CCLCustomError ? error : 
    new CCLCustomError(
      error.message || 'An unexpected error occurred',
      error.code ? (error.code as CCLErrorCode) : CCLErrorCode.INTERNAL_SERVER_ERROR,
      500,
      error
    );
  
  const response = CCLResponseHelper.error(customError);
  return res.status(customError.statusCode).json(response);
}

export function createApiError(code: string, message: string, category: string = 'general') {
  return new CCLCustomError(
    message,
    code as CCLErrorCode,
    500,
    { category }
  );
}