import { eq, desc, and } from 'drizzle-orm';
import { db } from './client';
import { conversations, Conversation, channelEnum, agentTypeEnum } from './schema';
import { nanoid } from 'nanoid';

export interface ConversationMessage {
  role: 'agent' | 'lead';
  content: string;
  timestamp: string;
}

export class ConversationsRepository {
  /**
   * Create a new conversation
   */
  static async create(
    leadId: string,
    channel: typeof channelEnum.enumValues[number],
    agentType: typeof agentTypeEnum.enumValues[number]
  ): Promise<Conversation> {
    const conversation = {
      id: nanoid(),
      leadId,
      channel,
      agentType,
      messages: [],
      status: 'active',
      startedAt: new Date(),
      endedAt: null
    };

    const [inserted] = await db.insert(conversations).values(conversation).returning();
    return inserted;
  }

  /**
   * Add a message to a conversation
   */
  static async addMessage(
    conversationId: string,
    message: ConversationMessage
  ): Promise<Conversation | null> {
    const conversation = await this.findById(conversationId);
    if (!conversation) return null;

    const updatedMessages = [
      ...conversation.messages,
      {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      }
    ];

    const [updated] = await db
      .update(conversations)
      .set({
        messages: updatedMessages
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }

  /**
   * Find conversation by ID
   */
  static async findById(id: string): Promise<Conversation | null> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    return conversation || null;
  }

  /**
   * Find all conversations for a lead
   */
  static async findByLeadId(leadId: string): Promise<Conversation[]> {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.leadId, leadId))
      .orderBy(desc(conversations.startedAt));
  }

  /**
   * Find active conversation for a lead and channel
   */
  static async findActiveConversation(
    leadId: string,
    channel: typeof channelEnum.enumValues[number]
  ): Promise<Conversation | null> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.leadId, leadId),
          eq(conversations.channel, channel),
          eq(conversations.status, 'active')
        )
      )
      .orderBy(desc(conversations.startedAt))
      .limit(1);

    return conversation || null;
  }

  /**
   * End a conversation
   */
  static async endConversation(
    conversationId: string,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<Conversation | null> {
    const [updated] = await db
      .update(conversations)
      .set({
        status,
        endedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }

  /**
   * Get conversation history for a lead
   */
  static async getConversationHistory(leadId: string): Promise<{
    channel: string;
    messages: ConversationMessage[];
    startedAt: Date;
    endedAt: Date | null;
  }[]> {
    const convos = await this.findByLeadId(leadId);
    
    return convos.map(conv => ({
      channel: conv.channel,
      messages: conv.messages,
      startedAt: conv.startedAt,
      endedAt: conv.endedAt
    }));
  }

  /**
   * Get active conversations count by channel
   */
  static async getActiveConversationsByChannel(): Promise<Record<string, number>> {
    const counts = await db
      .select({
        channel: conversations.channel,
        count: db.$count(conversations.id)
      })
      .from(conversations)
      .where(eq(conversations.status, 'active'))
      .groupBy(conversations.channel);

    return counts.reduce((acc, { channel, count }) => {
      acc[channel] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Update conversation status
   */
  static async updateStatus(
    conversationId: string,
    status: string
  ): Promise<Conversation | null> {
    const [updated] = await db
      .update(conversations)
      .set({ status })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }

  /**
   * Update cross-channel context for a conversation
   */
  static async updateCrossChannelContext(
    conversationId: string,
    context: {
      previousChannels?: string[];
      sharedNotes?: string[];
      leadPreferences?: Record<string, any>;
    }
  ): Promise<Conversation | null> {
    // Ensure all required properties are present
    const fullContext = {
      previousChannels: context.previousChannels || [],
      sharedNotes: context.sharedNotes || [],
      leadPreferences: context.leadPreferences || {}
    };

    const [updated] = await db
      .update(conversations)
      .set({
        crossChannelContext: fullContext
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }

  /**
   * Update qualification score for a conversation
   */
  static async updateQualificationScore(
    conversationId: string,
    score: number
  ): Promise<Conversation | null> {
    const [updated] = await db
      .update(conversations)
      .set({
        currentQualificationScore: score
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }

  /**
   * Update goal progress for a conversation
   */
  static async updateGoalProgress(
    conversationId: string,
    goalProgress: Record<string, boolean>
  ): Promise<Conversation | null> {
    const [updated] = await db
      .update(conversations)
      .set({
        goalProgress
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }

  /**
   * Update conversation with handover analysis results
   */
  static async updateWithHandoverAnalysis(
    conversationId: string,
    analysis: {
      qualificationScore?: number;
      goalProgress?: Record<string, boolean>;
      crossChannelContext?: {
        previousChannels?: string[];
        sharedNotes?: string[];
        leadPreferences?: Record<string, any>;
      };
    }
  ): Promise<Conversation | null> {
    const updateData: any = {};
    
    if (analysis.qualificationScore !== undefined) {
      updateData.currentQualificationScore = analysis.qualificationScore;
    }
    
    if (analysis.goalProgress) {
      updateData.goalProgress = analysis.goalProgress;
    }
    
    if (analysis.crossChannelContext) {
      updateData.crossChannelContext = analysis.crossChannelContext;
    }

    const [updated] = await db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated || null;
  }
}