import { Router } from 'express';
import { 
  LeadsRepository, 
  ConversationsRepository, 
  CommunicationsRepository,
  AgentDecisionsRepository,
  AnalyticsRepository
} from '../db';
import { authenticate } from '../middleware/auth';
import { auditView, auditUpdate } from '../middleware/audit';
import { z } from 'zod';
import { validate } from '../middleware/validation';

const router = Router();

// Update lead schema
const updateLeadSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  qualificationScore: z.number().min(0).max(100).optional(),
  metadata: z.record(z.any()).optional()
});

// Get comprehensive lead details
router.get('/api/leads/:id/details',
  authenticate,
  auditView('lead_details'),
  async (req, res) => {
    try {
      const leadId = req.params.id;
      
      // Get lead with all related data
      const leadData = await LeadsRepository.findWithRelatedData(leadId);
      
      if (!leadData) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Get additional analytics
      const [conversations, communications, decisions] = await Promise.all([
        ConversationsRepository.findByLeadId(leadId),
        CommunicationsRepository.findByLeadId(leadId),
        AgentDecisionsRepository.findByLeadId(leadId)
      ]);
      
      // Calculate engagement metrics
      const engagementMetrics = {
        totalInteractions: communications.length,
        emailsSent: communications.filter(c => c.channel === 'email' && c.direction === 'outbound').length,
        emailsReceived: communications.filter(c => c.channel === 'email' && c.direction === 'inbound').length,
        smsSent: communications.filter(c => c.channel === 'sms' && c.direction === 'outbound').length,
        smsReceived: communications.filter(c => c.channel === 'sms' && c.direction === 'inbound').length,
        chatMessages: conversations.filter(c => c.channel === 'chat').reduce((sum, c) => sum + c.messages.length, 0),
        lastContactDate: communications.length > 0 
          ? communications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
          : null
      };
      
      // Track view event
      await AnalyticsRepository.trackEvent({
        eventType: 'lead_viewed',
        leadId,
        userId: req.user!.id
      });
      
      res.json({
        lead: leadData.lead,
        conversations,
        communications,
        decisions,
        engagementMetrics
      });
    } catch (error) {
      console.error('Error fetching lead details:', error);
      res.status(500).json({ error: 'Failed to fetch lead details' });
    }
  }
);

// Get lead conversation history
router.get('/api/leads/:id/conversations',
  authenticate,
  auditView('lead_conversations'),
  async (req, res) => {
    try {
      const conversations = await ConversationsRepository.findByLeadId(req.params.id);
      
      // Enrich with communication details
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const communications = await CommunicationsRepository.findByConversationId(conv.id);
          return {
            ...conv,
            communications,
            messageCount: conv.messages.length,
            duration: conv.endedAt 
              ? Math.round((conv.endedAt.getTime() - conv.startedAt.getTime()) / 1000 / 60) 
              : null
          };
        })
      );
      
      res.json({ conversations: enrichedConversations });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }
);

// Get single conversation details
router.get('/api/conversations/:id',
  authenticate,
  auditView('conversation'),
  async (req, res) => {
    try {
      const conversation = await ConversationsRepository.findById(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Get related data
      const [lead, communications] = await Promise.all([
        LeadsRepository.findById(conversation.leadId),
        CommunicationsRepository.findByConversationId(conversation.id)
      ]);
      
      res.json({
        conversation,
        lead,
        communications
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  }
);

// Add note to conversation
router.post('/api/conversations/:id/notes',
  authenticate,
  async (req, res) => {
    try {
      const { note } = req.body;
      
      if (!note) {
        return res.status(400).json({ error: 'Note is required' });
      }
      
      const conversation = await ConversationsRepository.findById(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Add note as a system message
      const updated = await ConversationsRepository.addMessage(
        conversation.id,
        {
          role: 'agent',
          content: `[Note by ${req.user!.email}]: ${note}`,
          timestamp: new Date().toISOString()
        }
      );
      
      res.json({ success: true, conversation: updated });
    } catch (error) {
      console.error('Error adding note:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  }
);

// Update lead information
router.patch('/api/leads/:id',
  authenticate,
  validate(updateLeadSchema),
  auditUpdate('lead'),
  async (req, res) => {
    try {
      const lead = await LeadsRepository.findById(req.params.id);
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Update lead
      const updated = await LeadsRepository.update(req.params.id, req.body);
      
      // Track update event
      await AnalyticsRepository.trackEvent({
        eventType: 'lead_updated',
        leadId: req.params.id,
        userId: req.user!.id,
        metadata: { changes: req.body }
      });
      
      res.json({ success: true, lead: updated });
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  }
);

// Get lead timeline
router.get('/api/leads/:id/timeline',
  authenticate,
  async (req, res) => {
    try {
      const leadId = req.params.id;
      
      // Get all events
      const [
        communications,
        conversations,
        decisions,
        analyticsEvents
      ] = await Promise.all([
        CommunicationsRepository.findByLeadId(leadId),
        ConversationsRepository.findByLeadId(leadId),
        AgentDecisionsRepository.findByLeadId(leadId),
        AnalyticsRepository.getEventMetrics('lead_updated', { 
          startDate: new Date(0) 
        })
      ]);
      
      // Combine into timeline
      const timeline = [
        ...communications.map(c => ({
          type: 'communication',
          timestamp: c.createdAt,
          channel: c.channel,
          direction: c.direction,
          status: c.status,
          content: c.content.substring(0, 100) + '...'
        })),
        ...conversations.map(c => ({
          type: 'conversation',
          timestamp: c.startedAt,
          channel: c.channel,
          status: c.status,
          messageCount: c.messages.length
        })),
        ...decisions.map(d => ({
          type: 'decision',
          timestamp: d.createdAt,
          agent: d.agentType,
          decision: d.decision,
          reasoning: d.reasoning
        }))
      ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      res.json({ timeline });
    } catch (error) {
      console.error('Error fetching timeline:', error);
      res.status(500).json({ error: 'Failed to fetch timeline' });
    }
  }
);

// Send manual message to lead
router.post('/api/leads/:id/send-message',
  authenticate,
  async (req, res) => {
    try {
      const { channel, content, subject } = req.body;
      
      if (!channel || !content) {
        return res.status(400).json({ error: 'Channel and content are required' });
      }
      
      const lead = await LeadsRepository.findById(req.params.id);
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Create or get conversation
      let conversation = await ConversationsRepository.findActiveByLeadAndChannel(
        lead.id,
        channel
      );
      
      if (!conversation) {
        conversation = await ConversationsRepository.create(
          lead.id,
          channel,
          'manual' as any
        );
      }
      
      // Add message to conversation
      await ConversationsRepository.addMessage(conversation.id, {
        role: 'agent',
        content,
        timestamp: new Date().toISOString()
      });
      
      // Send the actual message
      let result = { success: false, error: 'Channel not configured' };
      
      if (channel === 'email' && lead.email) {
        const { getEmailAgent } = await import('../agents');
        const emailAgent = getEmailAgent();
        result = await emailAgent.sendEmail(lead.email, subject || 'Message from CCL', content);
      } else if (channel === 'sms' && lead.phone) {
        const { getSMSAgent } = await import('../agents');
        const smsAgent = getSMSAgent();
        result = await smsAgent.sendSMS(lead.phone, content);
      }
      
      // Record communication
      await CommunicationsRepository.create(
        lead.id,
        channel,
        'outbound',
        content,
        result.success ? 'sent' : 'failed',
        result.id || result.sid,
        { 
          conversationId: conversation.id,
          sentBy: req.user!.email,
          manual: true
        }
      );
      
      res.json({ 
        success: result.success,
        message: result.success ? 'Message sent successfully' : result.error
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

export default router;