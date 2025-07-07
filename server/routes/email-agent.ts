import { Router } from "express";
import { nanoid } from "nanoid";
import { storage } from "../database/database-storage";
import { handleApiError } from "../utils/error-handler";

const router = Router();

// Email Agent endpoints
router.get("/agents", async (req, res) => {
  try {
    // For now, return mock data - replace with actual DB queries
    const agents = [
      {
        id: "agent_1",
        name: "Sales Specialist",
        role: "Senior Account Executive",
        endGoal: "Schedule qualified leads for product demos and convert them into paying customers",
        instructions: {
          dos: [
            "Personalize emails based on lead's industry",
            "Follow up within 24 hours",
            "Provide value in every interaction"
          ],
          donts: [
            "Don't use aggressive sales tactics",
            "Don't send more than 3 follow-ups",
            "Don't make unrealistic promises"
          ]
        },
        domainExpertise: ["SaaS", "B2B Sales", "Enterprise Software"],
        personality: "consultative",
        tone: "friendly",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: agents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.post("/agents", async (req, res) => {
  try {
    const agent = {
      id: `agent_${nanoid(10)}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to database
    await storage.createActivity(
      "email_agent_created",
      `Email agent "${agent.name}" created`,
      "system",
      { agentId: agent.id }
    );

    res.json({
      success: true,
      data: agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.put("/agents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    await storage.createActivity(
      "email_agent_updated",
      `Email agent updated`,
      "system",
      { agentId: id, updates: Object.keys(updates) }
    );

    res.json({
      success: true,
      data: { id, ...updates },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.delete("/agents/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await storage.createActivity(
      "email_agent_deleted",
      `Email agent deleted`,
      "system",
      { agentId: id }
    );

    res.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

// Email Campaign endpoints
router.get("/campaigns", async (req, res) => {
  try {
    // Mock data - replace with actual DB queries
    const campaigns = [
      {
        id: "campaign_1",
        name: "Q4 Sales Outreach",
        agentId: "agent_1",
        status: "active",
        templates: ["template_1", "template_2"],
        schedule: {
          id: "schedule_1",
          name: "Standard Follow-up"
        },
        stats: {
          sent: 150,
          opened: 45,
          clicked: 12,
          replied: 5
        }
      }
    ];

    res.json({
      success: true,
      data: campaigns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    const campaign = {
      id: `campaign_${nanoid(10)}`,
      ...req.body,
      status: req.body.status || "draft",
      stats: {
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await storage.createActivity(
      "email_campaign_created",
      `Email campaign "${campaign.name}" created`,
      "email_agent",
      { campaignId: campaign.id }
    );

    res.json({
      success: true,
      data: campaign,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.put("/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    await storage.createActivity(
      "email_campaign_updated",
      `Email campaign updated`,
      "email_agent",
      { campaignId: id }
    );

    res.json({
      success: true,
      data: { id, ...updates },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.put("/campaigns/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await storage.createActivity(
      "email_campaign_status_changed",
      `Email campaign status changed to ${status}`,
      "email_agent",
      { campaignId: id, status }
    );

    res.json({
      success: true,
      data: { id, status },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await storage.createActivity(
      "email_campaign_deleted",
      `Email campaign deleted`,
      "email_agent",
      { campaignId: id }
    );

    res.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleApiError(res, error);
  }
});

export default router;