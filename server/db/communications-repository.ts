import { eq, desc, and } from 'drizzle-orm';
import { db } from './client';
import { communications, channelEnum } from './schema';
import { nanoid } from 'nanoid';

export interface Communication {
  id: string;
  leadId: string;
  channel: typeof channelEnum.enumValues[number];
  direction: 'inbound' | 'outbound';
  content: string;
  status: string;
  externalId: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

// Helper to cast database result to Communication type
const toCommunication = (dbRow: any): Communication => ({
  ...dbRow,
  direction: dbRow.direction as 'inbound' | 'outbound'
});

export class CommunicationsRepository {
  /**
   * Create a new communication record
   */
  static async create(
    leadId: string,
    channel: typeof channelEnum.enumValues[number],
    direction: 'inbound' | 'outbound',
    content: string,
    status: string = 'pending',
    externalId?: string,
    metadata?: Record<string, any>
  ): Promise<Communication> {
    const communication = {
      id: nanoid(),
      leadId,
      channel,
      direction,
      content,
      status,
      externalId: externalId || null,
      metadata: metadata || {},
      createdAt: new Date()
    };

    const [inserted] = await db.insert(communications).values(communication).returning();
    return toCommunication(inserted);
  }

  /**
   * Find communication by ID
   */
  static async findById(id: string): Promise<Communication | null> {
    const [communication] = await db
      .select()
      .from(communications)
      .where(eq(communications.id, id))
      .limit(1);

    return communication ? toCommunication(communication) : null;
  }

  /**
   * Find communication by external ID (Twilio/Mailgun ID)
   */
  static async findByExternalId(externalId: string): Promise<Communication | null> {
    const [communication] = await db
      .select()
      .from(communications)
      .where(eq(communications.externalId, externalId))
      .limit(1);

    return communication ? toCommunication(communication) : null;
  }

  /**
   * Get all communications for a lead
   */
  static async findByLeadId(leadId: string): Promise<Communication[]> {
    const results = await db
      .select()
      .from(communications)
      .where(eq(communications.leadId, leadId))
      .orderBy(desc(communications.createdAt));
    return results.map(toCommunication);
  }

  /**
   * Get communications by channel and status
   */
  static async findByChannelAndStatus(
    channel: typeof channelEnum.enumValues[number],
    status: string
  ): Promise<Communication[]> {
    const results = await db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.channel, channel),
          eq(communications.status, status)
        )
      )
      .orderBy(desc(communications.createdAt));
    return results.map(toCommunication);
  }

  /**
   * Update communication status
   */
  static async updateStatus(
    id: string,
    status: string,
    metadata?: Record<string, any>
  ): Promise<Communication | null> {
    const communication = await this.findById(id);
    if (!communication) return null;

    const updateData: any = { status };
    
    if (metadata) {
      updateData.metadata = { ...communication.metadata, ...metadata };
    }

    const [updated] = await db
      .update(communications)
      .set(updateData)
      .where(eq(communications.id, id))
      .returning();

    return updated ? toCommunication(updated) : null;
  }

  /**
   * Update communication with external ID and metadata
   */
  static async updateWithExternalInfo(
    id: string,
    externalId: string,
    status: string,
    metadata?: Record<string, any>
  ): Promise<Communication | null> {
    const communication = await this.findById(id);
    if (!communication) return null;

    const [updated] = await db
      .update(communications)
      .set({
        externalId,
        status,
        metadata: metadata ? { ...communication.metadata, ...metadata } : communication.metadata
      })
      .where(eq(communications.id, id))
      .returning();

    return updated ? toCommunication(updated) : null;
  }

  /**
   * Get pending communications
   */
  static async getPendingCommunications(): Promise<Communication[]> {
    return db
      .select()
      .from(communications)
      .where(eq(communications.status, 'pending'))
      .orderBy(communications.createdAt);
  }

  /**
   * Get communication statistics
   */
  static async getStats(): Promise<{
    channel: string;
    direction: string;
    status: string;
    count: number;
  }[]> {
    const stats = await db
      .select({
        channel: communications.channel,
        direction: communications.direction,
        status: communications.status,
        count: db.$count(communications.id)
      })
      .from(communications)
      .groupBy(
        communications.channel,
        communications.direction,
        communications.status
      );

    return stats;
  }

  /**
   * Get recent communications
   */
  static async getRecent(limit: number = 50): Promise<Communication[]> {
    return db
      .select()
      .from(communications)
      .orderBy(desc(communications.createdAt))
      .limit(limit);
  }

  /**
   * Mark communications as failed with error message
   */
  static async markAsFailed(
    id: string,
    error: string
  ): Promise<Communication | null> {
    return this.updateStatus(id, 'failed', { error, failedAt: new Date().toISOString() });
  }
}