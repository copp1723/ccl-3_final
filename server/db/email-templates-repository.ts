import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { db } from './client';
import { templates, Template, NewTemplate } from './schema';
import { nanoid } from 'nanoid';

export interface TemplatePerformance {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export class EmailTemplatesRepository {
  /**
   * Create a new email template
   */
  static async create(
    templateData: Omit<NewTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Template> {
    const template = {
      ...templateData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [inserted] = await db.insert(templates).values(template).returning();
    return inserted;
  }

  /**
   * Find template by ID
   */
  static async findById(id: string): Promise<Template | null> {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);

    return template || null;
  }

  /**
   * Find template by name
   */
  static async findByName(name: string): Promise<Template | null> {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.name, name))
      .limit(1);

    return template || null;
  }

  /**
   * Find templates by category
   */
  static async findByCategory(category: string): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(eq(templates.category, category))
      .orderBy(desc(templates.createdAt));
  }

  /**
   * Find templates by channel
   */
  static async findByChannel(channel: 'email' | 'sms' | 'chat'): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(eq(templates.channel, channel))
      .orderBy(desc(templates.createdAt));
  }

  /**
   * Get all active templates
   */
  static async findActive(): Promise<Template[]> {
    return db
      .select()
      .from(templates)
      .where(eq(templates.active, true))
      .orderBy(desc(templates.createdAt));
  }

  /**
   * Find templates with filters
   */
  static async findWithFilters(filters?: {
    category?: string;
    channel?: 'email' | 'sms' | 'chat';
    active?: boolean;
    search?: string;
  }): Promise<Template[]> {
    const conditions = [];

    if (filters?.category) {
      conditions.push(eq(templates.category, filters.category));
    }
    if (filters?.channel) {
      conditions.push(eq(templates.channel, filters.channel));
    }
    if (filters?.active !== undefined) {
      conditions.push(eq(templates.active, filters.active));
    }
    if (filters?.search) {
      conditions.push(
        or(
          like(templates.name, `%${filters.search}%`),
          like(templates.subject, `%${filters.search}%`),
          like(templates.content, `%${filters.search}%`)
        )
      );
    }

    const query = db.select().from(templates);
    
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return query.orderBy(desc(templates.createdAt));
  }

  /**
   * Update template
   */
  static async update(
    id: string,
    updates: Partial<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Template | null> {
    const [updated] = await db
      .update(templates)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(templates.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Toggle template active status
   */
  static async toggleActive(id: string): Promise<Template | null> {
    const template = await this.findById(id);
    if (!template) return null;

    const [updated] = await db
      .update(templates)
      .set({
        active: !template.active,
        updatedAt: new Date()
      })
      .where(eq(templates.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Delete template
   */
  static async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(templates)
      .where(eq(templates.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Clone a template
   */
  static async clone(id: string, newName: string): Promise<Template | null> {
    const original = await this.findById(id);
    if (!original) return null;

    const clonedData: Omit<NewTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      name: newName,
      description: original.description,
      channel: original.channel,
      subject: original.subject,
      content: original.content,
      variables: original.variables,
      category: original.category,
      active: original.active
    };

    return this.create(clonedData);
  }

  // Stub methods for performance tracking (can be implemented later)
  static async incrementPerformanceMetric(id: string, metric: string, increment: number = 1): Promise<Template | null> {
    return this.findById(id);
  }

  static async getTopPerformingTemplates(metric: string = 'openRate', limit: number = 10): Promise<Template[]> {
    return this.findActive();
  }
}