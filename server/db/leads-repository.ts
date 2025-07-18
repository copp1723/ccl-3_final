import { eq, desc, and, or, gte, sql, ilike } from 'drizzle-orm';
import { db } from './client';
import { leads, conversations, agentDecisions, communications, Lead, NewLead } from './schema';
import { nanoid } from 'nanoid';

export class LeadsRepository {
  /**
   * Create a new lead
   */
  static async create(leadData: Omit<NewLead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const lead = {
      ...leadData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [inserted] = await db.insert(leads).values(lead).returning();
    return inserted;
  }

  /**
   * Find a lead by ID
   */
  static async findById(id: string | number): Promise<Lead | null> {
    const leadId = typeof id === 'number' ? id.toString() : id;
    if (!leadId) return null;
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    return lead || null;
  }

  /**
   * Find leads by status
   */
  static async findByStatus(status: Lead['status']): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.status, status)).orderBy(desc(leads.createdAt));
  }

  /**
   * Update lead status
   */
  static async updateStatus(id: string | number, status: Lead['status'], boberdooId?: string): Promise<Lead | null> {
    const leadId = typeof id === 'number' ? id.toString() : id;
    if (!leadId) return null;
    
    const updateData: Partial<Lead> = {
      status,
      updatedAt: new Date()
    };

    if (boberdooId) {
      updateData.boberdooId = boberdooId;
    }

    const [updated] = await db
      .update(leads)
      .set(updateData)
      .where(eq(leads.id, leadId))
      .returning();

    return updated || null;
  }

  /**
   * Update lead qualification score
   */
  static async updateQualificationScore(id: string | number, score: number): Promise<Lead | null> {
    const leadId = typeof id === 'number' ? id.toString() : id;
    if (!leadId) return null;
    
    const [updated] = await db
      .update(leads)
      .set({
        qualificationScore: score,
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId))
      .returning();

    return updated || null;
  }

  /**
   * Assign a channel to a lead
   */
  static async assignChannel(id: string | number, channel: Lead['assignedChannel']): Promise<Lead | null> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numericId)) return null;
    
    const [updated] = await db
      .update(leads)
      .set({
        assignedChannel: channel,
        updatedAt: new Date()
      })
      .where(eq(leads.id, numericId))
      .returning();

    return updated || null;
  }

  /**
   * Get all leads with optional filters
   */
  static async findAll(filters?: {
    status?: Lead['status'];
    source?: string;
    campaignId?: string | number;
    assignedChannel?: Lead['assignedChannel'];
    fromDate?: Date;
    limit?: number;
  }): Promise<Lead[]> {
    let query = db.select().from(leads);

    // Apply filters
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(leads.status, filters.status));
    }
    if (filters?.source) {
      conditions.push(eq(leads.source, filters.source));
    }
    if (filters?.campaignId) {
      const campaignId = typeof filters.campaignId === 'number' ? filters.campaignId.toString() : filters.campaignId;
      if (campaignId) {
        conditions.push(eq(leads.campaignId, campaignId));
      }
    }
    if (filters?.assignedChannel) {
      conditions.push(eq(leads.assignedChannel, filters.assignedChannel));
    }
    if (filters?.fromDate) {
      conditions.push(gte(leads.createdAt, filters.fromDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    query = query.orderBy(desc(leads.createdAt)) as typeof query;

    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }

    return await query;
  }

  /**
   * Get lead with all related data (conversations, decisions, communications)
   */
  static async findWithRelatedData(id: string) {
    const lead = await this.findById(id);
    if (!lead) return null;

    const [leadConversations, leadDecisions, leadCommunications] = await Promise.all([
      db.select().from(conversations).where(eq(conversations.leadId, id)),
      db.select().from(agentDecisions).where(eq(agentDecisions.leadId, id)),
      db.select().from(communications).where(eq(communications.leadId, id))
    ]);

    return {
      lead,
      conversations: leadConversations,
      decisions: leadDecisions,
      communications: leadCommunications
    };
  }

  /**
   * Update lead metadata
   */
  static async updateMetadata(id: string | number, metadata: Record<string, any>): Promise<Lead | null> {
    const leadId = typeof id === 'number' ? id.toString() : id;
    if (!leadId) return null;
    
    const lead = await this.findById(leadId);
    if (!lead) return null;

    const [updated] = await db
      .update(leads)
      .set({
        metadata: { ...lead.metadata, ...metadata },
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId))
      .returning();

    return updated || null;
  }

  /**
   * Count leads by status
   */
  static async countByStatus(): Promise<Record<string, number>> {
    const counts = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`
      })
      .from(leads)
      .groupBy(leads.status);

    return counts.reduce((acc, { status, count }) => {
      acc[status] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get recent leads for dashboard
   */
  static async getRecentLeads(limit: number = 10): Promise<Lead[]> {
    return db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(limit);
  }

  /**
   * Search leads by name, email, or phone
   */
  static async search(query: string): Promise<Lead[]> {
    const searchTerm = `%${query}%`;
    return db
      .select()
      .from(leads)
      .where(
        or(
          ilike(leads.name, searchTerm),
          ilike(leads.email, searchTerm),
          ilike(leads.phone, searchTerm)
        )
      )
      .orderBy(desc(leads.createdAt));
  }
}