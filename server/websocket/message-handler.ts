import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
import { LeadsRepository, ConversationsRepository, CommunicationsRepository } from '../db';
import { getChatAgent } from '../agents';
import { feedbackService } from '../services/feedback-service';
import { LeadProcessor } from '../services/lead-processor';
import { logger, CCLLogger } from '../utils/logger.js';

interface ExtendedWebSocket {
  connectionId: string;
  sessionId: string | null;
  leadId: string | null;
  userId: string | null;
}

export class WebSocketMessageHandler {
  private wss: WebSocketServer;
  private leadProcessor: LeadProcessor;
  private broadcastCallback: (data: any) => void;

  constructor(wss: WebSocketServer, leadProcessor: LeadProcessor, broadcastCallback: (data: any) => void) {
    this.wss = wss;
    this.leadProcessor = leadProcessor;
    this.broadcastCallback = broadcastCallback;
  }

  setupConnection(ws: any, req: any) {
    logger.info('New WebSocket connection established');
    
    // Store connection metadata
    const connectionId = nanoid();
    (ws as ExtendedWebSocket).connectionId = connectionId;
    (ws as ExtendedWebSocket).sessionId = null;
    (ws as ExtendedWebSocket).leadId = null;
    (ws as ExtendedWebSocket).userId = null;

    ws.on('message', async (message: Buffer) => {
      const data = JSON.parse(message.toString());
      logger.debug('WebSocket message received', { data });

      // Handle different message types
      switch (data.type) {
        case 'auth':
          await this.handleAuth(ws, data);
          break;
          
        case 'mark_notification_read':
          await this.handleMarkNotificationRead(ws, data);
          break;
          
        case 'mark_all_notifications_read':
          await this.handleMarkAllNotificationsRead(ws);
          break;
          
        case 'delete_notification':
          await this.handleDeleteNotification(ws, data);
          break;
          
        case 'agent_update':
          await this.handleAgentUpdate(data);
          break;
        
        case 'lead_update':
          await this.handleLeadUpdate(data);
          break;
          
        case 'process_lead':
          await this.handleProcessLead(data);
          break;
          
        case 'chat:init':
          await this.handleChatInit(ws, data);
          break;
          
        case 'chat:message':
          await this.handleChatMessage(ws, data);
          break;
      }
    });

    ws.on('close', () => {
      this.handleConnectionClose(ws);
    });
  }

  private async handleAuth(ws: any, data: any) {
    // Associate user with WebSocket connection
    if (data.userId) {
      (ws as ExtendedWebSocket).userId = data.userId;
      feedbackService.registerConnection(data.userId, ws);
    }
  }

  private async handleMarkNotificationRead(ws: any, data: any) {
    if ((ws as ExtendedWebSocket).userId && data.notificationId) {
      feedbackService.markAsRead((ws as ExtendedWebSocket).userId!, data.notificationId);
    }
  }

  private async handleMarkAllNotificationsRead(ws: any) {
    if ((ws as ExtendedWebSocket).userId) {
      feedbackService.markAllAsRead((ws as ExtendedWebSocket).userId!);
    }
  }

  private async handleDeleteNotification(ws: any, data: any) {
    if ((ws as ExtendedWebSocket).userId && data.notificationId) {
      feedbackService.deleteNotification((ws as ExtendedWebSocket).userId!, data.notificationId);
    }
  }

  private async handleAgentUpdate(data: any) {
    // Broadcast agent updates to all clients
    this.broadcastCallback({
      type: 'agent_update',
      agent: data.agent,
      message: data.message
    });
  }

  private async handleLeadUpdate(data: any) {
    // Handle lead status updates
    this.broadcastCallback({
      type: 'lead_update',
      leadId: data.leadId,
      status: data.status
    });
  }

  private async handleProcessLead(data: any) {
    // Manual trigger to process a lead
    if (data.leadId) {
      const lead = await LeadsRepository.findById(data.leadId);
      if (lead) {
        await this.leadProcessor.processNewLead(lead);
      }
    }
  }

  private async handleChatInit(ws: any, data: any) {
    // Initialize chat session
    (ws as ExtendedWebSocket).sessionId = data.sessionId;
    (ws as ExtendedWebSocket).leadId = data.leadId || 'anonymous';
    
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
      (ws as ExtendedWebSocket).leadId = lead.id;
    }
    
    // Create conversation
    const conversation = await ConversationsRepository.create(
      lead.id,
      'chat',
      'chat'
    );
    
    // Send welcome message
    const chatAgent = getChatAgent();
    const welcomeMessage = await chatAgent.generateInitialMessage(
      { lead, campaign: null },
      'Initial chat contact'
    );
    
    ws.send(JSON.stringify({
      type: 'chat:connected',
      leadId: lead.id,
      conversationId: conversation.id,
      welcomeMessage: welcomeMessage
    }));
  }

  private async handleChatMessage(ws: any, data: any) {
    // Show typing indicator
    ws.send(JSON.stringify({ type: 'chat:typing' }));
    
    // Find lead and conversation
    const leadId = (ws as ExtendedWebSocket).leadId;
    if (!leadId) {
      ws.send(JSON.stringify({ type: 'error', message: 'No active session' }));
      return;
    }
    
    const chatLead = await LeadsRepository.findById(leadId);
    const conversation = await ConversationsRepository.findByLeadIdAndChannel(leadId, 'chat');
    
    if (!chatLead || !conversation) {
      ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
      return;
    }
    
    // Store incoming message
    await CommunicationsRepository.create(
      leadId,
      'chat',
      'inbound',
      data.content,
      'received',
      null,
      { sessionId: data.sessionId }
    );
    
    // Update conversation
    await ConversationsRepository.appendMessage(
      conversation.id,
      'user',
      data.content
    );
    
    // Get chat agent response
    const chatAgent = getChatAgent();
    const response = await chatAgent.generateResponse({
      lead: chatLead,
      message: data.content,
      conversation: conversation,
      session: { id: data.sessionId }
    });
    
    // Store outgoing message
    await CommunicationsRepository.create(
      leadId,
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
      this.broadcastCallback({
        type: 'chat_handover_requested',
        lead: chatLead,
        conversation: conversation,
        reason: response.handoverReason
      });
    }
  }

  private handleConnectionClose(ws: any) {
    logger.info('WebSocket connection closed');
    
    // Unregister user connection if authenticated
    if ((ws as ExtendedWebSocket).userId) {
      feedbackService.unregisterConnection((ws as ExtendedWebSocket).userId!);
    }
    
    // Notify if this was an active chat
    if ((ws as ExtendedWebSocket).sessionId) {
      this.broadcastCallback({
        type: 'chat:disconnected',
        sessionId: (ws as ExtendedWebSocket).sessionId,
        leadId: (ws as ExtendedWebSocket).leadId
      });
    }
  }
}