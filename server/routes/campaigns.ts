import { Router } from 'express';
import { CampaignsRepository } from '../db';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const router = Router();

// Validation schemas
const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  goals: z.array(z.string()).min(1),
  qualificationCriteria: z.object({
    minCreditScore: z.number().optional(),
    minIncome: z.number().optional(),
    validStates: z.array(z.string()).optional(),
    requiredDocuments: z.array(z.string()).optional()
  }),
  channelPreferences: z.object({
    primary: z.enum(['email', 'sms', 'chat']),
    secondary: z.enum(['email', 'sms', 'chat']).optional(),
    timeRestrictions: z.record(z.object({
      start: z.string(),
      end: z.string()
    })).optional()
  })
});

const updateCampaignSchema = campaignSchema.partial().extend({
  active: z.boolean().optional()
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
    
    const { name, goals, qualificationCriteria, channelPreferences } = validationResult.data;
    
    // Check for duplicate name
    const existing = await CampaignsRepository.findByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Campaign with this name already exists' });
    }
    
    const campaign = await CampaignsRepository.create(
      name,
      goals,
      qualificationCriteria,
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
    
    const campaign = await CampaignsRepository.update(req.params.id, validationResult.data);
    
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

export default router;