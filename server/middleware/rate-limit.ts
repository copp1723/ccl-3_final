// Rate limiting middleware for CCL-3 SWARM
// Based on foundation rate limiting with CCL-3 specific enhancements

import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { rateLimitRedis } from '../utils/redis';
import { logger, CCLLogger } from '../utils/logger';
import { CCLCustomError, CCLErrorCode } from '../utils/error-handler';

// Rate limit configurations for different CCL-3 operations
interface CCLRateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// User tier definitions for CCL-3
interface UserTierLimits {
  free: {
    api: CCLRateLimitConfig;
    leadSubmission: CCLRateLimitConfig;
    agentInteraction: CCLRateLimitConfig;
    campaignOperation: CCLRateLimitConfig;
    export: CCLRateLimitConfig;
  };
  pro: {
    api: CCLRateLimitConfig;
    leadSubmission: CCLRateLimitConfig;
    agentInteraction: CCLRateLimitConfig;
    campaignOperation: CCLRateLimitConfig;
    export: CCLRateLimitConfig;
  };
  enterprise: {
    api: CCLRateLimitConfig;
    leadSubmission: CCLRateLimitConfig;
    agentInteraction: CCLRateLimitConfig;
    campaignOperation: CCLRateLimitConfig;
    export: CCLRateLimitConfig;
  };
}

// CCL-3 specific rate limits based on user tiers
const CCL_RATE_LIMITS: UserTierLimits = {
  free: {
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'API rate limit exceeded for free tier (100 requests per 15 minutes)',
    },
    leadSubmission: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50,
      message: 'Lead submission rate limit exceeded for free tier (50 leads per hour)',
    },
    agentInteraction: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 200,
      message: 'Agent interaction rate limit exceeded for free tier (200 interactions per hour)',
    },
    campaignOperation: {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 10,
      message: 'Campaign operation rate limit exceeded for free tier (10 operations per day)',
    },
    export: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5,
      message: 'Export rate limit exceeded for free tier (5 exports per hour)',
    },
  },
  pro: {
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000,
      message: 'API rate limit exceeded for pro tier (1000 requests per 15 minutes)',
    },
    leadSubmission: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 500,
      message: 'Lead submission rate limit exceeded for pro tier (500 leads per hour)',
    },
    agentInteraction: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 2000,
      message: 'Agent interaction rate limit exceeded for pro tier (2000 interactions per hour)',
    },
    campaignOperation: {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 100,
      message: 'Campaign operation rate limit exceeded for pro tier (100 operations per day)',
    },
    export: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50,
      message: 'Export rate limit exceeded for pro tier (50 exports per hour)',
    },
  },
  enterprise: {
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10000,
      message: 'API rate limit exceeded for enterprise tier (10000 requests per 15 minutes)',
    },
    leadSubmission: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5000,
      message: 'Lead submission rate limit exceeded for enterprise tier (5000 leads per hour)',
    },
    agentInteraction: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20000,
      message: 'Agent interaction rate limit exceeded for enterprise tier (20000 interactions per hour)',
    },
    campaignOperation: {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 1000,
      message: 'Campaign operation rate limit exceeded for enterprise tier (1000 operations per day)',
    },
    export: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 500,
      message: 'Export rate limit exceeded for enterprise tier (500 exports per hour)',
    },
  },
};

// Extend Express Request interface for CCL-3
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string | null;
        role?: string;
        tier?: 'free' | 'pro' | 'enterprise';
      };
      rateLimitInfo?: {
        limit: number;
        remaining: number;
        reset: Date;
        retryAfter?: number;
      };
    }
  }
}

// Create rate limiter configuration
function createRateLimiterConfig(
  operationType: keyof UserTierLimits['free'],
  userTier: keyof UserTierLimits,
  config: CCLRateLimitConfig
): any {
  return {
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      const actualTier = req.user?.tier || 'free';
      const userKey = req.user?.id || req.ip || 'anonymous';
      return `${operationType}:${actualTier}:${userKey}`;
    },
    store: rateLimitRedis ? new RedisStore({
      client: rateLimitRedis,
      prefix: `rl:${operationType}:`,
    }) : undefined,
    handler: (req: Request, res: Response) => {
      const actualTier = req.user?.tier || 'free';
      const actualConfig = CCL_RATE_LIMITS[actualTier][operationType];
      
      const error = new CCLCustomError(
        actualConfig.message || 'Rate limit exceeded',
        CCLErrorCode.RATE_LIMIT_EXCEEDED,
        429,
        {
          operationType,
          userTier: actualTier,
          limit: actualConfig.max,
          windowMs: actualConfig.windowMs,
          retryAfter: res.getHeader('Retry-After')
        },
        true,
        true, // Retryable
        'medium'
      );

      // Log rate limit hit
      CCLLogger.securityEvent('Rate limit exceeded', 'medium', {
        userId: req.user?.id,
        ip: req.ip,
        operationType,
        userTier: actualTier,
        limit: actualConfig.max,
        url: req.originalUrl,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          requestId: error.requestId,
          timestamp: new Date().toISOString(),
          retryable: error.retryable,
          retryAfter: res.getHeader('Retry-After'),
          context: error.context
        }
      });
    }
  };
}

// Create pre-configured rate limiters for each tier and operation
const rateLimiters: Record<string, RateLimitRequestHandler> = {};

// Initialize all rate limiters at startup
for (const tier of ['free', 'pro', 'enterprise'] as const) {
  for (const operation of ['api', 'leadSubmission', 'agentInteraction', 'campaignOperation', 'export'] as const) {
    const key = `${tier}_${operation}`;
    const config = CCL_RATE_LIMITS[tier][operation];
    rateLimiters[key] = rateLimit(createRateLimiterConfig(operation, tier, config));
  }
}

// Create dynamic rate limiter that selects based on user tier
export function createCCLRateLimiter(
  operationType: keyof UserTierLimits['free']
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Determine user tier (default to free if not authenticated)
    const userTier = req.user?.tier || 'free';
    const key = `${userTier}_${operationType}`;
    
    // Use the pre-created rate limiter
    const limiter = rateLimiters[key];
    if (limiter) {
      limiter(req, res, next);
    } else {
      // Fallback to free tier if something goes wrong
      rateLimiters[`free_${operationType}`](req, res, next);
    }
  };
}

// Pre-configured rate limiters for common CCL-3 operations
export const cclApiRateLimit = createCCLRateLimiter('api');
export const cclLeadSubmissionRateLimit = createCCLRateLimiter('leadSubmission');
export const cclAgentInteractionRateLimit = createCCLRateLimiter('agentInteraction');
export const cclCampaignOperationRateLimit = createCCLRateLimiter('campaignOperation');
export const cclExportRateLimit = createCCLRateLimiter('export');

// IP-based rate limiting for non-authenticated requests
export const ipRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  store: rateLimitRedis ? new RedisStore({
    client: rateLimitRedis,
    prefix: 'rl:ip:',
  }) : undefined,
  handler: (req: Request, res: Response) => {
    CCLLogger.securityEvent('IP rate limit exceeded', 'high', {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests from this IP, please try again later.',
        code: CCLErrorCode.RATE_LIMIT_EXCEEDED,
        timestamp: new Date().toISOString(),
        retryable: true
      }
    });
  }
});

// Global rate limiter for all API requests
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Global limit
  message: 'Global rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitRedis ? new RedisStore({
    client: rateLimitRedis,
    prefix: 'rl:global:',
  }) : undefined,
});

// Helper to extract rate limit info from headers
export function extractRateLimitInfo(res: Response): Express.Request['rateLimitInfo'] {
  return {
    limit: parseInt(res.getHeader('X-RateLimit-Limit') as string) || 0,
    remaining: parseInt(res.getHeader('X-RateLimit-Remaining') as string) || 0,
    reset: new Date(parseInt(res.getHeader('X-RateLimit-Reset') as string) * 1000),
    retryAfter: res.getHeader('Retry-After') ? parseInt(res.getHeader('Retry-After') as string) : undefined
  };
}

// Middleware to add rate limit info to request
export function addRateLimitInfo(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    req.rateLimitInfo = extractRateLimitInfo(res);
  });
  next();
}

// Export rate limit configs for documentation
export { CCL_RATE_LIMITS };