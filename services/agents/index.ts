// Agent Service - handles all AI agent processing
import express from 'express';
import { getOverlordAgent, getEmailAgent, getSMSAgent } from '../../server/agents';
import { LeadsRepository, AgentDecisionsRepository } from '../../server/db';
import { logger } from '../../server/utils/logger';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'agents' });
});

// Process lead endpoint
app.post('/process-lead', async (req, res) => {
  const { leadId } = req.body;
  
  try {
    const lead = await LeadsRepository.findById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Get overlord decision
    const overlord = getOverlordAgent();
    const decision = await overlord.makeDecision({ lead });
    
    // Save decision
    await AgentDecisionsRepository.create(
      leadId,
      'overlord',
      decision.action,
      decision.reasoning || 'No reasoning provided',
      decision.data
    );
    
    // Process based on decision
    if (decision.action === 'assign_channel') {
      // Delegate to appropriate service
      const channel = decision.data.channel;
      
      if (channel === 'email') {
        // Call email service
        await fetch(`${process.env.EMAIL_SERVICE_URL}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, decision })
        });
      } else if (channel === 'sms') {
        // Call SMS service  
        await fetch(`${process.env.SMS_SERVICE_URL}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, decision })
        });
      }
    }
    
    res.json({ success: true, decision });
  } catch (error) {
    logger.error('Agent processing failed', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Generate email content
app.post('/generate-email', async (req, res) => {
  try {
    const { lead, focus } = req.body;
    const emailAgent = getEmailAgent();
    const content = await emailAgent.generateInitialEmail({ lead }, focus);
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: 'Generation failed' });
  }
});

// Generate SMS content  
app.post('/generate-sms', async (req, res) => {
  try {
    const { lead, focus } = req.body;
    const smsAgent = getSMSAgent();
    const content = await smsAgent.generateInitialSMS({ lead }, focus);
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: 'Generation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Service running on port ${PORT}`);
  console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});