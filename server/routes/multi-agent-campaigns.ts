import { Router } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { db } from '../db/client';
import { campaigns, agentConfigurations } from '../db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { getCommunicationHub } from '../agents/communication-hub';
import { CCLLogger } from '../utils/logger';

const router = Router();

// Validation schemas
const assignedAgentSchema = z.object({
  agentId: z.string(),
  channels: z.array(z.enum(['email', 'sms', 'chat'])),
  role: z.enum(['primary', 'secondary', 'fallback']),
  capabilities: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    chat: z.boolean()
  }),
  schedule: z.object({
    timezone: z.string(),
    workingHours: z.object({
      start: z.string(),
      end: z.string()
    }),
    workingDays: z.array(z.number())
  }).optional()
});

const messageCoordinationSchema = z.object({
  allowMultipleAgents: z.boolean(),
  messageGap: z.number().min(1).max(1440),
  handoffEnabled: z.boolean(),
  syncSchedules: z.boolean()
});

const multiAgentCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  assignedAgents: z.array(assignedAgentSchema),
  coordinationStrategy: z.enum(['round_robin', 'priority_based', 'channel_specific']),
  messageCoordination: messageCoordinationSchema,
  channelPreferences: z.object({
    primary: z.enum(['email', 'sms', 'chat']),
    fallback: z.array(z.enum(['email', 'sms', 'chat']))
  }),
  goals: z.array(z.string()),
  active: z.boolean().default(true)
});

// Get all multi-agent campaigns
router.get('/multi-agent-campaigns', async (req, res) => {
  try {
    const { active, limit, offset } = req.query;
    
    let allCampaigns;
    
    if (active === 'true') {
      allCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.active, true))
        .orderBy(desc(campaigns.createdAt));
    } else {
      allCampaigns = await db
        .select()
        .from(campaigns)
        .orderBy(desc(campaigns.createdAt));
    }
    
    // Filter to only include campaigns with assigned agents (multi-agent campaigns)
    const multiAgentCampaigns = allCampaigns.filter(campaign => 
      campaign.assignedAgents && Array.isArray(campaign.assignedAgents) && campaign.assignedAgents.length > 0
    );
    
    // Apply pagination if requested
    let paginatedCampaigns = multiAgentCampaigns;
    if (limit || offset) {
      const start = parseInt(offset as string) || 0;
      const end = start + (parseInt(limit as string) || multiAgentCampaigns.length);
      paginatedCampaigns = multiAgentCampaigns.slice(start, end);
    }
    
    res.json({ 
      campaigns: paginatedCampaigns,
      total: multiAgentCampaigns.length,
      offset: parseInt(offset as string) || 0,
      limit: parseInt(limit as string) || multiAgentCampaigns.length
    });
  } catch (error) {
    new CCLLogger().error('Error fetching multi-agent campaigns', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to fetch multi-agent campaigns' });
  }
});

// Get single multi-agent campaign
router.get('/multi-agent-campaigns/:id', async (req, res) => {
  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, parseInt(req.params.id)));
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get agent details for assigned agents
    const assignedAgentIds = campaign.assignedAgents?.map((a: any) => a.agentId) || [];
    let agentDetails: any[] = [];
    
    if (assignedAgentIds.length > 0) {
      agentDetails = await db
        .select()
        .from(agentConfigurations)
        .where(and(...assignedAgentIds.map(id => eq(agentConfigurations.id, id))));
    }
    
    res.json({
      campaign: {
        ...campaign,
        agentDetails
      }
    });
  } catch (error) {
    new CCLLogger().error('Error fetching multi-agent campaign', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to fetch multi-agent campaign' });
  }
});

// Create multi-agent campaign
router.post('/multi-agent-campaigns', async (req, res) => {
  try {
    // Validate request body
    const validationResult = multiAgentCampaignSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationError.toString() 
      });
    }
    
    const data = validationResult.data;
    
    // Check for duplicate name
    const existing = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.name, data.name));
      
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Campaign with this name already exists' });
    }
    
    // Validate that all assigned agents exist
    const agentIds = data.assignedAgents.map(a => a.agentId);
    const existingAgents = await db
      .select()
      .from(agentConfigurations)
      .where(and(...agentIds.map(id => eq(agentConfigurations.id, id))));
    
    if (existingAgents.length !== agentIds.length) {
      return res.status(400).json({ error: 'One or more assigned agents do not exist' });
    }
    
    // Create campaign
    const [campaign] = await db
      .insert(campaigns)
      .values({
        name: data.name,
        description: data.description,
        assignedAgents: data.assignedAgents,
        coordinationStrategy: data.coordinationStrategy,
        messageCoordination: data.messageCoordination,
        channelPreferences: data.channelPreferences,
        goals: data.goals,
        active: data.active,
        // Legacy fields for compatibility
        agentId: data.assignedAgents.find(a => a.role === 'primary')?.agentId || data.assignedAgents[0]?.agentId,
        status: data.active ? 'active' : 'draft'
      })
      .returning();
    
    // Initialize communication coordination
    const hub = getCommunicationHub();
    await hub.coordinateAgentMessages(
      campaign.id.toString(),
      '', // Will be set when leads are assigned
      agentIds,
      data.coordinationStrategy
    );
    
    new CCLLogger().info('Multi-agent campaign created', { 
      campaignId: campaign.id, 
      agentCount: data.assignedAgents.length,
      strategy: data.coordinationStrategy
    });
    
    res.status(201).json({ success: true, campaign });
  } catch (error) {
    new CCLLogger().error('Error creating multi-agent campaign', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to create multi-agent campaign' });
  }
});

// Update multi-agent campaign
router.put('/multi-agent-campaigns/:id', async (req, res) => {
  try {
    // Validate request body
    const validationResult = multiAgentCampaignSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationError.toString() 
      });
    }
    
    const data = validationResult.data;
    const campaignId = parseInt(req.params.id);
    
    // Check if campaign exists
    const [existing] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
      
    if (!existing) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Check for duplicate name if name is being changed
    if (data.name && data.name !== existing.name) {
      const duplicate = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.name, data.name));
        
      if (duplicate.length > 0) {
        return res.status(409).json({ error: 'Campaign with this name already exists' });
      }
    }
    
    // Validate assigned agents if they're being updated
    if (data.assignedAgents) {
      const agentIds = data.assignedAgents.map(a => a.agentId);
      const existingAgents = await db
        .select()
        .from(agentConfigurations)
        .where(and(...agentIds.map(id => eq(agentConfigurations.id, id))));
      
      if (existingAgents.length !== agentIds.length) {
        return res.status(400).json({ error: 'One or more assigned agents do not exist' });
      }
    }
    
    // Update campaign
    const [campaign] = await db
      .update(campaigns)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.assignedAgents && { assignedAgents: data.assignedAgents }),
        ...(data.coordinationStrategy && { coordinationStrategy: data.coordinationStrategy }),
        ...(data.messageCoordination && { messageCoordination: data.messageCoordination }),
        ...(data.channelPreferences && { channelPreferences: data.channelPreferences }),
        ...(data.goals && { goals: data.goals }),
        ...(data.active !== undefined && { active: data.active }),
        // Update legacy fields for compatibility
        ...(data.assignedAgents && { 
          agentId: data.assignedAgents.find(a => a.role === 'primary')?.agentId || data.assignedAgents[0]?.agentId 
        }),
        ...(data.active !== undefined && { status: data.active ? 'active' : 'draft' }),
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, campaignId))
      .returning();
    
    // Update coordination if agents or strategy changed
    if (data.assignedAgents || data.coordinationStrategy) {
      const hub = getCommunicationHub();
      const agentIds = data.assignedAgents?.map(a => a.agentId) || 
                     existing.assignedAgents?.map((a: any) => a.agentId) || [];
      const strategy = data.coordinationStrategy || existing.coordinationStrategy || 'channel_specific';
      
      await hub.coordinateAgentMessages(
        campaignId.toString(),
        '', // Will be set when leads are assigned
        agentIds,
        strategy as 'round_robin' | 'priority_based' | 'channel_specific'
      );
    }
    
    new CCLLogger().info('Multi-agent campaign updated', { 
      campaignId,
      updatedFields: Object.keys(data)
    });
    
    res.json({ success: true, campaign });
  } catch (error) {
    new CCLLogger().error('Error updating multi-agent campaign', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to update multi-agent campaign' });
  }
});

// Get coordination status for a campaign
router.get('/multi-agent-campaigns/:id/coordination', async (req, res) => {
  try {
    const campaignId = req.params.id;
    const hub = getCommunicationHub();
    
    const coordination = await hub.syncAgentSchedules(campaignId);
    
    if (!coordination) {
      return res.status(404).json({ error: 'No coordination found for this campaign' });
    }
    
    res.json({ coordination });
  } catch (error) {
    new CCLLogger().error('Error fetching coordination status', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to fetch coordination status' });
  }
});

// Coordinate agents for a specific lead
router.post('/multi-agent-campaigns/:id/coordinate-lead', async (req, res) => {
  try {
    const { leadId, strategy } = req.body;
    
    if (!leadId) {
      return res.status(400).json({ error: 'Lead ID is required' });
    }
    
    const campaignId = req.params.id;
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, parseInt(campaignId)));
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const hub = getCommunicationHub();
    const agentIds = campaign.assignedAgents?.map((a: any) => a.agentId) || [];
    const coordinationStrategy = strategy || campaign.coordinationStrategy || 'channel_specific';
    
    const coordinations = await hub.coordinateAgentMessages(
      campaignId,
      leadId,
      agentIds,
      coordinationStrategy as 'round_robin' | 'priority_based' | 'channel_specific'
    );
    
    res.json({ 
      success: true, 
      coordinations,
      message: `Coordinated ${coordinations.length} agent actions for lead ${leadId}`
    });
  } catch (error) {
    new CCLLogger().error('Error coordinating agents for lead', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to coordinate agents for lead' });
  }
});

// Get next communication action for a lead
router.get('/multi-agent-campaigns/:id/next-action/:leadId', async (req, res) => {
  try {
    const { id: campaignId, leadId } = req.params;
    
    const hub = getCommunicationHub();
    const nextAction = await hub.getNextCommunicationAction(leadId, campaignId);
    
    if (!nextAction) {
      return res.status(404).json({ 
        error: 'No next action available',
        message: 'All agents may have already contacted this lead recently'
      });
    }
    
    res.json({ nextAction });
  } catch (error) {
    new CCLLogger().error('Error getting next communication action', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to get next communication action' });
  }
});

// Get available agents for assignment
router.get('/multi-agent-campaigns/available-agents', async (req, res) => {
  try {
    const agents = await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.active, true))
      .orderBy(agentConfigurations.name);
    
    // Transform to include capabilities based on agent type
    const agentsWithCapabilities = agents.map(agent => ({
      ...agent,
      capabilities: {
        email: ['email', 'overlord'].includes(agent.type),
        sms: ['sms', 'overlord'].includes(agent.type),
        chat: ['chat', 'overlord'].includes(agent.type)
      }
    }));
    
    res.json({ agents: agentsWithCapabilities });
  } catch (error) {
    new CCLLogger().error('Error fetching available agents', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to fetch available agents' });
  }
});

export default router;