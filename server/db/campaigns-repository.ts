import { eq, desc, sql } from 'drizzle-orm';
import { db } from './client';
import { campaigns, Campaign, leads } from './schema';
import { nanoid } from 'nanoid';

export interface QualificationCriteria {
  minScore: number;
  requiredFields: string[];
  requiredGoals: string[];
}

export interface HandoverCriteria {
  qualificationScore: number;
  conversationLength: number;
  keywordTriggers: string[];
  timeThreshold: number;
  goalCompletionRequired: string[];
}

export interface ChannelPreferences {
  primary: 'email' | 'sms' | 'chat';
  fallback: ('email' | 'sms' | 'chat')[];
}

export class CampaignsRepository {
  /**
   * Create a new campaign
   */
  static async create(
    name: string,
    goals: string[],
    qualificationCriteria: QualificationCriteria,
    handoverCriteria: HandoverCriteria,
    channelPreferences: ChannelPreferences
  ): Promise<Campaign> {
    const campaign = {
      id: nanoid(),
      name,
      goals,
      qualificationCriteria,
      handoverCriteria,
      channelPreferences,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [inserted] = await db.insert(campaigns).values(campaign).returning();
    return inserted;
  }

  /**
   * Find campaign by ID
   */
  static async findById(id: string): Promise<Campaign | null> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    return campaign || null;
  }

  /**
   * Find campaign by name
   */
  static async findByName(name: string): Promise<Campaign | null> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.name, name))
      .limit(1);

    return campaign || null;
  }

  /**
   * Get all active campaigns
   */
  static async findActive(): Promise<Campaign[]> {
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.active, true))
      .orderBy(desc(campaigns.createdAt));
  }

  /**
   * Get all campaigns
   */
  static async findAll(): Promise<Campaign[]> {
    return db
      .select()
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt));
  }

  /**
   * Update campaign
   */
  static async update(
    id: string,
    updates: Partial<{
      name: string;
      goals: string[];
      qualificationCriteria: QualificationCriteria;
      channelPreferences: ChannelPreferences;
      active: boolean;
    }>
  ): Promise<Campaign | null> {
    const [updated] = await db
      .update(campaigns)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Toggle campaign active status
   */
  static async toggleActive(id: string): Promise<Campaign | null> {
    const campaign = await this.findById(id);
    if (!campaign) return null;

    const [updated] = await db
      .update(campaigns)
      .set({
        active: !campaign.active,
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Delete campaign
   */
  static async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(campaigns)
      .where(eq(campaigns.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Get default campaign
   */
  static async getDefaultCampaign(): Promise<Campaign> {
    const defaultCampaign = await this.findByName('Default Campaign');
    
    if (defaultCampaign) {
      return defaultCampaign;
    }

    // Create default campaign if it doesn't exist
    return this.create(
      'Default Campaign',
      ['Convert lead to customer', 'Gather contact information', 'Schedule appointment'],
      {
        minScore: 5,
        requiredFields: ['email', 'phone'],
        requiredGoals: ['Convert lead to customer']
      },
      {
        qualificationScore: 7,
        conversationLength: 5,
        keywordTriggers: ['ready to buy', 'interested', 'when can we meet'],
        timeThreshold: 300, // 5 minutes
        goalCompletionRequired: ['Convert lead to customer']
      },
      {
        primary: 'chat',
        fallback: ['email', 'sms']
      }
    );
  }

  /**
   * Get campaign statistics
   */
  static async getCampaignStats(campaignId: string): Promise<{
    totalLeads: number;
    leadsByStatus: Record<string, number>;
    leadsByChannel: Record<string, number>;
    conversionRate: number;
  } | null> {
    // Check if campaign exists
    const campaign = await this.findById(campaignId);
    if (!campaign) return null;

    // Get leads for this campaign
    const campaignLeads = await db
      .select({
        status: leads.status,
        assignedChannel: leads.assignedChannel,
        count: sql<number>`count(*)::int`
      })
      .from(leads)
      .where(eq(leads.campaign, campaign.name))
      .groupBy(leads.status, leads.assignedChannel);

    // Calculate statistics
    const stats = {
      totalLeads: 0,
      leadsByStatus: {} as Record<string, number>,
      leadsByChannel: {} as Record<string, number>,
      conversionRate: 0
    };

    campaignLeads.forEach(row => {
      stats.totalLeads += row.count;
      
      // Group by status
      if (row.status) {
        stats.leadsByStatus[row.status] = (stats.leadsByStatus[row.status] || 0) + row.count;
      }
      
      // Group by channel
      if (row.assignedChannel) {
        stats.leadsByChannel[row.assignedChannel] = (stats.leadsByChannel[row.assignedChannel] || 0) + row.count;
      }
    });

    // Calculate conversion rate
    const qualified = stats.leadsByStatus['qualified'] || 0;
    const sentToBoberdoo = stats.leadsByStatus['sent_to_boberdoo'] || 0;
    const converted = qualified + sentToBoberdoo;
    
    stats.conversionRate = stats.totalLeads > 0 
      ? Math.round((converted / stats.totalLeads) * 100) 
      : 0;

    return stats;
  }
}