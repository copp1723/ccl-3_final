import { Request, Response, NextFunction } from 'express';
import { AuditLogRepository } from '../db';

interface AuditOptions {
  resource: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export';
  getResourceId?: (req: Request) => string | undefined;
  getChanges?: (req: Request) => Record<string, any> | undefined;
}

// Audit logging middleware factory
export const auditLog = (options: AuditOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to capture successful responses
    res.json = function(data: any) {
      // Only log successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const resourceId = options.getResourceId ? options.getResourceId(req) : req.params.id;
        const changes = options.getChanges ? options.getChanges(req) : req.body;
        
        // Log asynchronously to not slow down response
        AuditLogRepository.create({
          userId: req.user?.id,
          action: options.action,
          resource: options.resource,
          resourceId,
          changes,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }).catch(error => {
          console.error('Audit log error:', error);
        });
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Convenient audit middleware for common actions
export const auditCreate = (resource: string) => 
  auditLog({ 
    resource, 
    action: 'create',
    getResourceId: (req) => req.body.id || (req as any).createdId
  });

export const auditUpdate = (resource: string) => 
  auditLog({ 
    resource, 
    action: 'update',
    getChanges: (req) => req.body
  });

export const auditDelete = (resource: string) => 
  auditLog({ 
    resource, 
    action: 'delete' 
  });

export const auditView = (resource: string) => 
  auditLog({ 
    resource, 
    action: 'view' 
  });

export const auditExport = (resource: string) => 
  auditLog({ 
    resource, 
    action: 'export',
    getChanges: (req) => ({
      format: req.query.format,
      filters: req.query
    })
  });

// Batch audit for multiple resources
export const auditBatch = (resource: string, action: 'create' | 'update' | 'delete') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const items = Array.isArray(req.body) ? req.body : [req.body];
        const resourceIds = data.data?.map((item: any) => item.id) || [];
        
        // Create audit logs for each item
        Promise.all(
          resourceIds.map((resourceId: string, index: number) =>
            AuditLogRepository.create({
              userId: req.user?.id,
              action,
              resource,
              resourceId,
              changes: items[index],
              ipAddress: req.ip,
              userAgent: req.get('user-agent')
            })
          )
        ).catch(error => {
          console.error('Batch audit log error:', error);
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Sensitive data filter
const sensitiveFields = ['password', 'passwordHash', 'refreshToken', 'apiKey', 'secret'];

export const filterSensitiveData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  const filtered = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in filtered) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      filtered[key] = '[REDACTED]';
    } else if (typeof filtered[key] === 'object') {
      filtered[key] = filterSensitiveData(filtered[key]);
    }
  }
  
  return filtered;
};