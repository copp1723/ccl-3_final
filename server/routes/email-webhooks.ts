// server/routes/email-webhooks.ts
// Handles incoming email replies via webhooks

import { Router } from 'express';
import { z } from 'zod';
import { emailConversationManager } from '../services/email-conversation-manager';
import { LeadsRepository } from '../db';

const router = Router();

// Mailgun webhook schema
const mailgunWebhookSchema = z.object({
  recipient: z.string().email(),
  sender: z.string().email(),
  subject: z.string(),
  'body-plain': z.string(),
  'stripped-text': z.string().optional(),
  'message-headers': z.string().optional(),
  timestamp: z.string(),
  token: z.string(),
  signature: z.string()
});

// Verify Mailgun webhook signature
function verifyMailgunWebhook(timestamp: string, token: string, signature: string): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.MAILGUN_WEBHOOK_KEY || '')
    .update(timestamp + token)
    .digest('hex');
  
  return expectedSignature === signature;
}

// Handle incoming email replies
router.post('/api/webhooks/email/inbound', async (req, res) => {
  try {
    // Parse webhook data
    const data = mailgunWebhookSchema.parse(req.body);
    
    // Verify webhook signature
    if (!verifyMailgunWebhook(data.timestamp, data.token, data.signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    // Extract email content
    const fromEmail = data.sender;
    const messageBody = data['stripped-text'] || data['body-plain'];
    
    // Find lead by email
    const leads = await LeadsRepository.findAll({ limit: 1000 }); // TODO: Add findByEmail method
    const lead = leads.find(l => l.email === fromEmail);
    
    if (!lead) {
      console.warn('Received email from unknown sender:', fromEmail);
      return res.status(200).json({ status: 'ignored', reason: 'unknown_sender' });
    }
    
    // Process the reply
    await emailConversationManager.processIncomingReply(lead.id, messageBody);
    
    res.status(200).json({ status: 'processed', leadId: lead.id });
  } catch (error) {
    console.error('Email webhook error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid webhook data', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to process email webhook' });
  }
});

// Alternative: Handle SendGrid webhooks
router.post('/api/webhooks/email/sendgrid', async (req, res) => {
  try {
    // SendGrid sends an array of events
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const event of events) {
      if (event.event === 'inbound') {
        const fromEmail = event.from;
        const messageBody = event.text || event.html;
        
        // Find lead by email
        const leads = await LeadsRepository.findAll({ limit: 1000 });
        const lead = leads.find(l => l.email === fromEmail);
        
        if (lead) {
          await emailConversationManager.processIncomingReply(lead.id, messageBody);
        }
      }
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Manual reply submission (for testing or manual input)
router.post('/api/email/reply/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const lead = await LeadsRepository.findById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    await emailConversationManager.processIncomingReply(leadId, message);
    
    res.json({ 
      status: 'processed',
      conversationState: emailConversationManager.getConversationState(leadId)
    });
  } catch (error) {
    console.error('Manual reply error:', error);
    res.status(500).json({ error: 'Failed to process reply' });
  }
});

// Get conversation state
router.get('/api/email/conversation/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const state = emailConversationManager.getConversationState(leadId);
    
    if (!state) {
      return res.status(404).json({ error: 'No conversation found for this lead' });
    }
    
    res.json({ state });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation state' });
  }
});

export default router;
