import { Router } from "express";
import { db } from "../../email-system/database/db";
import { nanoid } from "nanoid";

const router = Router();

// Email agent endpoints
router.get("/agents", async (req, res) => {
  try {
    // For now, return mock data until we implement the database schema
    const agents = [
      {
        id: "agent-1",
        name: "Sales Specialist",
        role: "Senior Sales Executive",
        endGoal: "Convert leads into paying customers through personalized email sequences",
        instructions: {
          dos: [
            "Personalize emails based on lead's industry",
            "Follow up within 24 hours",
            "Provide value in every email"
          ],
          donts: [
            "Don't use aggressive sales tactics",
            "Avoid spammy language",
            "Don't send more than 3 follow-ups without response"
          ]
        },
        domainExpertise: ["SaaS", "B2B Sales", "Enterprise Software"],
        personality: "professional",
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
    const agentData = {
      id: nanoid(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // TODO: Save to database when schema is ready
    
    res.json({
      success: true,
      data: agentData,
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
    const agentData = {
      ...req.body,
      id,
      updatedAt: new Date().toISOString()
    };

    // TODO: Update in database when schema is ready
    
    res.json({
      success: true,
      data: agentData,
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

    // TODO: Delete from database when schema is ready
    
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
    // Return mock data for now
    const campaigns = [
      {
        id: "campaign-1",
        name: "Q4 Sales Push",
        agentId: "agent-1",
        status: "active",
        templates: ["template-1", "template-2"],
        schedule: {
          id: "schedule-1",
          name: "Standard Follow-up"
        },
        stats: {
          sent: 150,
          opened: 75,
          clicked: 30,
          replied: 10
        }
      }
    ];

    res.json({
      success: true,
      data: campaigns,
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
    const campaignData = {
      id: nanoid(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // TODO: Save to database when schema is ready
    
    res.json({
      success: true,
      data: campaignData,
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
    const campaignData = {
      ...req.body,
      id,
      updatedAt: new Date().toISOString()
    };

    // TODO: Update in database when schema is ready
    
    res.json({
      success: true,
      data: campaignData,
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

    // TODO: Delete from database when schema is ready
    
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

    // TODO: Update status in database when schema is ready
    
    res.json({
      success: true,
      data: { id, status },
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
    // Return mock template data
    const templates = [
      {
        id: "template-1",
        name: "Welcome & Introduction",
        subject: "Welcome to Complete Car Loans - Let's Get You Approved!",
        category: "welcome",
        content: "Hi {{firstName}},\n\nWelcome to Complete Car Loans! I'm excited to help you find the perfect vehicle financing solution...",
        variables: ["firstName", "vehicleInterest"],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "template-2", 
        name: "24-Hour Follow-up",
        subject: "Quick Question About Your Car Loan Application",
        category: "followup",
        content: "Hi {{firstName}},\n\nI wanted to follow up on your interest in car financing. Do you have any questions about our pre-approval process?",
        variables: ["firstName", "preApprovalAmount"],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "template-3",
        name: "Credit Challenge Support", 
        subject: "Special Financing Options Available - Even with Credit Challenges",
        category: "credit-support",
        content: "Hi {{firstName}},\n\nI understand that credit challenges can make car shopping stressful. Good news - we specialize in helping people with all credit situations...",
        variables: ["firstName", "creditScore", "monthlyPayment"],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "template-4",
        name: "Approval Notification",
        subject: "🎉 You're Pre-Approved! Next Steps for {{firstName}}",
        category: "approval",
        content: "Congratulations {{firstName}}!\n\nYou've been pre-approved for up to {{preApprovalAmount}} in vehicle financing...",
        variables: ["firstName", "preApprovalAmount", "monthlyPayment"],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "template-5",
        name: "Vehicle Shopping Assistance",
        subject: "Found Some Great {{vehicleInterest}} Options For You!",
        category: "vehicle-assistance",
        content: "Hi {{firstName}},\n\nBased on your interest in {{vehicleInterest}}, I've found some excellent options that fit your budget...",
        variables: ["firstName", "vehicleInterest", "monthlyPayment"],
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: templates,
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
    const templateData = {
      id: nanoid(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: templateData,
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

export default router;