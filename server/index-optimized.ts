// server/index-optimized.ts
// Progressive Enhancement Server - Starts minimal, loads features on demand
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';

// Lazy imports - only load when needed
const lazyImports = {
  db: () => import('./db'),
  ws: () => import('ws'),
  agents: () => import('./agents-lazy'),
  session: () => import('express-session'),
  redis: () => import('./utils/redis-simple'),
  logger: () => import('./utils/logger-simple'),
  emailWebhooks: () => import('./routes/email-webhooks'),
  emailConversationManager: () => import('./services/email-conversation-manager')
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration based on environment
const config = {
  enableAgents: process.env.ENABLE_AGENTS !== 'false',
  enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
  enableRedis: process.env.ENABLE_REDIS === 'true',
  enableMonitoring: process.env.ENABLE_MONITORING === 'true',
  memoryLimit: parseInt(process.env.MEMORY_LIMIT || '512'),
  port: process.env.PORT || 5000
};

// Simple in-memory logger until real logger is needed
let logger: any = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: () => {} // No-op in production
};

// Create Express app
const app = express();
const server = createServer(app);

// Essential middleware only
app.use(express.json({ limit: '100kb' }));

// Memory monitoring
let memoryMonitor: NodeJS.Timer;
if (config.memoryLimit < 1024) {
  memoryMonitor = setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapPercentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);
    
    if (heapPercentage > 80) {
      logger.warn(`High memory usage: ${heapUsedMB}MB (${heapPercentage}%)`);
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }, 30000); // Check every 30 seconds
}

// Health endpoint - always available
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    memory: {
      used: Math.round(mem.heapUsed / 1024 / 1024),
      total: Math.round(mem.heapTotal / 1024 / 1024),
      percent: Math.round((mem.heapUsed / mem.heapTotal) * 100)
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

// Core API Routes
app.get('/api/leads', async (req, res) => {
  try {
    const { LeadsRepository } = await getDB();
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const leads = await LeadsRepository.findAll({ limit });
    res.json({ leads });
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
    if (config.enableAgents && process.memoryUsage().heapUsed < config.memoryLimit * 0.8 * 1024 * 1024) {
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
  logger.info(`Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
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
