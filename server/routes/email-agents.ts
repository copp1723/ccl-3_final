import { Router } from "express";
import { AgentConfigurationsRepository } from "../db/agent-configurations-repository";
import { EmailTemplatesRepository } from "../db/email-templates-repository";
import { CampaignsRepository } from "../db/campaigns-repository";
import { nanoid } from "nanoid";

const router = Router();

// Email agent endpoints
router.get("/agents", async (req, res) => {
  try {
    // Get all email agents from database
    const agents = await AgentConfigurationsRepository.findByType('email');

    // Transform to match frontend expected format
    const transformedAgents = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      endGoal: agent.endGoal,
      instructions: agent.instructions,
      domainExpertise: agent.domainExpertise,
      personality: agent.personality,
      tone: agent.tone,
      isActive: agent.active,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString()
    }));

    res.json({
      success: true,
      data: transformedAgents,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error fetching email agents:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "AGENT_FETCH_ERROR",
        message: error.message || "Failed to fetch email agents",
        category: "database"
      }
    });
  }
});

router.post("/agents", async (req, res) => {
  try {
    // Create agent using repository
    const agent = await AgentConfigurationsRepository.create({
      ...req.body,
      type: 'email' // Ensure it's an email agent
    });

    // Transform to match frontend expected format
    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      endGoal: agent.endGoal,
      instructions: agent.instructions,
      domainExpertise: agent.domainExpertise,
      personality: agent.personality,
      tone: agent.tone,
      isActive: agent.active,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString()
    };

    res.json({
      success: true,
      data: transformedAgent,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error creating email agent:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "AGENT_CREATE_ERROR",
        message: error.message || "Failed to create email agent",
        category: "database"
      }
    });
  }
});

router.put("/agents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update agent using repository
    const agent = await AgentConfigurationsRepository.update(id, req.body);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: "AGENT_NOT_FOUND",
          message: "Agent not found",
          category: "not_found"
        }
      });
    }

    // Transform to match frontend expected format
    const transformedAgent = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      endGoal: agent.endGoal,
      instructions: agent.instructions,
      domainExpertise: agent.domainExpertise,
      personality: agent.personality,
      tone: agent.tone,
      isActive: agent.active,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString()
    };
    
    res.json({
      success: true,
      data: transformedAgent,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error updating email agent:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "AGENT_UPDATE_ERROR",
        message: error.message || "Failed to update email agent",
        category: "database"
      }
    });
  }
});

router.delete("/agents/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete agent using repository
    const deleted = await AgentConfigurationsRepository.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: "AGENT_NOT_FOUND",
          message: "Agent not found",
          category: "not_found"
        }
      });
    }
    
    res.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error deleting email agent:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "AGENT_DELETE_ERROR",
        message: error.message || "Failed to delete email agent",
        category: "database"
      }
    });
  }
});

// Email campaigns endpoints
router.get("/campaigns", async (req, res) => {
  try {
    // Get all campaigns from database
    const campaigns = await CampaignsRepository.findAll();

    // Transform to match frontend expected format
    const transformedCampaigns = await Promise.all(campaigns.map(async (campaign) => {
      // Get campaign stats
      const stats = await CampaignsRepository.getCampaignStats(campaign.id);
      
      return {
        id: campaign.id,
        name: campaign.name,
        goals: campaign.goals,
        qualificationCriteria: campaign.qualificationCriteria,
        channelPreferences: campaign.channelPreferences,
        status: campaign.active ? "active" : "inactive",
        templates: [], // TODO: Add template association
        schedule: null, // TODO: Add schedule association
        stats: stats ? {
          sent: stats.totalLeads,
          opened: 0, // TODO: Add email tracking
          clicked: 0, // TODO: Add email tracking
          replied: 0 // TODO: Add email tracking
        } : {
          sent: 0,
          opened: 0,
          clicked: 0,
          replied: 0
        },
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString()
      };
    }));

    res.json({
      success: true,
      data: transformedCampaigns,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error fetching campaigns:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "CAMPAIGN_FETCH_ERROR",
        message: error.message || "Failed to fetch campaigns",
        category: "database"
      }
    });
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    // Extract required fields and provide defaults
    const { name, goals, qualificationCriteria, handoverCriteria, channelPreferences } = req.body;
    
    // Create campaign using repository
    const campaign = await CampaignsRepository.create(
      name,
      goals || ['Convert lead to customer'],
      qualificationCriteria || {
        minScore: 5,
        requiredFields: ['email'],
        requiredGoals: ['Convert lead to customer']
      },
      handoverCriteria || {
        qualificationScore: 7,
        conversationLength: 5,
        keywordTriggers: ['ready to buy', 'interested', 'when can we meet'],
        timeThreshold: 300,
        goalCompletionRequired: ['Convert lead to customer']
      },
      channelPreferences || {
        primary: 'email',
        fallback: ['sms', 'chat']
      }
    );

    // Transform to match frontend expected format
    const transformedCampaign = {
      id: campaign.id,
      name: campaign.name,
      goals: campaign.goals,
      qualificationCriteria: campaign.qualificationCriteria,
      channelPreferences: campaign.channelPreferences,
      status: campaign.active ? "active" : "inactive",
      templates: [],
      schedule: null,
      stats: { sent: 0, opened: 0, clicked: 0, replied: 0 },
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString()
    };
    
    res.json({
      success: true,
      data: transformedCampaign,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "CAMPAIGN_CREATE_ERROR",
        message: error.message || "Failed to create campaign",
        category: "database"
      }
    });
  }
});

router.put("/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update campaign using repository
    const campaign = await CampaignsRepository.update(id, req.body);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CAMPAIGN_NOT_FOUND",
          message: "Campaign not found",
          category: "not_found"
        }
      });
    }

    // Transform to match frontend expected format
    const transformedCampaign = {
      id: campaign.id,
      name: campaign.name,
      goals: campaign.goals,
      qualificationCriteria: campaign.qualificationCriteria,
      channelPreferences: campaign.channelPreferences,
      status: campaign.active ? "active" : "inactive",
      templates: [],
      schedule: null,
      stats: { sent: 0, opened: 0, clicked: 0, replied: 0 },
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString()
    };
    
    res.json({
      success: true,
      data: transformedCampaign,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error updating campaign:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "CAMPAIGN_UPDATE_ERROR",
        message: error.message || "Failed to update campaign",
        category: "database"
      }
    });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete campaign using repository
    const deleted = await CampaignsRepository.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CAMPAIGN_NOT_FOUND",
          message: "Campaign not found",
          category: "not_found"
        }
      });
    }
    
    res.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error deleting campaign:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "CAMPAIGN_DELETE_ERROR",
        message: error.message || "Failed to delete campaign",
        category: "database"
      }
    });
  }
});

router.put("/campaigns/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Convert status to active boolean
    const active = status === "active";
    const campaign = await CampaignsRepository.update(id, { active });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CAMPAIGN_NOT_FOUND",
          message: "Campaign not found",
          category: "not_found"
        }
      });
    }
    
    res.json({
      success: true,
      data: { id, status: campaign.active ? "active" : "inactive" },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error updating campaign status:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "CAMPAIGN_STATUS_ERROR",
        message: error.message || "Failed to update campaign status",
        category: "database"
      }
    });
  }
});

// Email templates endpoints
router.get("/templates", async (req, res) => {
  try {
    // Get filters from query params
    const { category, campaignId, agentId, active, search } = req.query;
    
    // Get all templates from database with filters
    const templates = await EmailTemplatesRepository.findAll({
      category: category as string,
      campaignId: campaignId as string,
      agentId: agentId as string,
      active: active ? active === 'true' : undefined,
      search: search as string
    });

    // Transform to match frontend expected format
    const transformedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      subject: template.subject,
      category: template.category,
      content: template.content,
      variables: template.variables,
      isActive: template.active,
      performance: template.performance,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    }));

    res.json({
      success: true,
      data: transformedTemplates,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "TEMPLATE_FETCH_ERROR",
        message: error.message || "Failed to fetch templates",
        category: "database"
      }
    });
  }
});

router.post("/templates", async (req, res) => {
  try {
    // Extract variables from content automatically
    const variables = EmailTemplatesRepository.extractVariables(req.body.content || '');
    
    // Create template using repository
    const template = await EmailTemplatesRepository.create({
      ...req.body,
      variables,
      performance: { sent: 0, opened: 0, clicked: 0, replied: 0 }
    });

    // Transform to match frontend expected format
    const transformedTemplate = {
      id: template.id,
      name: template.name,
      subject: template.subject,
      category: template.category,
      content: template.content,
      variables: template.variables,
      isActive: template.active,
      performance: template.performance,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    };

    res.json({
      success: true,
      data: transformedTemplate,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error creating template:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "TEMPLATE_CREATE_ERROR",
        message: error.message || "Failed to create template",
        category: "database"
      }
    });
  }
});

// Email schedules endpoints
router.get("/schedules", async (req, res) => {
  try {
    // Return mock schedule data
    const schedules = [
      {
        id: "schedule-1",
        name: "Standard 5-Email Sequence",
        description: "Balanced follow-up sequence over 2 weeks",
        attempts: [
          { delayDays: 0, delayHours: 0, templateId: "template-1" },
          { delayDays: 1, delayHours: 0, templateId: "template-2" },
          { delayDays: 3, delayHours: 0, templateId: "template-3" },
          { delayDays: 7, delayHours: 0, templateId: "template-4" },
          { delayDays: 14, delayHours: 0, templateId: "template-5" }
        ],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "schedule-2", 
        name: "Quick 3-Email Follow-up",
        description: "Aggressive follow-up for hot leads",
        attempts: [
          { delayDays: 0, delayHours: 0, templateId: "template-1" },
          { delayDays: 1, delayHours: 0, templateId: "template-2" },
          { delayDays: 3, delayHours: 0, templateId: "template-4" }
        ],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "schedule-3",
        name: "Extended Nurture Sequence", 
        description: "Long-term relationship building",
        attempts: [
          { delayDays: 0, delayHours: 0, templateId: "template-1" },
          { delayDays: 2, delayHours: 0, templateId: "template-2" },
          { delayDays: 5, delayHours: 0, templateId: "template-3" },
          { delayDays: 10, delayHours: 0, templateId: "template-4" },
          { delayDays: 15, delayHours: 0, templateId: "template-5" },
          { delayDays: 21, delayHours: 0, templateId: "template-2" },
          { delayDays: 30, delayHours: 0, templateId: "template-4" }
        ],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "schedule-4",
        name: "Credit Challenge Focus",
        description: "Specialized sequence for credit-challenged leads", 
        attempts: [
          { delayDays: 0, delayHours: 0, templateId: "template-1" },
          { delayDays: 1, delayHours: 0, templateId: "template-3" },
          { delayDays: 3, delayHours: 0, templateId: "template-2" },
          { delayDays: 7, delayHours: 0, templateId: "template-3" }
        ],
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: schedules,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "SCHEDULE_FETCH_ERROR",
        message: error.message || "Failed to fetch schedules",
        category: "database"
      }
    });
  }
});

router.post("/schedules", async (req, res) => {
  try {
    const scheduleData = {
      id: nanoid(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: scheduleData,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error creating schedule:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "SCHEDULE_CREATE_ERROR",
        message: error.message || "Failed to create schedule",
        category: "database"
      }
    });
  }
});

// Template variable management endpoints
router.put("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Extract variables from content if updated
    let variables = req.body.variables;
    if (req.body.content) {
      variables = EmailTemplatesRepository.extractVariables(req.body.content);
    }
    
    // Update template using repository
    const template = await EmailTemplatesRepository.update(id, {
      ...req.body,
      variables
    });
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Template not found",
          category: "not_found"
        }
      });
    }

    // Transform to match frontend expected format
    const transformedTemplate = {
      id: template.id,
      name: template.name,
      subject: template.subject,
      category: template.category,
      content: template.content,
      variables: template.variables,
      isActive: template.active,
      performance: template.performance,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    };
    
    res.json({
      success: true,
      data: transformedTemplate,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error updating template:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "TEMPLATE_UPDATE_ERROR",
        message: error.message || "Failed to update template",
        category: "database"
      }
    });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await EmailTemplatesRepository.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Template not found",
          category: "not_found"
        }
      });
    }
    
    res.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "TEMPLATE_DELETE_ERROR",
        message: error.message || "Failed to delete template",
        category: "database"
      }
    });
  }
});

// Template variable replacement endpoint
router.post("/templates/:id/preview", async (req, res) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;
    
    const template = await EmailTemplatesRepository.findById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Template not found",
          category: "not_found"
        }
      });
    }

    // Replace variables in subject and content
    const previewSubject = EmailTemplatesRepository.replaceVariables(template.subject, variables || {});
    const previewContent = EmailTemplatesRepository.replaceVariables(template.content, variables || {});
    
    res.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        subject: previewSubject,
        content: previewContent,
        originalSubject: template.subject,
        originalContent: template.content,
        variables: template.variables,
        replacedVariables: variables || {}
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error generating template preview:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "TEMPLATE_PREVIEW_ERROR",
        message: error.message || "Failed to generate template preview",
        category: "processing"
      }
    });
  }
});

export default router;