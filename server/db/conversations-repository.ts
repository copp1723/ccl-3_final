import { eq, desc, and } from 'drizzle-orm';
import { db } from './client';
import { communications, Communication, channelEnum } from './schema';
import { nanoid } from 'nanoid';

export interface ConversationMessage {
  role: 'agent' | 'lead';
  content: string;
  timestamp: string;
}

export class ConversationsRepository {
  /**
   * Create a new conversation (mapped to communication)
   */
  static async create(
    leadId: string,
    channel: typeof channelEnum.enumValues[number],
    content: string
  ): Promise<Communication> {
    const communication = {
      leadId,
      channel,
      direction: 'outbound' as const,
      content,
      status: 'pending' as const,
      createdAt: new Date()
    };

    const [inserted] = await db.insert(communications).values(communication).returning();
    return inserted;
  }

  /**
   * Find conversation by ID
   */
  static async findById(id: string): Promise<Communication | null> {
    const [communication] = await db
      .select()
      .from(communications)
      .where(eq(communications.id, id))
      .limit(1);

    return communication || null;
  }

  /**
   * Find all conversations for a lead
   */
  static async findByLeadId(leadId: string): Promise<Communication[]> {
    return db
      .select()
      .from(communications)
      .where(eq(communications.leadId, leadId))
      .orderBy(desc(communications.createdAt));
  }

  /**
   * Stub methods for compatibility
   */
  static async addMessage(conversationId: string, message: ConversationMessage): Promise<Communication | null> {
    // For now, just return the existing communication
    return this.findById(conversationId);
  }

  static async findActiveByChannel(leadId: string, channel: typeof channelEnum.enumValues[number]): Promise<Communication | null> {
    const [communication] = await db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.leadId, leadId),
          eq(communications.channel, channel)
        )
      )
      .orderBy(desc(communications.createdAt))
      .limit(1);

    return communication || null;
  }

  static async endConversation(conversationId: string, status: 'delivered' | 'failed' = 'delivered'): Promise<Communication | null> {
    const [updated] = await db
      .update(communications)
      .set({ status })
      .where(eq(communications.id, conversationId))
      .returning();

    return updated || null;
  }

  // Stub methods that return empty/default values
  static async getActiveConversationCountsByChannel(): Promise<Record<string, number>> {
    return {};
  }

  static async updateConversationStatus(conversationId: string, status: string): Promise<Communication | null> {
    return this.findById(conversationId);
  }

  static async updateCrossChannelContext(conversationId: string, context: any): Promise<Communication | null> {
    return this.findById(conversationId);
  }

  static async updateQualificationScore(conversationId: string, score: number): Promise<Communication | null> {
    return this.findById(conversationId);
  }

  static async updateGoalProgress(conversationId: string, goalProgress: Record<string, boolean>): Promise<Communication | null> {
    return this.findById(conversationId);
  }

  static async updateConversationMetrics(conversationId: string, metrics: any): Promise<Communication | null> {
    return this.findById(conversationId);
  }
}