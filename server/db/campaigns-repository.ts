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
  handoverRecipients: {
    email: string;
    name: string;
    role: string;
    priority: 'high' | 'medium' | 'low';
  }[];
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
  static async findById(id: string | number): Promise<Campaign | null> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numericId)) return null;
    
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, numericId))
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
    id: string | number,
    updates: Partial<{
      name: string;
      goals: string[];
      qualificationCriteria: QualificationCriteria;
      channelPreferences: ChannelPreferences;
      active: boolean;
    }>
  ): Promise<Campaign | null> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numericId)) return null;
    
    const [updated] = await db
      .update(campaigns)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, numericId))
      .returning();

    return updated || null;
  }

  /**
   * Toggle campaign active status
   */
  static async toggleActive(id: string | number): Promise<Campaign | null> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numericId)) return null;
    
    const campaign = await this.findById(numericId);
    if (!campaign) return null;

    const [updated] = await db
      .update(campaigns)
      .set({
        active: !campaign.active,
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, numericId))
      .returning();

    return updated || null;
  }

  /**
   * Delete campaign
   */
  static async delete(id: string | number): Promise<boolean> {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numericId)) return false;
    
    const result = await db
      .delete(campaigns)
      .where(eq(campaigns.id, numericId))
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
        goalCompletionRequired: ['Convert lead to customer'],
        handoverRecipients: [
          {
            email: 'sales@company.com',
            name: 'Sales Team',
            role: 'Sales Representative',
            priority: 'high' as const
          }
        ]
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
  static async getCampaignStats(campaignId: string | number): Promise<{
    totalLeads: number;
    leadsByStatus: Record<string, number>;
    leadsByChannel: Record<string, number>;
    conversionRate: number;
  } | null> {
    const numericCampaignId = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId;
    if (isNaN(numericCampaignId)) return null;
    
    // Check if campaign exists
    const campaign = await this.findById(numericCampaignId);
    if (!campaign) return null;

    // Get leads for this campaign
    const campaignLeads = await db
      .select({
        status: leads.status,
        assignedChannel: leads.assignedChannel,
        count: sql<number>`count(*)::int`
      })
      .from(leads)
      .where(eq(leads.campaignId, campaign.id))
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