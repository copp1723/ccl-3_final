// server/index-optimized.ts
// Progressive Enhancement Server - Starts minimal, loads features on demand
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';
import os from 'os';

import { logger } from './utils/logger';

// Lazy imports - only load when needed
const lazyImports = {
  db: () => import('./db'),
  ws: () => import('ws'),
  agents: () => import('./agents-lazy'),
  session: () => import('express-session'),
  redis: () => import('./utils/redis-simple'),
  emailWebhooks: () => import('./routes/email-webhooks'),
  emailConversationManager: () => import('./services/email-conversation-manager')
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration based on environment
// Default to 80% of 2GB (1638MB) if not specified, or 25% of total system memory (whichever is smaller)
const defaultMemoryLimit = Math.min(1638, Math.floor(os.totalmem() / 1024 / 1024 * 0.25));
const config = {
  enableAgents: process.env.ENABLE_AGENTS !== 'false',
  enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
  enableRedis: process.env.ENABLE_REDIS === 'true',
  enableMonitoring: process.env.ENABLE_MONITORING === 'true',
  memoryLimit: parseInt(process.env.MEMORY_LIMIT || String(defaultMemoryLimit)),
  port: process.env.PORT || 5000
};


// Create Express app
const app = express();
const server = createServer(app);

// Essential middleware only
app.use(express.json({ limit: '100kb' }));

// Memory monitoring - always enable for production environments
let memoryMonitor: NodeJS.Timer;
memoryMonitor = setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapPercentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);
  const rssUsedMB = Math.round(usage.rss / 1024 / 1024);
  
  // Check against configured memory limit
  const memoryUsagePercent = Math.round((rssUsedMB / config.memoryLimit) * 100);
  
  if (heapPercentage > 80 || memoryUsagePercent > 90) {
    logger.warn(`High memory usage: Heap: ${heapUsedMB}MB (${heapPercentage}%), RSS: ${rssUsedMB}MB (${memoryUsagePercent}% of ${config.memoryLimit}MB limit)`);
    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}, 30000); // Check every 30 seconds

// Health endpoint - always available
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
      limit: config.memoryLimit,
      percent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
      rssPercent: Math.round((mem.rss / 1024 / 1024 / config.memoryLimit) * 100)
    },
    features: config
  });
});

// Lazy-loaded modules
let db: any;
let wss: any;
let agents: any;

// Database connection helper
async function getDB() {
  if (!db) {
    const dbModule = await lazyImports.db();
    db = {
      LeadsRepository: dbModule.LeadsRepository,
      ConversationsRepository: dbModule.ConversationsRepository,
      AgentDecisionsRepository: dbModule.AgentDecisionsRepository,
      CommunicationsRepository: dbModule.CommunicationsRepository,
      closeConnection: dbModule.closeConnection
    };
  }
  return db;
}

// Lead schema
const leadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Email webhook routes (before session middleware)
if (process.env.EMAIL_TEMPLATES_ENABLED === 'true') {
  lazyImports.emailWebhooks().then(module => {
    app.use(module.default);
    logger.info('Email webhook routes loaded');
  }).catch(err => {
    logger.error('Failed to load email webhooks:', err);
  });
}

// API routes for missing endpoints (but specific routes below take precedence)
import apiRoutes from './routes/api-routes';
app.use('/api', apiRoutes);

// Core API Routes
app.get('/api/leads', async (req, res) => {
  try {
    const { LeadsRepository } = await getDB();
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const leads = await LeadsRepository.findAll({ limit });
    
    // Transform leads to match the expected format for LeadView component
    const transformedLeads = leads.map((lead: any) => {
      // Map database status to UI status
      let uiStatus: 'active' | 'replied' | 'handover' | 'completed' | 'unsubscribed' = 'active';
      if (lead.status === 'contacted' || lead.status === 'qualified') {
        uiStatus = 'active';
      } else if (lead.status === 'sent_to_boberdoo') {
        uiStatus = 'completed';
      } else if (lead.status === 'rejected' || lead.status === 'archived') {
        uiStatus = 'unsubscribed';
      }
      
      // Extract any stored progress or metrics from metadata
      const metadata = lead.metadata || {};
      const conversationMode = metadata.conversationMode || 'template';
      const templateProgress = metadata.templateProgress || {};
      const aiEngagement = metadata.aiEngagement;
      const metrics = metadata.metrics || {};
      
      return {
        id: lead.id,
        name: lead.name || 'Unknown',
        email: lead.email || '',
        phone: lead.phone || '',
        company: metadata.company || lead.campaign || '',
        status: uiStatus,
        conversationMode: conversationMode as 'template' | 'ai' | 'human',
        templateProgress: {
          current: templateProgress.current || 0,
          total: templateProgress.total || 5,
          lastSent: templateProgress.lastSent,
          nextScheduled: templateProgress.nextScheduled
        },
        aiEngagement: aiEngagement,
        metrics: {
          emailsSent: metrics.emailsSent || 0,
          emailsOpened: metrics.emailsOpened || 0,
          linksClicked: metrics.linksClicked || 0,
          repliesReceived: metrics.repliesReceived || 0
        },
        tags: metadata.tags || [lead.source, lead.campaign].filter(Boolean),
        createdAt: lead.createdAt?.toISOString() || new Date().toISOString(),
        lastActivity: lead.updatedAt?.toISOString() || lead.createdAt?.toISOString() || new Date().toISOString()
      };
    });
    
    // Return in consistent format with other endpoints
    res.json({ data: transformedLeads });
  } catch (error) {
    logger.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    // Validate input
    const data = leadSchema.parse(req.body);
    const { LeadsRepository, AgentDecisionsRepository } = await getDB();
    
    // Create lead
    const lead = await LeadsRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: data.source || 'api',
      status: 'new',
      qualificationScore: 0,
      metadata: data.metadata || {}
    });
    
    // Simple decision logging
    await AgentDecisionsRepository.create(
      lead.id,
      'system',
      'lead_created',
      'New lead received',
      { source: data.source }
    );
    
    // Initialize email conversation if enabled
    if (lead.email && process.env.EMAIL_TEMPLATES_ENABLED === 'true') {
      const { emailConversationManager } = await lazyImports.emailConversationManager();
      setImmediate(async () => {
        try {
          await emailConversationManager.initializeConversation(lead);
          logger.info(`Email conversation initialized for lead ${lead.id}`);
        } catch (error) {
          logger.error(`Failed to initialize email conversation for lead ${lead.id}:`, error);
        }
      });
    }
    
    // Process with agents if enabled and memory allows
    if (config.enableAgents && process.memoryUsage().rss < config.memoryLimit * 0.8 * 1024 * 1024) {
      // Lazy load agents
      if (!agents) {
        agents = await lazyImports.agents();
      }
      
      // Process in background to not block response
      setImmediate(async () => {
        try {
          await agents.processLead(lead);
          
          // Broadcast if WebSocket is enabled
          if (wss) {
            broadcastToClients({ type: 'lead_processed', lead });
          }
        } catch (error) {
          logger.error('Error processing lead:', error);
        }
      });
    }
    
    res.json({ success: true, leadId: lead.id, lead });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      logger.error('Error creating lead:', error);
      res.status(500).json({ error: 'Failed to create lead' });
    }
  }
});

app.get('/api/leads/:leadId', async (req, res) => {
  try {
    const { LeadsRepository } = await getDB();
    const lead = await LeadsRepository.findById(req.params.leadId);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(lead);
  } catch (error) {
    logger.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Simple communication endpoints (no heavy SDKs)
app.post('/api/communications/email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    
    // Use simple fetch instead of mailgun.js
    const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
      },
      body: new URLSearchParams({
        from: process.env.MAILGUN_FROM_EMAIL || 'noreply@example.com',
        to,
        subject,
        text: body
      })
    });
    
    const result = await response.json();
    res.json({ success: response.ok, id: result.id });
  } catch (error) {
    logger.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/communications/sms', async (req, res) => {
  try {
    const { to, body } = req.body;
    
    // Use simple fetch instead of twilio SDK
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: process.env.TWILIO_PHONE_NUMBER || '',
          To: to,
          Body: body
        })
      }
    );
    
    const result = await response.json();
    res.json({ success: response.ok, sid: result.sid });
  } catch (error) {
    logger.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// Email agents endpoint
app.get('/api/email-agents', async (req, res) => {
  try {
    // Return mock data for now
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
        isActive: true,
        emailsSent: 1247,
        responseRate: 23.5,
        conversions: 47,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "agent-2",
        name: "Support Assistant",
        role: "Customer Support Specialist",
        endGoal: "Resolve customer issues and provide excellent support experience",
        instructions: {
          dos: [
            "Respond within 2 hours",
            "Provide detailed solutions",
            "Follow up on resolution"
          ],
          donts: [
            "Don't dismiss concerns",
            "Avoid technical jargon",
            "Don't escalate unnecessarily"
          ]
        },
        domainExpertise: ["Customer Service", "Technical Support", "Problem Resolution"],
        personality: "helpful",
        isActive: true,
        emailsSent: 823,
        responseRate: 87.2,
        conversions: 156,
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    res.json(agents);
  } catch (error) {
    logger.error('Error fetching email agents:', error);
    res.status(500).json({ error: 'Failed to fetch email agents' });
  }
});

// Email agents endpoint (alternative path used by frontend)
app.get('/api/email/agents', async (req, res) => {
  try {
    // Return mock data for now
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
        isActive: true,
        emailsSent: 1247,
        responseRate: 23.5,
        conversions: 47,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "agent-2",
        name: "Support Assistant",
        role: "Customer Support Specialist",
        endGoal: "Resolve customer issues and provide excellent support experience",
        instructions: {
          dos: [
            "Respond within 2 hours",
            "Provide detailed solutions",
            "Follow up on resolution"
          ],
          donts: [
            "Don't dismiss concerns",
            "Avoid technical jargon",
            "Don't escalate unnecessarily"
          ]
        },
        domainExpertise: ["Customer Service", "Technical Support", "Problem Resolution"],
        personality: "helpful",
        isActive: true,
        emailsSent: 823,
        responseRate: 87.2,
        conversions: 156,
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    res.json({ data: agents });
  } catch (error) {
    logger.error('Error fetching email agents:', error);
    res.status(500).json({ error: 'Failed to fetch email agents' });
  }
});

// Email campaigns endpoint
app.get('/api/email/campaigns', async (req, res) => {
  try {
    // Return mock campaign data
    const campaigns = [
      {
        id: "campaign-1",
        name: "Welcome Series",
        agentId: "agent-1",
        status: "active",
        templates: ["welcome-1", "welcome-2", "welcome-3"],
        schedule: {
          type: "sequential",
          delays: [0, 24, 72] // hours
        },
        stats: {
          sent: 156,
          opened: 89,
          clicked: 23,
          replied: 12,
          bounced: 3
        },
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "campaign-2",
        name: "Follow-up Sequence",
        agentId: "agent-1",
        status: "active",
        templates: ["followup-1", "followup-2"],
        schedule: {
          type: "sequential",
          delays: [48, 168] // hours
        },
        stats: {
          sent: 89,
          opened: 52,
          clicked: 15,
          replied: 8,
          bounced: 1
        },
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    res.json({ data: campaigns });
  } catch (error) {
    logger.error('Error fetching email campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch email campaigns' });
  }
});

// Email campaigns POST endpoint - Create new campaign
app.post('/api/email/campaigns', async (req, res) => {
  try {
    const { name, agentId, description, conversationMode, templates, scheduleType, settings } = req.body;
    
    // Validate required fields
    if (!name || !agentId) {
      return res.status(400).json({ error: 'Campaign name and agent ID are required' });
    }
    
    // Create campaign object
    const campaign = {
      id: `campaign-${Date.now()}`, // Simple ID generation
      name,
      agentId,
      description: description || '',
      conversationMode: conversationMode || 'auto',
      status: 'draft',
      templates: templates || [],
      scheduleType: scheduleType || 'template',
      settings: settings || {
        sendTimeOptimization: false,
        enableAIMode: true,
        dailyLimit: 50,
        aiModeThreshold: 'first_reply',
        handoverGoal: '',
        handoverKeywords: [],
        handoverFollowUp: {
          enabled: false,
          daysAfterHandover: 3,
          maxAttempts: 2,
          daysBetweenAttempts: 2
        }
      },
      stats: {
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // TODO: Save to database when campaign storage is implemented
    // For now, just return success with the created campaign
    
    logger.info(`Campaign created: ${campaign.name} (${campaign.id})`);
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error creating email campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Email templates endpoints
app.get('/api/email/templates', async (req, res) => {
  try {
    // Return mock template data for now
    const templates = [
      {
        id: "template-1",
        name: "Welcome Email",
        subject: "Welcome to {{companyName}}, {{firstName}}!",
        content: `Hi {{firstName}},

Welcome to {{companyName}}! We're excited to have you on board.

Here's what you can expect:
- Personalized service from our team
- Regular updates on your {{vehicleInterest}} search
- Exclusive deals and financing options

If you have any questions, feel free to reach out to us at any time.

Best regards,
The {{companyName}} Team`,
        category: "welcome",
        variables: ["firstName", "companyName", "vehicleInterest"],
        isActive: true,
        createdAt: new Date('2024-01-01').toISOString()
      },
      {
        id: "template-2",
        name: "Follow-up Email",
        subject: "Still looking for your {{vehicleInterest}}, {{firstName}}?",
        content: `Hi {{firstName}},

I wanted to follow up on your interest in {{vehicleInterest}}.

We have some great new options that might be perfect for you:
- Competitive financing rates starting at {{interestRate}}%
- Extended warranty options
- Trade-in evaluations

Would you like to schedule a quick call to discuss your options?

Best regards,
{{agentName}}
{{companyName}}`,
        category: "followup",
        variables: ["firstName", "vehicleInterest", "interestRate", "agentName", "companyName"],
        isActive: true,
        createdAt: new Date('2024-01-05').toISOString()
      },
      {
        id: "template-3",
        name: "Special Offer",
        subject: "Exclusive offer for {{firstName}} - Limited time!",
        content: `Hi {{firstName}},

We have an exclusive offer just for you on {{vehicleInterest}}:

🎉 Special Financing: {{specialRate}}% APR
🎉 No payments for 90 days
🎉 Extended warranty included

This offer expires on {{expirationDate}}, so don't wait!

Click here to claim your offer: {{offerLink}}

Best regards,
{{agentName}}
{{companyName}}`,
        category: "promotion",
        variables: ["firstName", "vehicleInterest", "specialRate", "expirationDate", "offerLink", "agentName", "companyName"],
        isActive: true,
        createdAt: new Date('2024-01-10').toISOString()
      }
    ];
    
    res.json({ data: templates });
  } catch (error) {
    logger.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

app.post('/api/email/templates', async (req, res) => {
  try {
    const { name, subject, content, category, variables } = req.body;
    
    // Validate required fields
    if (!name || !subject || !content) {
      return res.status(400).json({ error: 'Template name, subject, and content are required' });
    }
    
    // Create template object
    const template = {
      id: `template-${Date.now()}`, // Simple ID generation
      name,
      subject,
      content,
      category: category || 'custom',
      variables: variables || [],
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    // TODO: Save to database when template storage is implemented
    // For now, just return success with the created template
    
    logger.info(`Template created: ${template.name} (${template.id})`);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error creating email template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

app.put('/api/email/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, content, category, variables } = req.body;
    
    // Validate required fields
    if (!name || !subject || !content) {
      return res.status(400).json({ error: 'Template name, subject, and content are required' });
    }
    
    // Create updated template object
    const template = {
      id,
      name,
      subject,
      content,
      category: category || 'custom',
      variables: variables || [],
      isActive: true,
      createdAt: new Date('2024-01-01').toISOString(), // Mock creation date
      updatedAt: new Date().toISOString()
    };
    
    // TODO: Update in database when template storage is implemented
    // For now, just return success with the updated template
    
    logger.info(`Template updated: ${template.name} (${template.id})`);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error updating email template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

app.delete('/api/email/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Delete from database when template storage is implemented
    // For now, just return success
    
    logger.info(`Template deleted: ${id}`);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    logger.error('Error deleting email template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// WebSocket setup (only if enabled)
if (config.enableWebSocket) {
  import('ws').then(({ WebSocketServer }) => {
    wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws: any) => {
      logger.info('WebSocket connection established');
      
      ws.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Handle basic messages
          switch (data.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
            case 'subscribe':
              ws.subscribed = true;
              break;
          }
        } catch (error) {
          logger.error('WebSocket message error:', error);
        }
      });
      
      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });
    });
  });
}

// Helper to broadcast to WebSocket clients
function broadcastToClients(data: any) {
  if (!wss) return;
  
  wss.clients.forEach((client: any) => {
    if (client.readyState === 1 && client.subscribed) {
      client.send(JSON.stringify(data));
    }
  });
}

// Serve static files
const staticPath = process.env.NODE_ENV === 'production'
  ? join(__dirname, './client')
  : join(__dirname, '../client/dist');

app.use(express.static(staticPath));

// Catch-all for React app
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(join(staticPath, 'index.html'));
});

// Start server
server.listen(config.port, () => {
  const mem = process.memoryUsage();
  logger.info(`CCL-3 Optimized Server started on port ${config.port}`);
  logger.info(`Memory: RSS: ${Math.round(mem.rss / 1024 / 1024)}MB, Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
  logger.info(`Memory limit configured: ${config.memoryLimit}MB (agents will process when RSS < ${Math.round(config.memoryLimit * 0.8)}MB)`);
  logger.info('Enabled features:', config);
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  logger.info('Shutting down gracefully...');
  
  if (memoryMonitor) {
    clearInterval(memoryMonitor);
  }
  
  server.close(async () => {
    try {
      if (db) {
        await db.closeConnection();
      }
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
}

// Export for testing
export { app, server };
