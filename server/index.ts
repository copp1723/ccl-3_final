import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import session from 'express-session';
import MemoryStore from 'memorystore';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import boberdooRoutes from './routes/boberdoo';
import campaignsRoutes from './routes/campaigns';
import communicationsRoutes from './routes/communications';
import agentDecisionsRoutes from './routes/agent-decisions';
import importRoutes from './routes/import';
import emailAgentsRoutes from './routes/email-agents';
import emailTemplatesRoutes from './routes/email-templates';
import agentConfigurationsRoutes from './routes/agent-configurations';
import notificationsRoutes from './routes/notifications';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import analyticsRoutes from './routes/analytics';
import leadDetailsRoutes from './routes/lead-details';
import exportRoutes from './routes/export';
import systemHealthRoutes from './routes/system-health';
import queueMonitoringRoutes from './routes/queue-monitoring';
import monitoringRoutes from './routes/monitoring';
// import emailCampaignsRoutes from '../email-system/routes/email-campaigns'; // Temporarily disabled
import { closeConnection, LeadsRepository, ConversationsRepository, AgentDecisionsRepository, CommunicationsRepository, CampaignsRepository } from './db';
import { getOverlordAgent, getAgentByType, getEmailAgent, getSMSAgent, getChatAgent } from './agents';
import { nanoid } from 'nanoid';
import { globalErrorHandler, notFoundHandler, asyncHandler } from './utils/error-handler.js';
import { requestTimeout } from './middleware/error-handler';
import { sanitizeRequest, validate } from './middleware/validation';
import { feedbackService } from './services/feedback-service';
import { z } from 'zod';
import { logger, CCLLogger } from './utils/logger.js';
import { initializeRedis, closeRedisConnections } from './utils/redis.js';
import { ipRateLimit, cclApiRateLimit, addRateLimitInfo } from './middleware/rate-limit.js';
import { queueManager } from './workers/queue-manager.js';
import { performanceMonitor } from './utils/performance-monitor.js';
import { metricsCollector } from './utils/metrics.js';
import { healthChecker } from './utils/health-checker.js';
import { register } from 'prom-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize Redis and database connections
await initializeRedis();

// Initialize queue system (depends on Redis)
logger.info('Initializing queue system...');

// Initialize monitoring systems
logger.info('Initializing monitoring systems...');
try {
  // Performance monitor and health checker initialize themselves
  if (performanceMonitor.isReady() && healthChecker.isReady() && metricsCollector.isReady()) {
    logger.info('Monitoring systems initialized successfully', {
      components: ['performance-monitor', 'health-checker', 'metrics-collector']
    });
    CCLLogger.securityEvent('Monitoring systems initialized', 'low', {
      components: ['performance-monitor', 'health-checker', 'metrics-collector']
    });
  } else {
    logger.warn('Some monitoring components not ready at startup');
  }
} catch (error) {
  logger.error('Failed to initialize monitoring systems', {
    error: (error as Error).message
  });
}

// Session store
const MemoryStoreSession = MemoryStore(session);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeRequest);
app.use(requestTimeout(30000)); // 30 second timeout

// Prometheus metrics middleware for HTTP requests
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record HTTP metrics
    metricsCollector.getRegistry().getSingleMetric('ccl3_http_requests_total')?.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString(),
      user_tier: req.user?.tier || 'anonymous'
    });
    
    metricsCollector.getRegistry().getSingleMetric('ccl3_http_request_duration_seconds')?.observe({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString()
    }, duration);
  });
  
  next();
});

// Rate limiting and protection middleware
app.use(addRateLimitInfo); // Add rate limit info to responses
app.use(ipRateLimit); // Basic IP-based rate limiting

// Auth routes (before session middleware)
app.use(authRoutes);

// Boberdoo routes (before session middleware for API endpoints)
app.use(cclApiRateLimit, boberdooRoutes);

// Public API routes (before session middleware)
app.use('/api/webhooks', cclApiRateLimit, communicationsRoutes); // Webhooks don't need auth

// Protected API routes (will add auth middleware)
app.use(cclApiRateLimit, campaignsRoutes);
app.use(cclApiRateLimit, communicationsRoutes);
app.use(cclApiRateLimit, agentDecisionsRoutes);
app.use(cclApiRateLimit, importRoutes);
app.use(cclApiRateLimit, emailTemplatesRoutes);
app.use(cclApiRateLimit, agentConfigurationsRoutes);
app.use(cclApiRateLimit, notificationsRoutes);
app.use(cclApiRateLimit, usersRoutes);
app.use(cclApiRateLimit, analyticsRoutes);
app.use(cclApiRateLimit, leadDetailsRoutes);
app.use(cclApiRateLimit, exportRoutes);
app.use('/api/email', cclApiRateLimit, emailAgentsRoutes);
app.use('/api/system', systemHealthRoutes); // System health and monitoring
app.use('/api/queues', queueMonitoringRoutes); // Queue monitoring and management
app.use('/api/monitoring', monitoringRoutes); // Comprehensive monitoring and observability
// app.use('/api/email', emailCampaignsRoutes); // Temporarily disabled

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'ccl3-swarm-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // 24 hours
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      // Simple auth for now - replace with proper user management
      if (username === 'admin' && password === 'admin') {
        return done(null, { id: 1, username: 'admin' });
      }
      return done(null, false, { message: 'Invalid credentials' });
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  // Simple deserialize for now
  if (id === 1) {
    done(null, { id: 1, username: 'admin' });
  } else {
    done(new Error('User not found'));
  }
});

// Lead processing function - the heart of the system
// Can process immediately or queue for background processing
async function processNewLead(lead: any, useBackgroundJob: boolean = false) {
  if (useBackgroundJob && queueManager.isHealthy()) {
    // Queue lead for background processing
    try {
      const job = await queueManager.addLeadProcessingJob(lead.id, 'normal');
      CCLLogger.leadProcessing(lead.id, 'queued_for_background', { 
        jobId: job?.id,
        leadName: lead.name 
      });
      return { status: 'queued', jobId: job?.id };
    } catch (error) {
      logger.warn('Failed to queue lead for background processing, processing immediately', {
        leadId: lead.id,
        error: (error as Error).message
      });
      // Fall through to immediate processing
    }
  }
  try {
    CCLLogger.leadProcessing(lead.id, 'lead_started', { leadName: lead.name });
    
    // 1. Get Overlord Agent instance
    const overlord = getOverlordAgent();
    
    // 2. Get campaign data if available
    let campaign: any = undefined;
    if (lead.campaignId) {
      campaign = await CampaignsRepository.findById(lead.campaignId) || undefined;
    }
    
    // 3. Make routing decision
    const decision = await overlord.makeDecision({ lead, campaign });
    CCLLogger.agentDecision('overlord', decision.action, decision.reasoning || 'No reasoning provided', { leadId: lead.id, leadName: lead.name, decision });
    
    // 4. Check if the decision is to assign a channel
    if (decision.action === 'assign_channel' && decision.data.channel) {
      const channel = decision.data.channel;
      const agent = getAgentByType(channel);
      
      // 5. Generate initial contact message
      let messageContent = '';
      let subject = '';
      
      if (channel === 'email') {
        const emailAgent = getEmailAgent();
        messageContent = await emailAgent.generateInitialEmail(
          { lead, campaign },
          decision.data.initialMessageFocus || 'general inquiry'
        );
        subject = `Thank you for your interest${lead.campaign ? ` in ${lead.campaign}` : ''}`;
      } else if (channel === 'sms') {
        const smsAgent = getSMSAgent();
        messageContent = await smsAgent.generateInitialSMS(
          { lead, campaign },
          decision.data.initialMessageFocus || 'general inquiry'
        );
      } else if (channel === 'chat') {
        const chatAgent = getChatAgent();
        messageContent = await chatAgent.generateInitialMessage(
          { lead, campaign },
          decision.data.initialMessageFocus || 'general inquiry'
        );
      }
      
      // 6. Save the conversation
      const conversation = await ConversationsRepository.create(
        lead.id,
        channel,
        channel as any // channel is also the agent type for email/sms/chat
      );
      
      // Add the initial message to the conversation
      await ConversationsRepository.addMessage(conversation.id, {
        role: 'agent',
        content: messageContent,
        timestamp: new Date().toISOString()
      });
      
      // 7. Actually send the message
      let externalId = null;
      let sendStatus = 'pending';
      
      try {
        if (channel === 'email' && lead.email) {
          const emailAgent = getEmailAgent();
          const emailResult = await emailAgent.sendEmail(
            lead.email,
            subject,
            messageContent
          );
          externalId = emailResult.id;
          sendStatus = 'sent';
          CCLLogger.communicationSent('email', lead.id, { recipient: lead.email, externalId });
        } else if (channel === 'sms' && lead.phone) {
          const smsAgent = getSMSAgent();
          const smsResult = await smsAgent.sendSMS(lead.phone, messageContent);
          externalId = smsResult.sid;
          sendStatus = 'sent';
          CCLLogger.communicationSent('sms', lead.id, { recipient: lead.phone, externalId });
        } else if (channel === 'chat') {
          // Chat sessions are handled differently - they're initiated when user engages
          sendStatus = 'waiting_for_user';
          CCLLogger.communicationSent('chat', lead.id, { leadName: lead.name, status: 'waiting_for_user' });
        }
        
        // 8. Record the communication
        if (externalId || channel === 'chat') {
          await CommunicationsRepository.create(
            lead.id,
            channel,
            'outbound',
            messageContent,
            sendStatus,
            externalId,
            { conversationId: conversation.id }
          );
        }
      } catch (sendError) {
        CCLLogger.communicationFailed(channel as 'email' | 'sms' | 'chat', lead.id, sendError as Error, { messageContent });
        sendStatus = 'failed';
        
        // Still record the failed attempt
        await CommunicationsRepository.create(
          lead.id,
          channel,
          'outbound',
          messageContent,
          'failed',
          undefined,
          { error: (sendError as Error).message, conversationId: conversation.id }
        );
      }
      
      // 9. Broadcast updates to WebSocket clients
      broadcastToClients({
        type: 'lead_processed',
        lead,
        decision,
        conversation: {
          id: conversation.id,
          content: messageContent,
          channel,
          status: sendStatus
        }
      });
      
      // 10. Update lead qualification score based on initial engagement
      const newScore = Math.min(lead.qualificationScore + 10, 100);
      await LeadsRepository.updateQualificationScore(lead.id, newScore);
      
      // Send success feedback
      feedbackService.success(`Lead ${lead.name} assigned to ${channel} channel`);
      
    } else if (decision.action === 'send_to_boberdoo') {
      // Lead is already qualified, send directly to Boberdoo
      CCLLogger.externalApiCall('boberdoo', '/lead', 'POST', { leadId: lead.id, leadName: lead.name });
      const boberdooResult = await overlord.submitToBoberdoo(lead);
      
      broadcastToClients({
        type: 'lead_sent_to_boberdoo',
        lead,
        result: boberdooResult
      });
      
      // Send notification
      feedbackService.leadQualified(lead);
    }
    
  } catch (error) {
    CCLLogger.leadError(lead.id, error as Error, { leadName: lead.name, step: 'lead_processing' });
    
    // Record the error as a decision
    await AgentDecisionsRepository.create(
      lead.id,
      'overlord',
      'processing_error',
      `Error processing lead: ${(error as Error).message}`,
      { error: (error as Error).toString() }
    );
    
    // Notify clients of the error
    broadcastToClients({
      type: 'lead_processing_error',
      lead,
      error: (error as Error).message
    });
    
    // Send error feedback
    feedbackService.error(`Failed to process lead ${lead.name}: ${(error as Error).message}`);
  }
}

// Helper function to broadcast to all WebSocket clients
function broadcastToClients(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

// Initialize feedback service with WebSocket server
feedbackService.initialize(wss);

// WebSocket handling for real-time updates
wss.on('connection', (ws, req) => {
  logger.info('New WebSocket connection established');
  
  // Store connection metadata
  const connectionId = nanoid();
  (ws as any).connectionId = connectionId;
  (ws as any).sessionId = null;
  (ws as any).leadId = null;
  (ws as any).userId = null;

  ws.on('message', async (message) => {
    const data = JSON.parse(message.toString());
    logger.debug('WebSocket message received', { data });

    // Handle different message types
    switch (data.type) {
      case 'auth':
        // Associate user with WebSocket connection
        if (data.userId) {
          (ws as any).userId = data.userId;
          feedbackService.registerConnection(data.userId, ws);
        }
        break;
        
      case 'mark_notification_read':
        if ((ws as any).userId && data.notificationId) {
          feedbackService.markAsRead((ws as any).userId, data.notificationId);
        }
        break;
        
      case 'mark_all_notifications_read':
        if ((ws as any).userId) {
          feedbackService.markAllAsRead((ws as any).userId);
        }
        break;
        
      case 'delete_notification':
        if ((ws as any).userId && data.notificationId) {
          feedbackService.deleteNotification((ws as any).userId, data.notificationId);
        }
        break;
        
      case 'agent_update':
        // Broadcast agent updates to all clients
        broadcastToClients({
          type: 'agent_update',
          agent: data.agent,
          message: data.message
        });
        break;
      
      case 'lead_update':
        // Handle lead status updates
        broadcastToClients({
          type: 'lead_update',
          leadId: data.leadId,
          status: data.status
        });
        break;
        
      case 'process_lead':
        // Manual trigger to process a lead
        if (data.leadId) {
          const lead = await LeadsRepository.findById(data.leadId);
          if (lead) {
            await processNewLead(lead);
          }
        }
        break;
        
      case 'chat:init':
        // Initialize chat session
        (ws as any).sessionId = data.sessionId;
        (ws as any).leadId = data.leadId || 'anonymous';
        
        // Create or get lead
        let lead = null;
        if (data.leadId && data.leadId !== 'anonymous') {
          lead = await LeadsRepository.findById(data.leadId);
        } else {
          // Create anonymous lead for chat
          lead = await LeadsRepository.create({
            name: data.metadata?.name || 'Chat Visitor',
            email: data.metadata?.email || `chat_${Date.now()}@anonymous.com`,
            phone: data.metadata?.phone || '0000000000',
            source: 'chat_widget',
            metadata: {
              ...data.metadata,
              sessionId: data.sessionId,
              channel: 'chat'
            }
          });
          (ws as any).leadId = lead.id;
        }
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'chat:connected',
          sessionId: data.sessionId,
          leadId: lead.id
        }));
        break;
        
      case 'chat:message':
        // Handle chat messages
        const chatLead = await LeadsRepository.findById((ws as any).leadId);
        if (!chatLead) break;
        
        // Save user message
        await CommunicationsRepository.create(
          chatLead.id,
          'chat',
          'inbound',
          data.content,
          'delivered',
          null,
          { sessionId: data.sessionId }
        );
        
        // Get or create conversation
        let conversation = await ConversationsRepository.findActiveByLeadId(chatLead.id);
        if (!conversation) {
          conversation = await ConversationsRepository.create(chatLead.id, 'chat');
        }
        
        // Update conversation
        await ConversationsRepository.appendMessage(
          conversation.id,
          'user',
          data.content
        );
        
        // Get chat agent to process message
        const chatAgent = getChatAgent();
        
        // Show typing indicator
        ws.send(JSON.stringify({ type: 'chat:typing' }));
        
        // Process message with agent
        const response = await chatAgent.processMessage(
          data.content,
          conversation.messages,
          chatLead
        );
        
        // Save agent response
        await CommunicationsRepository.create(
          chatLead.id,
          'chat',
          'outbound',
          response.content,
          'delivered',
          null,
          { sessionId: data.sessionId, quickReplies: response.quickReplies }
        );
        
        // Update conversation
        await ConversationsRepository.appendMessage(
          conversation.id,
          'assistant',
          response.content
        );
        
        // Send response
        ws.send(JSON.stringify({
          type: 'chat:message',
          id: nanoid(),
          content: response.content,
          sender: 'agent',
          timestamp: new Date(),
          quickReplies: response.quickReplies
        }));
        
        // Stop typing indicator
        ws.send(JSON.stringify({ type: 'chat:stopTyping' }));
        
        // Check if we need to hand over to human
        if (response.shouldHandover) {
          broadcastToClients({
            type: 'chat_handover_requested',
            lead: chatLead,
            conversation: conversation,
            reason: response.handoverReason
          });
        }
        break;
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
    
    // Unregister user connection if authenticated
    if ((ws as any).userId) {
      feedbackService.unregisterConnection((ws as any).userId);
    }
    
    // Notify if this was an active chat
    if ((ws as any).sessionId) {
      broadcastToClients({
        type: 'chat:disconnected',
        sessionId: (ws as any).sessionId,
        leadId: (ws as any).leadId
      });
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ccl3-swarm',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.post('/api/auth/login', passport.authenticate('local'), (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Agent routes
app.get('/api/agents', async (req, res) => {
  // Return available agents
  res.json({
    agents: [
      { id: 'overlord', name: 'Overlord Agent', status: 'active', role: 'orchestrator' },
      { id: 'email', name: 'Email Agent', status: 'active', role: 'email_communication' },
      { id: 'sms', name: 'SMS Agent', status: 'active', role: 'sms_communication' },
      { id: 'chat', name: 'Chat Agent', status: 'active', role: 'website_chat' }
    ]
  });
});

// Lead routes
app.get('/api/leads', async (req, res) => {
  try {
    const { status, source, campaign, channel, limit } = req.query;
    
    const leads = await LeadsRepository.findAll({
      status: status as any,
      source: source as string,
      campaign: campaign as string,
      assignedChannel: channel as any,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({ leads });
  } catch (error) {
    logger.error('Error fetching leads', { error: (error as Error).message, stack: (error as Error).stack });
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Lead creation schema
const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

app.post('/api/leads', 
  validate(createLeadSchema),
  async (req, res) => {
  try {
    const leadData = req.body;
    
    // Save to database
    const lead = await LeadsRepository.create({
      name: leadData.name || 'Unknown',
      email: leadData.email,
      phone: leadData.phone,
      source: leadData.source || 'api',
      campaign: leadData.campaign,
      status: 'new',
      assignedChannel: null,
      qualificationScore: 0,
      metadata: leadData.metadata || {},
      boberdooId: null
    });
    
    // Record the initial creation decision
    await AgentDecisionsRepository.create(
      lead.id,
      'overlord',
      'lead_created',
      'New lead received and saved to database',
      { source: leadData.source }
    );
    
    CCLLogger.leadCreated(lead.id, { leadData: lead });
    
    // Notify clients about new lead
    broadcastToClients({
      type: 'new_lead',
      lead: lead
    });
    
    // Process the lead (background job if available, otherwise immediate)
    const useBackgroundProcessing = process.env.USE_BACKGROUND_JOBS !== 'false';
    processNewLead(lead, useBackgroundProcessing).catch(error => {
      CCLLogger.leadError(lead.id, error as Error, { step: 'async_processing' });
    });
    
    res.json({ success: true, leadId: lead.id, lead });
  } catch (error) {
    logger.error('Error creating lead', { error: (error as Error).message, stack: (error as Error).stack });
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Conversation routes
app.get('/api/conversations/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const conversations = await ConversationsRepository.findByLeadId(leadId);
    res.json({ conversations });
  } catch (error) {
    logger.error('Error fetching conversations', { error: (error as Error).message, stack: (error as Error).stack });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get single lead
app.get('/api/leads/:leadId', async (req, res) => {
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
});

// Update lead status
app.patch('/api/leads/:leadId/status', async (req, res) => {
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
});

// Get lead statistics
app.get('/api/leads/stats/summary', async (req, res) => {
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
});

// Serve static files from client dist directory
app.use(express.static(join(__dirname, '../client/dist')));

// Serve chat widget files from public directory
app.use('/chat-widget-embed.js', express.static(join(__dirname, '../client/public/chat-widget-embed.js')));
app.use('/chat-demo.html', express.static(join(__dirname, '../client/public/chat-demo.html')));

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve the React app
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info('CCL-3 SWARM server started successfully', { port: PORT, agents: ['Overlord', 'Email', 'SMS', 'Chat'] });
  CCLLogger.securityEvent('Server startup completed', 'low', { port: PORT });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    try {
      // Shutdown monitoring systems
      logger.info('Shutting down monitoring systems...');
      await performanceMonitor.shutdown();
      
      // Shutdown other systems
      await queueManager.shutdown();
      await closeConnection();
      await closeRedisConnections();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: (error as Error).message });
      process.exit(1);
    }
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(async () => {
    try {
      await performanceMonitor.shutdown();
      await queueManager.shutdown();
      await closeConnection();
      await closeRedisConnections();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: (error as Error).message });
      process.exit(1);
    }
  });
});