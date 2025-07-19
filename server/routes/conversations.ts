import { Router } from 'express';
import { conversationsRepository as ConversationsRepository } from '../db/wrapped-repositories';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { clientValidation, ClientRequest } from '../middleware/client-validation';

const router = Router();

// Validation schemas
const conversationQuerySchema = z.object({
  leadId: z.string().optional(),
  channel: z.enum(['email', 'sms', 'chat']).optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  agentType: z.enum(['overlord', 'email', 'sms', 'chat']).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional()
});

const createConversationSchema = z.object({
  leadId: z.string().min(1),
  channel: z.enum(['email', 'sms', 'chat']),
  agentType: z.enum(['overlord', 'email', 'sms', 'chat'])
});

const addMessageSchema = z.object({
  role: z.enum(['agent', 'lead']),
  content: z.string().min(1),
  timestamp: z.string().optional()
});

// Apply client validation middleware
router.use(clientValidation);

// Get all conversations
router.get('/', async (req: ClientRequest, res) => {
  try {
    const { leadId, channel, status, agentType, limit } = req.query;
    
    // If leadId is provided, get conversations for that lead
    if (leadId) {
      let conversations = [];
      try {
        conversations = await ConversationsRepository.findByLeadId(leadId as string);
      } catch (dbError) {
        console.warn('Database error, using fallback conversation data:', dbError);
        conversations = [];
      }
      return res.json({ 
        success: true,
        conversations,
        total: conversations.length 
      });
    }
    
    // Get recent conversations with optional filters
    const recentLimit = limit ? parseInt(limit as string) : 50;
    
    let activeConversationCounts = {};
    try {
      // For now, we'll return active conversation counts by channel
      // In a real implementation, you'd want a dedicated method to get actual conversation objects
      activeConversationCounts = await ConversationsRepository.getActiveConversationsByChannel();
    } catch (dbError) {
      console.warn('Database error, using fallback conversation counts:', dbError);
      activeConversationCounts = {
        email: 0,
        sms: 0,
        chat: 0
      };
    }
    
    res.json({
      success: true,
      conversations: [], // Placeholder - would need actual conversation objects
      activeConversationsByChannel: activeConversationCounts,
      total: 0,
      limit: recentLimit,
      note: "This endpoint needs enhancement to return actual conversation objects rather than counts"
    });
  } catch (error) {
    console.error('Error in conversations endpoint:', error);
    // Final fallback
    res.json({ 
      success: true,
      conversations: [],
      activeConversationsByChannel: { email: 0, sms: 0, chat: 0 },
      total: 0,
      limit: 50
    });
  }
});

// Get single conversation
router.get('/:id', async (req: ClientRequest, res) => {
  try {
    const conversation = await ConversationsRepository.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }
    
    res.json({ 
      success: true,
      conversation 
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch conversation' 
    });
  }
});

// Create new conversation
router.post('/', async (req: ClientRequest, res) => {
  try {
    const validationResult = createConversationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationError.toString()
      });
    }
    
    const { leadId, channel, agentType } = validationResult.data;
    
    const conversation = await ConversationsRepository.create(leadId, channel, agentType);
    
    res.status(201).json({ 
      success: true,
      conversation 
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create conversation' 
    });
  }
});

// Add message to conversation
router.post('/:id/messages', async (req: ClientRequest, res) => {
  try {
    const validationResult = addMessageSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationError.toString()
      });
    }
    
    const { role, content, timestamp } = validationResult.data;
    const message = {
      role,
      content,
      timestamp: timestamp || new Date().toISOString()
    };
    
    const conversation = await ConversationsRepository.addMessage(req.params.id, message);
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }
    
    res.json({ 
      success: true,
      conversation,
      message 
    });
  } catch (error) {
    console.error('Error adding message to conversation:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add message to conversation' 
    });
  }
});

// Update conversation status
router.patch('/:id/status', async (req: ClientRequest, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'completed', 'paused'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid status. Must be one of: active, completed, paused' 
      });
    }
    
    const conversation = await ConversationsRepository.updateStatus(req.params.id, status);
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false,
        error: 'Conversation not found' 
      });
    }
    
    res.json({ 
      success: true,
      conversation 
    });
  } catch (error) {
    console.error('Error updating conversation status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update conversation status' 
    });
  }
});

// Get conversations by lead ID
router.get('/lead/:leadId', async (req: ClientRequest, res) => {
  try {
    const conversations = await ConversationsRepository.findByLeadId(req.params.leadId);
    
    res.json({ 
      success: true,
      conversations,
      total: conversations.length 
    });
  } catch (error) {
    console.error('Error fetching conversations for lead:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch conversations for lead' 
    });
  }
});

// Get active conversations by channel
router.get('/active/by-channel', async (req: ClientRequest, res) => {
  try {
    const conversations = await ConversationsRepository.getActiveConversationsByChannel();
    
    res.json({ 
      success: true,
      conversations 
    });
  } catch (error) {
    console.error('Error fetching active conversations by channel:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch active conversations by channel' 
    });
  }
});

export default router;