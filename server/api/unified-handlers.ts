import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';

// Standard API response format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    timestamp: string;
  };
}

// Standard error response
export interface ApiError {
  success: false;
  error: string;
  details?: any;
  code?: string;
  timestamp: string;
}

// Response helpers
export const createSuccessResponse = <T>(data: T, message?: string, meta?: any): ApiResponse<T> => ({
  success: true,
  data,
  message,
  meta: {
    ...meta,
    timestamp: new Date().toISOString()
  }
});

export const createErrorResponse = (error: string, details?: any, code?: string): ApiError => ({
  success: false,
  error,
  details,
  code,
  timestamp: new Date().toISOString()
});

// Standard pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

// Async handler wrapper
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation middleware factory
export const validateSchema = (schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const validated = schema.parse(data);
      
      if (source === 'body') req.body = validated;
      else if (source === 'query') req.query = validated;
      else req.params = validated;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(createErrorResponse('Validation failed', error.errors, 'VALIDATION_ERROR'));
      } else {
        next(error);
      }
    }
  };
};

// Standard CRUD operations interface
export interface CrudRepository<T> {
  findAll(options?: { limit?: number; offset?: number; where?: any }): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(where?: any): Promise<number>;
}

// Generic CRUD handler factory
export const createCrudHandlers = <T>(repository: CrudRepository<T>, entityName: string) => {
  return {
    // GET /api/entities
    getAll: asyncHandler(async (req: Request, res: Response) => {
      const { page, limit, sort, order } = paginationSchema.parse(req.query);
      const offset = (page - 1) * limit;
      
      const [items, total] = await Promise.all([
        repository.findAll({ limit, offset }),
        repository.count()
      ]);
      
      res.json(createSuccessResponse(items, undefined, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }));
    }),

    // GET /api/entities/:id
    getById: asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const item = await repository.findById(id);
      
      if (!item) {
        return res.status(404).json(createErrorResponse(`${entityName} not found`, undefined, 'NOT_FOUND'));
      }
      
      res.json(createSuccessResponse(item));
    }),

    // POST /api/entities
    create: asyncHandler(async (req: Request, res: Response) => {
      const item = await repository.create(req.body);
      logger.info(`${entityName} created`, { id: (item as any).id });
      res.status(201).json(createSuccessResponse(item, `${entityName} created successfully`));
    }),

    // PUT /api/entities/:id
    update: asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const item = await repository.update(id, req.body);
      
      if (!item) {
        return res.status(404).json(createErrorResponse(`${entityName} not found`, undefined, 'NOT_FOUND'));
      }
      
      logger.info(`${entityName} updated`, { id });
      res.json(createSuccessResponse(item, `${entityName} updated successfully`));
    }),

    // DELETE /api/entities/:id
    delete: asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const deleted = await repository.delete(id);
      
      if (!deleted) {
        return res.status(404).json(createErrorResponse(`${entityName} not found`, undefined, 'NOT_FOUND'));
      }
      
      logger.info(`${entityName} deleted`, { id });
      res.json(createSuccessResponse(null, `${entityName} deleted successfully`));
    })
  };
};

// Health check handler
export const healthHandler = {
  check: (req: Request, res: Response) => {
    const mem = process.memoryUsage();
    res.json(createSuccessResponse({
      status: 'healthy',
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    }));
  }
};

export default {
  createSuccessResponse,
  createErrorResponse,
  asyncHandler,
  validateSchema,
  createCrudHandlers,
  healthHandler,
  paginationSchema
};