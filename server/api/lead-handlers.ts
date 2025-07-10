import { Request, Response } from 'express';
import { z } from 'zod';
import { LeadsRepository, AgentDecisionsRepository, ConversationsRepository } from '../db';
import { LeadProcessor } from '../services/lead-processor';
import { logger, CCLLogger } from '../utils/logger.js';
import { validate } from '../middleware/validation';

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
  createLead: (leadProcessor: LeadProcessor, broadcastToClients: (data: any) => void) => [
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
          campaignId: leadData.campaign ? parseInt(leadData.campaign, 10) : null,
          status: 'new',
          assignedChannel: null,
          qualificationScore: 0,
          metadata: leadData.metadata || {},
          boberdooId: null
        });
        
        // Record the initial creation decision
        await AgentDecisionsRepository.create(
          lead.id.toString(),
          'overlord',
          'lead_created',
          'New lead received and saved to database',
          { source: leadData.source }
        );
        
        new CCLLogger().info('Lead created', { leadId: lead.id, leadData: lead });
        
        // Notify clients about new lead
        broadcastToClients({
          type: 'new_lead',
          lead: lead
        });
        
        // Process the lead (background job if available, otherwise immediate)
        const useBackgroundProcessing = process.env.USE_BACKGROUND_JOBS !== 'false';
        leadProcessor.processNewLead(lead, useBackgroundProcessing).catch(error => {
          new CCLLogger().error('Lead processing error', { leadId: lead.id, error: (error as Error).message, step: 'async_processing' });
        });
        
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
      const [statusCounts, recentLeads] = await Promise.all([
        LeadsRepository.countByStatus(),
        LeadsRepository.getRecentLeads(5)
      ]);
      
      res.json({
        statusCounts,
        recentLeads,
        totalLeads: Object.values(statusCounts).reduce((sum, count) => sum + count, 0)
      });
    } catch (error) {
      logger.error('Error fetching lead stats', { error: (error as Error).message, stack: (error as Error).stack });
      res.status(500).json({ error: 'Failed to fetch lead statistics' });
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