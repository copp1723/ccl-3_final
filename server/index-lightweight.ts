// Ultra-lightweight server that delegates to microservices/serverless
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { LeadsRepository } from './db';
import { logger } from './utils/logger';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 5000;

// Minimal middleware
app.use(express.json({ limit: '100kb' }));

// Service URLs
const SERVICES = {
  emailGen: process.env.EMAIL_GEN_URL || 'https://your-app.vercel.app/api/functions/generate-email',
  leadProcess: process.env.LEAD_PROCESS_URL || 'https://your-app.vercel.app/api/functions/process-lead',
  agentService: process.env.AGENT_SERVICE_URL || 'http://localhost:3002',
};

// Health check
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({ 
    status: 'ok',
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
    }
  });
});

// Create lead - delegates processing to serverless
app.post('/api/leads', async (req, res) => {
  try {
    // Save to database
    const lead = await LeadsRepository.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      source: req.body.source || 'api',
      status: 'new',
      metadata: req.body.metadata || {}
    });
    
    // Async call to serverless function
    fetch(SERVICES.leadProcess, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead })
    }).then(async (response) => {
      const { decision } = await response.json();
      
      // Handle decision
      if (decision.action === 'assign_channel' && decision.channel === 'email') {
        // Generate email via serverless
        const emailRes = await fetch(SERVICES.emailGen, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead, focus: 'initial_contact' })
        });
        
        const { content } = await emailRes.json();
        logger.info(`Generated email for lead ${lead.id}`);
      }
    }).catch(err => {
      logger.error('Serverless processing failed', err);
    });
    
    res.json({ success: true, leadId: lead.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Simple WebSocket relay
wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const data = JSON.parse(message.toString());
    
    if (data.type === 'chat:message') {
      // Relay to agent service
      try {
        const response = await fetch(`${SERVICES.agentService}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        ws.send(JSON.stringify(result));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: 'Service unavailable' }));
      }
    }
  });
});

// Static files (better to use CDN)
app.use(express.static('dist/client'));

server.listen(PORT, () => {
  console.log(`Lightweight server running on port ${PORT}`);
  console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  // Log memory every 30 seconds
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`Memory - Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
  }, 30000);
});