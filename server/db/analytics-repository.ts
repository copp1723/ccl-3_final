import { db } from './client';
import { analyticsEvents, leads, campaigns, communications, conversations } from './schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface AnalyticsEventData {
  eventType: string;
  leadId?: string;
  campaignId?: string;
  userId?: string;
  channel?: 'email' | 'sms' | 'chat';
  value?: number;
  metadata?: Record<string, any>;
}

export class AnalyticsRepository {
  static async trackEvent(data: AnalyticsEventData) {
    const [event] = await db
      .insert(analyticsEvents)
      .values({
        id: nanoid(),
        ...data,
        value: data.value || 1,
        metadata: data.metadata || {},
        createdAt: new Date()
      })
      .returning();
    
    return event;
  }

  // Dashboard statistics
  static async getDashboardStats(startDate?: Date, endDate?: Date) {
    const dateConditions = [];
    if (startDate) dateConditions.push(gte(leads.createdAt, startDate));
    if (endDate) dateConditions.push(lte(leads.createdAt, endDate));

    // Total leads
    const [totalLeads] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(dateConditions.length > 0 ? and(...dateConditions) : undefined);

    // Leads by status
    const leadsByStatus = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`
      })
      .from(leads)
      .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
      .groupBy(leads.status);

    // Leads by channel
    const leadsByChannel = await db
      .select({
        channel: leads.assignedChannel,
        count: sql<number>`count(*)::int`
      })
      .from(leads)
      .where(
        and(
          ...(dateConditions.length > 0 ? dateConditions : []),
          sql`${leads.assignedChannel} IS NOT NULL`
        )
      )
      .groupBy(leads.assignedChannel);

    // Communications stats
    const [communicationStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) FILTER (WHERE status = 'sent')::int`,
        delivered: sql<number>`count(*) FILTER (WHERE status = 'delivered')::int`,
        failed: sql<number>`count(*) FILTER (WHERE status = 'failed')::int`
      })
      .from(communications);

    // Active campaigns
    const [activeCampaigns] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(eq(campaigns.active, true));

    // Conversion rate (leads sent to Boberdoo)
    const [conversions] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          ...(dateConditions.length > 0 ? dateConditions : []),
          sql`${leads.boberdooId} IS NOT NULL`
        )
      );

    const conversionRate = totalLeads.count > 0 
      ? (conversions.count / totalLeads.count) * 100 
      : 0;

    return {
      totalLeads: totalLeads.count,
      leadsByStatus,
      leadsByChannel,
      communicationStats,
      activeCampaigns: activeCampaigns.count,
      conversionRate: conversionRate.toFixed(2)
    };
  }

  // Lead analytics
  static async getLeadAnalytics(options?: {
    startDate?: Date;
    endDate?: Date;
    campaignId?: string;
    source?: string;
  }) {
    const conditions = [];
    
    if (options?.startDate) {
      conditions.push(gte(leads.createdAt, options.startDate));
    }
    
    if (options?.endDate) {
      conditions.push(lte(leads.createdAt, options.endDate));
    }
    
    if (options?.campaignId) {
      conditions.push(eq(leads.campaignId, options.campaignId));
    }
    
    if (options?.source) {
      conditions.push(eq(leads.source, options.source));
    }

    // Leads over time
    const leadsOverTime = await db
      .select({
        date: sql<string>`DATE(${leads.createdAt})`,
        count: sql<number>`count(*)::int`
      })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`DATE(${leads.createdAt})`)
      .orderBy(sql`DATE(${leads.createdAt})`);

    // Leads by source
    const leadsBySource = await db
      .select({
        source: leads.source,
        count: sql<number>`count(*)::int`
      })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(leads.source);

    // Average qualification score
    const [avgScore] = await db
      .select({
        average: sql<number>`AVG(${leads.qualificationScore})::float`
      })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Time to conversion
    const conversions = await db
      .select({
        leadId: leads.id,
        createdAt: leads.createdAt,
        convertedAt: sql<Date>`MIN(${analyticsEvents.createdAt})`
      })
      .from(leads)
      .leftJoin(
        analyticsEvents,
        and(
          eq(analyticsEvents.leadId, leads.id),
          eq(analyticsEvents.eventType, 'conversion')
        )
      )
      .where(
        and(
          ...(conditions.length > 0 ? conditions : []),
          sql`${analyticsEvents.id} IS NOT NULL`
        )
      )
      .groupBy(leads.id, leads.createdAt);

    const conversionTimes = conversions.map(c => {
      const timeDiff = c.convertedAt.getTime() - c.createdAt.getTime();
      return timeDiff / (1000 * 60 * 60); // Hours
    });

    const avgConversionTime = conversionTimes.length > 0
      ? conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
      : 0;

    return {
      leadsOverTime,
      leadsBySource,
      averageQualificationScore: avgScore.average || 0,
      averageConversionTimeHours: avgConversionTime.toFixed(2)
    };
  }

  // Campaign performance
  static async getCampaignPerformance(campaignId?: string) {
    const numericCampaignId = campaignId ? parseInt(campaignId, 10) : undefined;
    const campaignCondition = numericCampaignId && !isNaN(numericCampaignId) ? eq(leads.campaignId, numericCampaignId) : undefined;

    const performance = await db
      .select({
        campaignId: leads.campaignId,
        totalLeads: sql<number>`count(distinct ${leads.id})::int`,
        qualifiedLeads: sql<number>`count(distinct ${leads.id}) FILTER (WHERE ${leads.qualificationScore} >= 70)::int`,
        conversions: sql<number>`count(distinct ${leads.id}) FILTER (WHERE ${leads.boberdooId} IS NOT NULL)::int`,
        avgQualificationScore: sql<number>`AVG(${leads.qualificationScore})::float`,
        emailsSent: sql<number>`count(distinct ${communications.id}) FILTER (WHERE ${communications.channel} = 'email')::int`,
        smsSent: sql<number>`count(distinct ${communications.id}) FILTER (WHERE ${communications.channel} = 'sms')::int`,
        chats: sql<number>`count(distinct ${conversations.id}) FILTER (WHERE ${conversations.channel} = 'chat')::int`
      })
      .from(leads)
      .leftJoin(communications, eq(communications.leadId, leads.id))
      .leftJoin(conversations, eq(conversations.leadId, leads.id))
      .where(campaignCondition)
      .groupBy(leads.campaignId);

    return performance;
  }

  // Agent performance
  static async getAgentPerformance(startDate?: Date, endDate?: Date) {
    const dateConditions = [];
    if (startDate) dateConditions.push(gte(conversations.startedAt, startDate));
    if (endDate) dateConditions.push(lte(conversations.startedAt, endDate));

    const agentPerformance = await db
      .select({
        agentType: conversations.agentType,
        channel: conversations.channel,
        totalConversations: sql<number>`count(*)::int`,
        completedConversations: sql<number>`count(*) FILTER (WHERE ${conversations.status} = 'completed')::int`,
        avgMessagesPerConversation: sql<number>`AVG(jsonb_array_length(${conversations.messages}))::float`,
        avgDurationMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${conversations.endedAt} - ${conversations.startedAt}))/60)::float`
      })
      .from(conversations)
      .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
      .groupBy(conversations.agentType, conversations.channel);

    return agentPerformance;
  }

  // Communication analytics
  static async getCommunicationAnalytics(options?: {
    startDate?: Date;
    endDate?: Date;
    channel?: 'email' | 'sms' | 'chat';
  }) {
    const conditions = [];
    
    if (options?.startDate) {
      conditions.push(gte(communications.createdAt, options.startDate));
    }
    
    if (options?.endDate) {
      conditions.push(lte(communications.createdAt, options.endDate));
    }
    
    if (options?.channel) {
      conditions.push(eq(communications.channel, options.channel));
    }

    // Communications over time
    const communicationsOverTime = await db
      .select({
        date: sql<string>`DATE(${communications.createdAt})`,
        channel: communications.channel,
        count: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) FILTER (WHERE ${communications.status} = 'delivered')::int`,
        failed: sql<number>`count(*) FILTER (WHERE ${communications.status} = 'failed')::int`
      })
      .from(communications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`DATE(${communications.createdAt})`, communications.channel)
      .orderBy(sql`DATE(${communications.createdAt})`);

    // Success rates by channel
    const successRates = await db
      .select({
        channel: communications.channel,
        total: sql<number>`count(*)::int`,
        successful: sql<number>`count(*) FILTER (WHERE ${communications.status} IN ('sent', 'delivered'))::int`,
        successRate: sql<number>`(count(*) FILTER (WHERE ${communications.status} IN ('sent', 'delivered'))::float / count(*)::float * 100)`
      })
      .from(communications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(communications.channel);

    return {
      communicationsOverTime,
      successRates
    };
  }

  // Custom event tracking
  static async getEventMetrics(eventType: string, options?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const conditions = [eq(analyticsEvents.eventType, eventType)];
    
    if (options?.startDate) {
      conditions.push(gte(analyticsEvents.createdAt, options.startDate));
    }
    
    if (options?.endDate) {
      conditions.push(lte(analyticsEvents.createdAt, options.endDate));
    }

    const dateFormat = options?.groupBy === 'week' 
      ? sql`DATE_TRUNC('week', ${analyticsEvents.createdAt})`
      : options?.groupBy === 'month'
      ? sql`DATE_TRUNC('month', ${analyticsEvents.createdAt})`
      : sql`DATE(${analyticsEvents.createdAt})`;

    const metrics = await db
      .select({
        date: dateFormat,
        count: sql<number>`count(*)::int`,
        totalValue: sql<number>`SUM(${analyticsEvents.value})::int`,
        uniqueLeads: sql<number>`count(distinct ${analyticsEvents.leadId})::int`,
        uniqueUsers: sql<number>`count(distinct ${analyticsEvents.userId})::int`
      })
      .from(analyticsEvents)
      .where(and(...conditions))
      .groupBy(dateFormat)
      .orderBy(dateFormat);

    return metrics;
  }

  // Funnel analysis
  static async getFunnelAnalysis(startDate?: Date, endDate?: Date) {
    const dateConditions = [];
    if (startDate) dateConditions.push(gte(leads.createdAt, startDate));
    if (endDate) dateConditions.push(lte(leads.createdAt, endDate));

    const [funnel] = await db
      .select({
        totalLeads: sql<number>`count(distinct ${leads.id})::int`,
        contacted: sql<number>`count(distinct ${leads.id}) FILTER (WHERE ${leads.status} IN ('contacted', 'qualified', 'sent_to_boberdoo'))::int`,
        qualified: sql<number>`count(distinct ${leads.id}) FILTER (WHERE ${leads.status} IN ('qualified', 'sent_to_boberdoo'))::int`,
        converted: sql<number>`count(distinct ${leads.id}) FILTER (WHERE ${leads.status} = 'sent_to_boberdoo')::int`
      })
      .from(leads)
      .where(dateConditions.length > 0 ? and(...dateConditions) : undefined);

    return {
      stages: [
        { name: 'Total Leads', count: funnel.totalLeads, percentage: 100 },
        { 
          name: 'Contacted', 
          count: funnel.contacted, 
          percentage: funnel.totalLeads > 0 ? (funnel.contacted / funnel.totalLeads) * 100 : 0 
        },
        { 
          name: 'Qualified', 
          count: funnel.qualified, 
          percentage: funnel.totalLeads > 0 ? (funnel.qualified / funnel.totalLeads) * 100 : 0 
        },
        { 
          name: 'Converted', 
          count: funnel.converted, 
          percentage: funnel.totalLeads > 0 ? (funnel.converted / funnel.totalLeads) * 100 : 0 
        }
      ]
    };
  }
}