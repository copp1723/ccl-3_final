import { Router } from 'express';
import { CommunicationsRepository, ConversationsRepository, LeadsRepository } from '../db';
import { getEmailAgent, getSMSAgent } from '../agents';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { validate, validateQuery, commonSchemas } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { auditView } from '../middleware/audit';

const router = Router();

// Validation schemas
const communicationsQuerySchema = z.object({
  leadId: z.string().optional(),
  channel: z.enum(['email', 'sms', 'chat']).optional(),
  status: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional()
});

const createCommunicationSchema = z.object({
  leadId: z.string().min(1),
  channel: z.enum(['email', 'sms', 'chat']),
  direction: z.enum(['inbound', 'outbound']),
  content: z.string().min(1),
  status: z.string().optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Get all communications
router.get('/',
  validateQuery(communicationsQuerySchema),
  async (req, res) => {
  try {
    const { leadId, channel, status, limit } = req.query;
    
    // If leadId is provided, use existing method
    if (leadId) {
      const communications = await CommunicationsRepository.findByLeadId(leadId as string);
      return res.json({ communications });
    }
    
    // Otherwise get recent communications with filters
    const recentLimit = limit ? parseInt(limit as string) : 100;
    const communications = await CommunicationsRepository.getRecent(recentLimit);
    
    // Apply filters if provided
    let filtered = communications;
    if (channel) {
      filtered = filtered.filter(c => c.channel === channel);
    }
    if (status) {
      filtered = filtered.filter(c => c.status === status);
    }
    
    res.json({ communications: filtered });
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ error: 'Failed to fetch communications' });
  }
});

// Get all communications for a lead
router.get('/lead/:leadId', async (req, res) => {
  try {
    const communications = await CommunicationsRepository.findByLeadId(req.params.leadId);
    res.json({ communications });
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ error: 'Failed to fetch communications' });
  }
});

// Get pending communications
router.get('/pending', async (req, res) => {
  try {
    const communications = await CommunicationsRepository.getPendingCommunications();
    res.json({ communications });
  } catch (error) {
    console.error('Error fetching pending communications:', error);
    res.status(500).json({ error: 'Failed to fetch pending communications' });
  }
});

// Get communication stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await CommunicationsRepository.getStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching communication stats:', error);
    res.status(500).json({ error: 'Failed to fetch communication stats' });
  }
});

// Mailgun webhook endpoint for email replies
router.post('/webhooks/mailgun', async (req, res) => {
  try {
    const { from, subject, 'stripped-text': body, 'message-headers': headers } = req.body;
    
    console.log(`Received Mailgun webhook from: ${from}`);
    
    // Find the lead by email
    const leads = await LeadsRepository.findAll({ limit: 1000 });
    const lead = leads.find(l => l.email === from);
    
    if (lead) {
      // Save the incoming email as a conversation
      const incomingConv = await ConversationsRepository.create(
        lead.id,
        'email',
        'email'
      );
      
      await ConversationsRepository.addMessage(incomingConv.id, {
        role: 'lead',
        content: body || '',
        timestamp: new Date().toISOString()
      });
      
      // Get email agent to process the response
      const emailAgent = getEmailAgent();
      const response = await emailAgent.processMessage(body || '', { lead });
      
      // Save agent's response
      await ConversationsRepository.addMessage(incomingConv.id, {
        role: 'agent',
        content: response,
        timestamp: new Date().toISOString()
      });
      
      // Send the response email
      await emailAgent.sendEmail(
        lead.email,
        `Re: ${subject}`,
        response
      );
      
      // Update qualification score
      const newScore = Math.min(lead.qualificationScore + 15, 100);
      await LeadsRepository.updateQualificationScore(lead.id, newScore);
      
      console.log(`📧 Email conversation continued with ${lead.name}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing Mailgun webhook:', error);
    res.status(200).json({ received: true, error: true });
  }
});

// Twilio webhook endpoint for SMS replies
router.post('/webhooks/twilio', async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;
    
    console.log(`Received Twilio webhook from: ${From}`);
    
    // Find the lead by phone
    const leads = await LeadsRepository.findAll({ limit: 1000 });
    const lead = leads.find(l => l.phone === From);
    
    if (lead) {
      // Save the incoming SMS
      const smsConv = await ConversationsRepository.create(
        lead.id,
        'sms',
        'sms'
      );
      
      await ConversationsRepository.addMessage(smsConv.id, {
        role: 'lead',
        content: Body || '',
        timestamp: new Date().toISOString()
      });
      
      // Get SMS agent to process the response
      const smsAgent = getSMSAgent();
      const response = await smsAgent.processMessage(Body || '', { lead });
      
      // Save agent's response
      await ConversationsRepository.addMessage(smsConv.id, {
        role: 'agent',
        content: response,
        timestamp: new Date().toISOString()
      });
      
      // Send the response SMS
      const smsResult = await smsAgent.sendSMS(lead.phone, response);
      
      // Record the communication
      await CommunicationsRepository.create(
        lead.id,
        'sms',
        'outbound',
        response,
        'sent',
        smsResult.sid,
        { conversationId: smsConv.id }
      );
      
      // Update qualification score
      const newScore = Math.min(lead.qualificationScore + 15, 100);
      await LeadsRepository.updateQualificationScore(lead.id, newScore);
      
      console.log(`📱 SMS conversation continued with ${lead.name}`);
    }
    
    // Twilio expects TwiML response
    res.type('text/xml');
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('Error processing Twilio webhook:', error);
    res.type('text/xml');
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

// Update communication status (webhook endpoint)
router.post('/webhook/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const webhookData = req.body;
    
    console.log(`Received ${provider} webhook:`, webhookData);
    
    // Handle different webhook providers
    if (provider === 'mailgun') {
      const { id, event, recipient, 'event-data': eventData } = webhookData;
      
      if (eventData?.message?.headers?.['message-id']) {
        const communication = await CommunicationsRepository.findByExternalId(
          eventData.message.headers['message-id']
        );
        
        if (communication) {
          await CommunicationsRepository.updateStatus(
            communication.id,
            event,
            { webhookData }
          );
        }
      }
    } else if (provider === 'twilio') {
      const { MessageSid, MessageStatus, To, From } = webhookData;
      
      if (MessageSid) {
        const communication = await CommunicationsRepository.findByExternalId(MessageSid);
        
        if (communication) {
          await CommunicationsRepository.updateStatus(
            communication.id,
            MessageStatus,
            { webhookData }
          );
        }
      }
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Still return 200 to prevent webhook retries
    res.status(200).json({ received: true, error: true });
  }
});

// Create a new communication record
router.post('/',
  validate(createCommunicationSchema),
  async (req, res) => {
  try {
    const { leadId, channel, direction, content, status, externalId, metadata } = req.body;
    
    const communication = await CommunicationsRepository.create(
      leadId,
      channel,
      direction,
      content,
      status,
      externalId,
      metadata
    );
    
    res.json({ success: true, communication });
  } catch (error) {
    console.error('Error creating communication:', error);
    res.status(500).json({ error: 'Failed to create communication' });
  }
});

// Get recent communications
router.get('/recent', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const communications = await CommunicationsRepository.getRecent(limit);
    res.json({ communications });
  } catch (error) {
    console.error('Error fetching recent communications:', error);
    res.status(500).json({ error: 'Failed to fetch recent communications' });
  }
});

export default router;
