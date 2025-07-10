import { Router } from 'express';
import { CampaignsRepository } from '../db';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { db } from '../db/client';
import { leads, campaigns } from '../db/schema';
import { eq, desc, isNull } from 'drizzle-orm';

const router = Router();

// Validation schemas
const handoverRecipientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string(),
  priority: z.enum(['high', 'medium', 'low'])
});

const handoverCriteriaSchema = z.object({
  qualificationScore: z.number().min(0).max(100),
  conversationLength: z.number().min(1),
  timeThreshold: z.number().min(1),
  keywordTriggers: z.array(z.string()),
  goalCompletionRequired: z.array(z.string()),
  handoverRecipients: z.array(handoverRecipientSchema)
});

const qualificationCriteriaSchema = z.object({
  minScore: z.number().min(0).max(100),
  requiredFields: z.array(z.string()),
  requiredGoals: z.array(z.string())
});

const channelPreferencesSchema = z.object({
  primary: z.enum(['email', 'sms', 'chat']),
  fallback: z.array(z.enum(['email', 'sms', 'chat']))
});

const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  goals: z.array(z.string()).min(1),
  qualificationCriteria: qualificationCriteriaSchema,
  handoverCriteria: handoverCriteriaSchema,
  channelPreferences: channelPreferencesSchema,
  selectedLeads: z.array(z.string()).optional()
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  goals: z.array(z.string()).min(1).optional(),
  qualificationCriteria: qualificationCriteriaSchema.optional(),
  handoverCriteria: handoverCriteriaSchema.optional(),
  channelPreferences: channelPreferencesSchema.optional(),
  active: z.boolean().optional(),
  selectedLeads: z.array(z.string()).optional()
});

// Get all campaigns
router.get('/api/campaigns', async (req, res) => {
  try {
    const { active, limit, offset } = req.query;
    
    const campaigns = active === 'true' 
      ? await CampaignsRepository.findActive()
      : await CampaignsRepository.findAll();
    
    // Apply pagination if requested
    let paginatedCampaigns = campaigns;
    if (limit || offset) {
      const start = parseInt(offset as string) || 0;
      const end = start + (parseInt(limit as string) || campaigns.length);
      paginatedCampaigns = campaigns.slice(start, end);
    }
    
    res.json({ 
      campaigns: paginatedCampaigns,
      total: campaigns.length,
      offset: parseInt(offset as string) || 0,
      limit: parseInt(limit as string) || campaigns.length
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get single campaign
router.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get campaign statistics
    const stats = await CampaignsRepository.getCampaignStats(req.params.id);
    
    res.json({ 
      campaign,
      stats
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// Create campaign
router.post('/api/campaigns', async (req, res) => {
  try {
    // Validate request body
    const validationResult = campaignSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationError.toString() 
      });
    }
    
    const { name, goals, qualificationCriteria, channelPreferences, handoverCriteria, selectedLeads } = validationResult.data;
    
    // Check for duplicate name
    const existing = await CampaignsRepository.findByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Campaign with this name already exists' });
    }
    
    const campaign = await CampaignsRepository.create(
      name,
      goals,
      qualificationCriteria,
      handoverCriteria,
      channelPreferences
    );
    
    res.status(201).json({ success: true, campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Update campaign
router.put('/api/campaigns/:id', async (req, res) => {
  try {
    // Validate request body
    const validationResult = updateCampaignSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationError.toString() 
      });
    }
    
    // Check if campaign exists
    const existing = await CampaignsRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Check for duplicate name if name is being changed
    if (validationResult.data.name && validationResult.data.name !== existing.name) {
      const duplicate = await CampaignsRepository.findByName(validationResult.data.name);
      if (duplicate) {
        return res.status(409).json({ error: 'Campaign with this name already exists' });
      }
    }
    
    const campaign = await CampaignsRepository.update(req.params.id, {
      ...(validationResult.data.name && { name: validationResult.data.name }),
      ...(validationResult.data.goals && { goals: validationResult.data.goals }),
      ...(validationResult.data.qualificationCriteria && { qualificationCriteria: validationResult.data.qualificationCriteria }),
      ...(validationResult.data.channelPreferences && { channelPreferences: validationResult.data.channelPreferences }),
      ...(validationResult.data.active !== undefined && { active: validationResult.data.active })
    });
    
    res.json({ success: true, campaign });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Toggle campaign active status
router.patch('/api/campaigns/:id/toggle', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.toggleActive(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json({ 
      success: true, 
      campaign,
      message: `Campaign ${campaign.active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling campaign:', error);
    res.status(500).json({ error: 'Failed to toggle campaign status' });
  }
});

// Delete campaign
router.delete('/api/campaigns/:id', async (req, res) => {
  try {
    // Check if campaign has associated leads
    const stats = await CampaignsRepository.getCampaignStats(req.params.id);
    
    if (stats && stats.totalLeads > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete campaign with associated leads',
        details: `This campaign has ${stats.totalLeads} associated leads`
      });
    }
    
    const deleted = await CampaignsRepository.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// Clone campaign
router.post('/api/campaigns/:id/clone', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'New campaign name is required' });
    }
    
    const original = await CampaignsRepository.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Check for duplicate name
    const existing = await CampaignsRepository.findByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Campaign with this name already exists' });
    }
    
    const cloned = await CampaignsRepository.create(
      name,
      original.goals,
      original.qualificationCriteria,
      original.handoverCriteria,
      original.channelPreferences
    );
    
    res.status(201).json({ 
      success: true, 
      campaign: cloned,
      message: 'Campaign cloned successfully'
    });
  } catch (error) {
    console.error('Error cloning campaign:', error);
    res.status(500).json({ error: 'Failed to clone campaign' });
  }
});

// Get campaign statistics
router.get('/api/campaigns/:id/stats', async (req, res) => {
  try {
    const stats = await CampaignsRepository.getCampaignStats(req.params.id);
    
    if (!stats) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: 'Failed to fetch campaign statistics' });
  }
});

// Get default campaign (fixing route order issue)
router.get('/api/campaigns-default', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.getDefaultCampaign();
    res.json({ campaign });
  } catch (error) {
    console.error('Error fetching default campaign:', error);
    res.status(500).json({ error: 'Failed to fetch default campaign' });
  }
});

// Associate templates with campaign
router.post('/api/campaigns/:id/templates', async (req, res) => {
  try {
    const { templateIds } = req.body;
    
    if (!Array.isArray(templateIds)) {
      return res.status(400).json({ error: 'templateIds must be an array' });
    }
    
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Update all templates to associate with this campaign
    const { EmailTemplatesRepository } = await import('../db');
    const updatedTemplates = [];
    
    for (const templateId of templateIds) {
      const template = await EmailTemplatesRepository.update(templateId, {
        campaignId: req.params.id
      });
      if (template) {
        updatedTemplates.push(template);
      }
    }
    
    res.json({
      success: true,
      campaign,
      associatedTemplates: updatedTemplates.length,
      templates: updatedTemplates
    });
  } catch (error) {
    console.error('Error associating templates:', error);
    res.status(500).json({ error: 'Failed to associate templates with campaign' });
  }
});

// Remove template association from campaign
router.delete('/api/campaigns/:id/templates/:templateId', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const { EmailTemplatesRepository } = await import('../db');
    const template = await EmailTemplatesRepository.update(req.params.templateId, {
      campaignId: null
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({
      success: true,
      message: 'Template disassociated from campaign'
    });
  } catch (error) {
    console.error('Error removing template association:', error);
    res.status(500).json({ error: 'Failed to remove template association' });
  }
});

// Get all templates for a campaign
router.get('/api/campaigns/:id/templates', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const { EmailTemplatesRepository } = await import('../db');
    const templates = await EmailTemplatesRepository.findAll({
      campaignId: req.params.id
    });
    
    res.json({
      campaign,
      templates,
      total: templates.length
    });
  } catch (error) {
    console.error('Error fetching campaign templates:', error);
    res.status(500).json({ error: 'Failed to fetch campaign templates' });
  }
});

// Associate leads with campaign
router.post('/api/campaigns/:id/leads', async (req, res) => {
  try {
    const { leadIds } = req.body;
    
    if (!Array.isArray(leadIds)) {
      return res.status(400).json({ error: 'leadIds must be an array' });
    }
    
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Update leads to associate with this campaign
    const { LeadsRepository } = await import('../db');
    const updatedLeads = [];
    
    for (const leadId of leadIds) {
      const lead = await LeadsRepository.findById(leadId);
      if (lead) {
        // Update the lead's campaignId
        const updatedLead = await db
          .update(leads)
          .set({ campaignId: req.params.id, updatedAt: new Date() })
          .where(eq(leads.id, leadId))
          .returning();
        
        if (updatedLead[0]) {
          updatedLeads.push(updatedLead[0]);
        }
      }
    }
    
    res.json({
      success: true,
      campaign,
      associatedLeads: updatedLeads.length,
      leads: updatedLeads
    });
  } catch (error) {
    console.error('Error associating leads:', error);
    res.status(500).json({ error: 'Failed to associate leads with campaign' });
  }
});

// Remove lead association from campaign
router.delete('/api/campaigns/:id/leads/:leadId', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const { LeadsRepository } = await import('../db');
    const lead = await LeadsRepository.findById(req.params.leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Remove campaign association
    const [updatedLead] = await db
      .update(leads)
      .set({ campaignId: null, updatedAt: new Date() })
      .where(eq(leads.id, req.params.leadId))
      .returning();
    
    res.json({
      success: true,
      message: 'Lead disassociated from campaign',
      lead: updatedLead
    });
  } catch (error) {
    console.error('Error removing lead association:', error);
    res.status(500).json({ error: 'Failed to remove lead association' });
  }
});

// Get all leads for a campaign
router.get('/api/campaigns/:id/leads', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const { LeadsRepository } = await import('../db');
    const campaignLeads = await LeadsRepository.findAll({
      campaignId: req.params.id
    });
    
    res.json({
      campaign,
      leads: campaignLeads,
      total: campaignLeads.length
    });
  } catch (error) {
    console.error('Error fetching campaign leads:', error);
    res.status(500).json({ error: 'Failed to fetch campaign leads' });
  }
});

// Get available leads (not associated with any campaign)
router.get('/api/campaigns/available-leads', async (req, res) => {
  try {
    const { LeadsRepository } = await import('../db');
    
    // Get leads without campaign association
    const availableLeads = await db
      .select()
      .from(leads)
      .where(isNull(leads.campaignId))
      .orderBy(desc(leads.createdAt));
    
    res.json({
      leads: availableLeads,
      total: availableLeads.length
    });
  } catch (error) {
    console.error('Error fetching available leads:', error);
    res.status(500).json({ error: 'Failed to fetch available leads' });
  }
});

// Update campaign handover criteria
router.put('/api/campaigns/:id/handover-criteria', async (req, res) => {
  try {
    const validationResult = handoverCriteriaSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationError.toString()
      });
    }
    
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const [updated] = await db
      .update(campaigns)
      .set({
        handoverCriteria: validationResult.data,
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, req.params.id))
      .returning();
    
    res.json({
      success: true,
      campaign: updated,
      message: 'Handover criteria updated successfully'
    });
  } catch (error) {
    console.error('Error updating handover criteria:', error);
    res.status(500).json({ error: 'Failed to update handover criteria' });
  }
});

export default router;