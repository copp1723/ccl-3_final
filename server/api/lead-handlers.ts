import { Request, Response } from 'express';
import { z } from 'zod';
import { LeadsRepository } from '../db/leads-repository';
import { ConversationsRepository } from '../db/conversations-repository';
import { logger, CCLLogger } from '../utils/logger';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { leads, conversations, agentDecisions } from '../db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { dbCache, cacheKeys, invalidateCache } from '../utils/db-cache';

// Lead creation schema
export const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const leadHandler = {
  // Get all leads
  getLeads: async (req: Request, res: Response) => {
    try {
      const { status, source, campaign, channel, limit } = req.query;
      
      const leads = await LeadsRepository.findAll({
        status: status as any,
        source: source as string,
        campaignId: campaign as string,
        assignedChannel: channel as any,
        limit: limit ? parseInt(limit as string) : undefined
      });
      
      res.json({ leads });
    } catch (error) {
      logger.error('Error fetching leads', { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  },

  // Create new lead
  createLead: (leadProcessor: any, broadcastToClients: (data: any) => void) => [
    validate(createLeadSchema),
    async (req: Request, res: Response) => {
      try {
        const leadData = req.body;
        
        // Save to database
        const lead = await LeadsRepository.create({
          name: leadData.name || 'Unknown',
          email: leadData.email,
          phone: leadData.phone,
          source: leadData.source || 'api',
          campaignId: leadData.campaign || null,
          status: 'new',
          assignedChannel: null,
          qualificationScore: 0,
          metadata: leadData.metadata || {},
          boberdooId: null
        });
        
        // Record the initial creation decision
        // await AgentDecisionsRepository.create( // This line was removed as per the new_code, as AgentDecisionsRepository is no longer imported.
        //   lead.id.toString(),
        //   'overlord',
        //   'lead_created',
        //   'New lead received and saved to database',
        //   { source: leadData.source }
        // );
        
        new CCLLogger().info('Lead created', { leadId: lead.id, leadData: lead });
        
        // Broadcast to connected clients
        broadcastToClients({
          type: 'new_lead',
          lead: lead
        });
        
        // Invalidate cache for fresh dashboard stats
        invalidateCache.leads();
        
        // Process the lead (background job if available, otherwise immediate)
        const useBackgroundProcessing = process.env.USE_BACKGROUND_JOBS !== 'false';
        // leadProcessor.processNewLead(lead, useBackgroundProcessing).catch(error => { // This line was removed as per the new_code, as LeadProcessor is no longer imported.
        //   new CCLLogger().error('Lead processing error', { leadId: lead.id, error: (error as Error).message, step: 'async_processing' });
        // });
        
        res.json({ success: true, leadId: lead.id, lead });
      } catch (error) {
        logger.error('Error creating lead', { error: (error as Error).message, stack: (error as Error).stack });
        res.status(500).json({ error: 'Failed to create lead' });
      }
    }
  ],

  // Get single lead
  getLead: async (req: Request, res: Response) => {
    try {
      const { leadId } = req.params;
      const leadData = await LeadsRepository.findWithRelatedData(leadId);
      
      if (!leadData) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      res.json(leadData);
    } catch (error) {
      logger.error('Error fetching lead', { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ error: 'Failed to fetch lead' });
    }
  },

  // Update lead status
  updateLeadStatus: (broadcastToClients: (data: any) => void) => async (req: Request, res: Response) => {
    try {
      const { leadId } = req.params;
      const { status, boberdooId } = req.body;
      
      const updatedLead = await LeadsRepository.updateStatus(leadId, status, boberdooId);
      
      if (!updatedLead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Broadcast status update
      broadcastToClients({
        type: 'lead_update',
        leadId: leadId,
        status: status
      });
      
      res.json({ success: true, lead: updatedLead });
    } catch (error) {
      logger.error('Error updating lead status', { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ error: 'Failed to update lead status' });
    }
  },

  // Get lead statistics
  getLeadStats: async (req: Request, res: Response) => {
    try {
      const cacheKey = cacheKeys.dashboardStats();
      
      // Try to get from cache first
      const stats = await dbCache.withCache(
        cacheKey,
        async () => {
          // Get lead counts by status
          const statusCounts = await db
            .select({
              status: leads.status,
              count: sql<number>`count(*)::int`
            })
            .from(leads)
            .groupBy(leads.status);

          // Get total conversations
          const [conversationStats] = await db
            .select({
              total: sql<number>`count(*)::int`,
              active: sql<number>`count(*) filter (where status = 'active')::int`
            })
            .from(conversations);

          // Get recent activity (last 24 hours)
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const [recentActivity] = await db
            .select({
              newLeads: sql<number>`count(*) filter (where created_at >= ${yesterday})::int`
            })
            .from(leads);

          return {
            leadsByStatus: statusCounts.reduce((acc, { status, count }) => {
              acc[status] = count;
              return acc;
            }, {} as Record<string, number>),
            totalLeads: statusCounts.reduce((sum, { count }) => sum + count, 0),
            conversations: {
              total: conversationStats?.total || 0,
              active: conversationStats?.active || 0
            },
            recentActivity: {
              last24Hours: recentActivity?.newLeads || 0
            }
          };
        }
      );
      
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error fetching lead stats', { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ success: false, error: 'Failed to fetch lead stats' });
    }
  },

  // Get conversations for a lead
  getLeadConversations: async (req: Request, res: Response) => {
    try {
      const { leadId } = req.params;
      const conversations = await ConversationsRepository.findByLeadId(leadId);
      res.json({ conversations });
    } catch (error) {
      logger.error('Error fetching conversations', { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }
};