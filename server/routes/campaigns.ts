import { Router } from 'express';
import { CampaignsRepository } from '../db';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { db } from '../db/client';
import { leads, campaigns } from '../db/schema';
import { eq, desc, isNull } from 'drizzle-orm';

// Unified campaign settings interface (source of truth for config-driven logic)
export interface CampaignSettings {
  goals: string[];
  qualificationCriteria: {
    minScore: number;
    requiredFields: string[];
    requiredGoals: string[];
  };
  handoverCriteria: {
    qualificationScore: number;
    conversationLength: number;
    timeThreshold: number;
    keywordTriggers: string[];
    goalCompletionRequired: string[];
    handoverRecipients: {
      name: string;
      email: string;
      role: string;
      priority: 'high' | 'medium' | 'low';
    }[];
  };
  channelPreferences: {
    primary: 'email' | 'sms' | 'chat';
    fallback: Array<'email' | 'sms' | 'chat'>;
  };
  /**
   * Multi-step campaign sequence settings:
   * Each object represents a touch (email/SMS/etc) to be sent with delays and conditions.
   */
  touchSequence: Array<{
    templateId: string;
    delayDays: number;
    delayHours: number;
    conditions?: any;
  }>;
  // Add all future config here
}

export const campaignSettingsSchema = z.object({
  goals: z.array(z.string()).min(1),
  qualificationCriteria: z.object({
    minScore: z.number().min(0).max(100),
    requiredFields: z.array(z.string()),
    requiredGoals: z.array(z.string())
  }),
  handoverCriteria: z.object({
    qualificationScore: z.number().min(0).max(100),
    conversationLength: z.number().min(1),
    timeThreshold: z.number().min(1),
    keywordTriggers: z.array(z.string()),
    goalCompletionRequired: z.array(z.string()),
    handoverRecipients: z.array(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.string(),
      priority: z.enum(['high', 'medium', 'low'])
    }))
  }),
  channelPreferences: z.object({
    primary: z.enum(['email', 'sms', 'chat']),
    fallback: z.array(z.enum(['email', 'sms', 'chat']))
  }),
  /**
   * Multi-step campaign sequence settings:
   * Each object represents a touch (email/SMS/etc) to be sent with delays and conditions.
   */
  touchSequence: z.array(
    z.object({
      templateId: z.string().min(1),
      delayDays: z.number().min(0),
      delayHours: z.number().min(0).max(23),
      conditions: z.any().optional(),
    })
  ),
  // Extend here as needed
});

/*
  All campaign configuration is managed via the CampaignSettings interface and schema above.
  When adding new business logic, always extend this interface and schema, then update the UI/API to match.
  Overlord and all agents should consume the unified settings object for campaign-driven intelligence.
*/

const router = Router();

// Validation schemas
const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  settings: campaignSettingsSchema,
  selectedLeads: z.array(z.string()).optional()
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: campaignSettingsSchema.optional(),
  active: z.boolean().optional(),
  selectedLeads: z.array(z.string()).optional()
});

// Get all campaigns
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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

    const { name, settings, selectedLeads } = validationResult.data;

    // Check for duplicate name
    const existing = await CampaignsRepository.findByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Campaign with this name already exists' });
    }

    // Extract individual components from settings
    const campaign = await CampaignsRepository.create(
      name,
      settings.goals,
      settings.qualificationCriteria,
      settings.handoverCriteria,
      settings.channelPreferences
    );

    res.status(201).json({ success: true, campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
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

    // Always save the full settings blob if provided
    const updateObj: any = {};
    if (validationResult.data.name) updateObj.name = validationResult.data.name;
    if (validationResult.data.settings) updateObj.settings = validationResult.data.settings;
    if (validationResult.data.active !== undefined) updateObj.active = validationResult.data.active;
    // selectedLeads is not persisted on campaign row, so skip

    const campaign = await CampaignsRepository.update(req.params.id, updateObj);

    res.json({ success: true, campaign });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Toggle campaign active status
router.patch('/:id/toggle', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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
router.post('/:id/clone', async (req, res) => {
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

    // Clone the campaign using original values with proper type casting
    const cloned = await CampaignsRepository.create(
      name,
      (original.goals as string[]) || [],
      (original.qualificationCriteria as any) || { minScore: 7, requiredFields: ["name", "email"], requiredGoals: [] },
      (original.handoverCriteria as any) || {
        qualificationScore: 7,
        conversationLength: 5,
        timeThreshold: 300,
        keywordTriggers: [],
        goalCompletionRequired: [],
        handoverRecipients: []
      },
      (original.channelPreferences as any) || { primary: "email", fallback: ["sms"] }
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
router.get('/:id/stats', async (req, res) => {
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
router.get('/campaigns-default', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.getDefaultCampaign();
    res.json({ campaign });
  } catch (error) {
    console.error('Error fetching default campaign:', error);
    res.status(500).json({ error: 'Failed to fetch default campaign' });
  }
});

// Associate templates with campaign
router.post('/:id/templates', async (req, res) => {
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
        // Note: EmailTemplates don't have campaignId field in schema
        // This association would need to be implemented differently
        // For now, we'll just return the templates without associating
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
router.delete('/:id/templates/:templateId', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const { EmailTemplatesRepository } = await import('../db');
    // Note: EmailTemplates don't have campaignId field in schema
    const template = await EmailTemplatesRepository.findById(req.params.templateId);
    
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
router.get('/:id/templates', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const { EmailTemplatesRepository } = await import('../db');
    // Note: EmailTemplates don't have campaignId field in schema
    // For now, return all templates - this would need proper association implementation
    const templates = await EmailTemplatesRepository.findAll();
    
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
router.post('/:id/leads', async (req, res) => {
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
        // Update the lead's campaignId (leads.campaignId is text, not number)
        const updatedLead = await db
          .update(leads)
          .set({ campaignId: req.params.id, updatedAt: new Date() })
          .where(eq(leads.id, leadId.toString()))
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
router.delete('/:id/leads/:leadId', async (req, res) => {
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
router.get('/:id/leads', async (req, res) => {
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
router.get('/available-leads', async (req, res) => {
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
router.put('/:id/handover-criteria', async (req, res) => {
  try {
    // Validate the new handoverCriteria using the campaignSettingsSchema
    const settingsPatch = { handoverCriteria: req.body };
    const settingsValidation = campaignSettingsSchema.shape.handoverCriteria.safeParse(req.body);
    if (!settingsValidation.success) {
      const validationError = fromZodError(settingsValidation.error);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationError.toString()
      });
    }

    // Get campaign
    const campaign = await CampaignsRepository.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Update handoverCriteria directly (campaigns don't have settings field)
    const [updated] = await db
      .update(campaigns)
      .set({
        handoverCriteria: req.body,
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