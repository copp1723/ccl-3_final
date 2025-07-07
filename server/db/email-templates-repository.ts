import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { db } from './client';
import { emailTemplates, EmailTemplate, NewEmailTemplate } from './schema';
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
    templateData: Omit<NewEmailTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<EmailTemplate> {
    const template = {
      ...templateData,
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [inserted] = await db.insert(emailTemplates).values(template).returning();
    return inserted;
  }

  /**
   * Find template by ID
   */
  static async findById(id: string): Promise<EmailTemplate | null> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1);

    return template || null;
  }

  /**
   * Find template by name
   */
  static async findByName(name: string): Promise<EmailTemplate | null> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.name, name))
      .limit(1);

    return template || null;
  }

  /**
   * Find templates by category
   */
  static async findByCategory(category: string): Promise<EmailTemplate[]> {
    return db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.category, category))
      .orderBy(desc(emailTemplates.createdAt));
  }

  /**
   * Find templates by campaign
   */
  static async findByCampaign(campaignId: string): Promise<EmailTemplate[]> {
    return db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.campaignId, campaignId))
      .orderBy(desc(emailTemplates.createdAt));
  }

  /**
   * Find templates by agent
   */
  static async findByAgent(agentId: string): Promise<EmailTemplate[]> {
    return db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.agentId, agentId))
      .orderBy(desc(emailTemplates.createdAt));
  }

  /**
   * Get all active templates
   */
  static async findActive(): Promise<EmailTemplate[]> {
    return db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.active, true))
      .orderBy(desc(emailTemplates.createdAt));
  }

  /**
   * Get all templates
   */
  static async findAll(filters?: {
    category?: string;
    campaignId?: string;
    agentId?: string;
    active?: boolean;
    search?: string;
  }): Promise<EmailTemplate[]> {
    const conditions = [];

    if (filters?.category) {
      conditions.push(eq(emailTemplates.category, filters.category));
    }
    if (filters?.campaignId) {
      conditions.push(eq(emailTemplates.campaignId, filters.campaignId));
    }
    if (filters?.agentId) {
      conditions.push(eq(emailTemplates.agentId, filters.agentId));
    }
    if (filters?.active !== undefined) {
      conditions.push(eq(emailTemplates.active, filters.active));
    }
    if (filters?.search) {
      conditions.push(
        or(
          like(emailTemplates.name, `%${filters.search}%`),
          like(emailTemplates.subject, `%${filters.search}%`),
          like(emailTemplates.content, `%${filters.search}%`)
        )
      );
    }

    const query = db.select().from(emailTemplates);
    
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return query.orderBy(desc(emailTemplates.createdAt));
  }

  /**
   * Update template
   */
  static async update(
    id: string,
    updates: Partial<Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<EmailTemplate | null> {
    const [updated] = await db
      .update(emailTemplates)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(emailTemplates.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Toggle template active status
   */
  static async toggleActive(id: string): Promise<EmailTemplate | null> {
    const template = await this.findById(id);
    if (!template) return null;

    const [updated] = await db
      .update(emailTemplates)
      .set({
        active: !template.active,
        updatedAt: new Date()
      })
      .where(eq(emailTemplates.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Delete template
   */
  static async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Update template performance metrics
   */
  static async updatePerformance(
    id: string,
    metric: 'sent' | 'opened' | 'clicked' | 'replied',
    increment: number = 1
  ): Promise<EmailTemplate | null> {
    const template = await this.findById(id);
    if (!template) return null;

    const currentPerformance = template.performance || {
      sent: 0,
      opened: 0,
      clicked: 0,
      replied: 0
    };

    // Update the metric
    currentPerformance[metric] += increment;

    // Calculate rates
    if (currentPerformance.sent > 0) {
      currentPerformance.openRate = Math.round(
        (currentPerformance.opened / currentPerformance.sent) * 100
      );
      currentPerformance.clickRate = Math.round(
        (currentPerformance.clicked / currentPerformance.sent) * 100
      );
      currentPerformance.replyRate = Math.round(
        (currentPerformance.replied / currentPerformance.sent) * 100
      );
    }

    const [updated] = await db
      .update(emailTemplates)
      .set({
        performance: currentPerformance,
        updatedAt: new Date()
      })
      .where(eq(emailTemplates.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Clone a template
   */
  static async clone(id: string, newName: string): Promise<EmailTemplate | null> {
    const original = await this.findById(id);
    if (!original) return null;

    const cloned = await this.create({
      name: newName,
      subject: original.subject,
      content: original.content,
      plainText: original.plainText,
      category: original.category,
      variables: original.variables,
      campaignId: original.campaignId,
      agentId: original.agentId,
      active: true,
      performance: { sent: 0, opened: 0, clicked: 0, replied: 0 },
      metadata: {
        ...original.metadata,
        clonedFrom: original.id,
        clonedAt: new Date().toISOString()
      }
    });

    return cloned;
  }

  /**
   * Extract variables from template content
   */
  static extractVariables(content: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(content)) !== null) {
      variables.add(`{{${match[1].trim()}}}`);
    }

    return Array.from(variables);
  }

  /**
   * Replace variables in template
   */
  static replaceVariables(
    content: string,
    variables: Record<string, string>
  ): string {
    let result = content;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, value);
    });

    return result;
  }

  /**
   * Get top performing templates
   */
  static async getTopPerforming(
    metric: 'openRate' | 'clickRate' | 'replyRate' = 'openRate',
    limit: number = 10
  ): Promise<EmailTemplate[]> {
    const templates = await db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.active, true),
          sql`(performance->>'sent')::int > 10` // Only templates with meaningful data
        )
      )
      .orderBy(desc(sql`(performance->>'${metric}')::int`))
      .limit(limit);

    return templates;
  }

  /**
   * Create default templates
   */
  static async createDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      {
        name: 'Welcome Email',
        subject: 'Welcome to {{company}}!',
        content: `<h1>Hello {{name}}!</h1>
<p>Thank you for your interest in our services. We're excited to help you with your needs.</p>
<p>Our team will review your information and get back to you within 24 hours with personalized recommendations.</p>
<p>Best regards,<br>The {{company}} Team</p>`,
        plainText: `Hello {{name}}!\n\nThank you for your interest in our services. We're excited to help you with your needs.\n\nOur team will review your information and get back to you within 24 hours with personalized recommendations.\n\nBest regards,\nThe {{company}} Team`,
        category: 'initial_contact',
        variables: ['{{name}}', '{{company}}']
      },
      {
        name: 'Follow Up Email',
        subject: 'Quick follow up on your inquiry',
        content: `<p>Hi {{name}},</p>
<p>I wanted to follow up on your recent inquiry about {{service}}.</p>
<p>Have you had a chance to review the information I sent? I'd be happy to answer any questions you might have.</p>
<p>Looking forward to hearing from you!</p>
<p>Best,<br>{{agent_name}}</p>`,
        plainText: `Hi {{name}},\n\nI wanted to follow up on your recent inquiry about {{service}}.\n\nHave you had a chance to review the information I sent? I'd be happy to answer any questions you might have.\n\nLooking forward to hearing from you!\n\nBest,\n{{agent_name}}`,
        category: 'follow_up',
        variables: ['{{name}}', '{{service}}', '{{agent_name}}']
      }
    ];

    for (const template of defaultTemplates) {
      const existing = await this.findByName(template.name);
      if (!existing) {
        await this.create({
          ...template,
          active: true,
          performance: { sent: 0, opened: 0, clicked: 0, replied: 0 },
          metadata: { isDefault: true }
        });
      }
    }
  }
}