import { db } from './client';
import { auditLogs } from './schema';
import { eq, and, gte, lte, desc, sql, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface AuditLogData {
  userId?: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export' | 'login' | 'logout';
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogRepository {
  static async create(data: AuditLogData) {
    try {
      // Validate and clean data before insertion
      const cleanData = {
        id: nanoid(),
        userId: data.userId || null, // Ensure null instead of undefined
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId || null,
        changes: data.changes || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        createdAt: new Date()
      };
      
      // Skip userId validation when it's null (e.g., when SKIP_AUTH is enabled)
      const insertData: any = {
        id: cleanData.id,
        action: cleanData.action,
        resource: cleanData.resource,
        resourceId: cleanData.resourceId,
        details: cleanData.changes, // Map 'changes' to 'details' column
        ipAddress: cleanData.ipAddress,
        userAgent: cleanData.userAgent,
        createdAt: cleanData.createdAt
      };
      
      // Only include userId if it's a valid UUID
      if (cleanData.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanData.userId)) {
        insertData.userId = cleanData.userId;
      }
      
      const [log] = await db
        .insert(auditLogs)
        .values(insertData)
        .returning();
      
      return log;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw - audit logs should not break the application
      return null;
    }
  }

  static async findByUser(userId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    resource?: string;
    action?: string;
    limit?: number;
  }) {
    const conditions = [eq(auditLogs.userId, userId)];
    
    if (options?.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }
    
    if (options?.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }
    
    if (options?.resource) {
      conditions.push(eq(auditLogs.resource, options.resource));
    }
    
    if (options?.action) {
      conditions.push(eq(auditLogs.action, options.action));
    }
    
    let query = db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    return query;
  }

  static async findByResource(resource: string, resourceId?: string, options?: {
    limit?: number;
  }) {
    const conditions = [eq(auditLogs.resource, resource)];
    
    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId));
    }
    
    let query = db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    return query;
  }

  static async findAll(options?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    resource?: string;
    action?: string;
    limit?: number;
  }) {
    const conditions = [];
    
    if (options?.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }
    
    if (options?.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }
    
    if (options?.userId) {
      conditions.push(eq(auditLogs.userId, options.userId));
    }
    
    if (options?.resource) {
      conditions.push(eq(auditLogs.resource, options.resource));
    }
    
    if (options?.action) {
      conditions.push(eq(auditLogs.action, options.action));
    }
    
    let query = db.select().from(auditLogs);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(auditLogs.createdAt));
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    return query;
  }

  static async getResourceHistory(resource: string, resourceId: string) {
    return db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resource, resource),
          eq(auditLogs.resourceId, resourceId)
        )
      )
      .orderBy(desc(auditLogs.createdAt));
  }

  static async getUserActivity(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        action: auditLogs.action,
        count: sql<number>`COUNT(*)::int`
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.userId, userId),
          gte(auditLogs.createdAt, startDate)
        )
      )
      .groupBy(sql`DATE(${auditLogs.createdAt})`, auditLogs.action)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);
  }

  static async getSystemActivity(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        resource: auditLogs.resource,
        action: auditLogs.action,
        count: sql<number>`COUNT(*)::int`
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, startDate))
      .groupBy(sql`DATE(${auditLogs.createdAt})`, auditLogs.resource, auditLogs.action)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);
  }

  // Compliance and security methods
  static async getLoginAttempts(options?: {
    userId?: string;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [
      or(
        eq(auditLogs.action, 'login'),
        eq(auditLogs.action, 'logout')
      )
    ];
    
    if (options?.userId) {
      conditions.push(eq(auditLogs.userId, options.userId));
    }
    
    if (options?.ipAddress) {
      conditions.push(eq(auditLogs.ipAddress, options.ipAddress));
    }
    
    if (options?.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }
    
    if (options?.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }
    
    return db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));
  }

  static async getDataExports(options?: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const conditions = [eq(auditLogs.action, 'export')];
    
    if (options?.userId) {
      conditions.push(eq(auditLogs.userId, options.userId));
    }
    
    if (options?.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }
    
    if (options?.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }
    
    return db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));
  }

  // Cleanup old logs
  static async cleanup(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const deleted = await db
      .delete(auditLogs)
      .where(lte(auditLogs.createdAt, cutoffDate))
      .returning();
    
    return deleted.length;
  }
}