import { Router } from "express";
import { ConversationsRepository } from "../db/conversations-repository";
import { CommunicationsRepository } from "../db/communications-repository";
import { LeadsRepository } from "../db/leads-repository";
import { EmailTemplatesRepository } from "../db/email-templates-repository";
import { AgentConfigurationsRepository } from "../db/agent-configurations-repository";
import { CampaignsRepository } from "../db/campaigns-repository";
import { HandoverService } from "../services/handover-service";
import { nanoid } from "nanoid";

const router = Router();

// Email conversation endpoints
router.get("/conversations", async (req, res) => {
  try {
    const { leadId } = req.query;
    
    // Get conversations from database
    let conversations: any[] = [];
    if (leadId) {
      conversations = await ConversationsRepository.findByLeadId(leadId as string);
    } else {
      // Get active conversations by channel as fallback
      const activeConversations = await ConversationsRepository.getActiveConversationsByChannel();
      conversations = []; // For now, return empty array when no leadId is provided
    }

    // Transform to match frontend expected format
    const transformedConversations = conversations.map((conversation: any) => ({
      id: conversation.id,
      leadId: conversation.leadId,
      channel: conversation.channel,
      agentType: conversation.agentType,
      messages: conversation.messages,
      status: conversation.status,
      startedAt: conversation.startedAt.toISOString(),
      endedAt: conversation.endedAt?.toISOString() || null
    }));

    res.json({
      success: true,
      data: transformedConversations,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "CONVERSATION_FETCH_ERROR",
        message: error.message || "Failed to fetch conversations",
        category: "database"
      }
    });
  }
});

// Start new email conversation
router.post("/conversations", async (req, res) => {
  try {
    const { leadId, templateId, variables } = req.body;
    
    // Get lead details
    const lead = await LeadsRepository.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: {
          code: "LEAD_NOT_FOUND",
          message: "Lead not found",
          category: "not_found"
        }
      });
    }

    // Get template
    const template = await EmailTemplatesRepository.findById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: "TEMPLATE_NOT_FOUND",
          message: "Template not found",
          category: "not_found"
        }
      });
    }

    // Get active email agent
    const agent = await AgentConfigurationsRepository.getActiveByType('email');
    if (!agent) {
      return res.status(500).json({
        success: false,
        error: {
          code: "NO_ACTIVE_AGENT",
          message: "No active email agent found",
          category: "configuration"
        }
      });
    }

    // Replace variables in template
    const emailSubject = EmailTemplatesRepository.replaceVariables(template.subject as unknown as string, variables || {});
    const emailContent = EmailTemplatesRepository.replaceVariables(template.content as unknown as string, variables || {});

    // Create conversation
    const conversation = await ConversationsRepository.create(
      leadId,
      'email',
      'email'
    );

    // Add initial message to conversation
    const initialMessage = `Subject: ${emailSubject}\n\n${emailContent}`;
    await ConversationsRepository.addMessage(conversation.id as unknown as string, {
      role: 'agent',
      content: initialMessage,
      timestamp: new Date().toISOString()
    });

    // Create communication record
    await CommunicationsRepository.create(
      leadId,
      'email',
      'outbound',
      emailContent,
      'sent',
      undefined,
      {
        subject: emailSubject,
        templateId,
        variables,
        conversationId: conversation.id
      }
    );

    // Update template performance
    await EmailTemplatesRepository.updatePerformance(templateId, 'sent');

    res.json({
      success: true,
      data: {
        id: conversation.id,
        leadId: conversation.leadId,
        channel: conversation.channel,
        agentType: conversation.agentType,
        messages: conversation.messages,
        status: conversation.status,
        startedAt: (conversation.startedAt as unknown as Date).toISOString(),
        endedAt: null,
        emailSent: {
          subject: emailSubject,
          content: emailContent,
          templateId,
          variables
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error starting conversation:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "CONVERSATION_START_ERROR",
        message: error.message || "Failed to start conversation",
        category: "processing"
      }
    });
  }
});

// Add message to conversation (inbound/outbound)
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, content, templateId, variables } = req.body;
    
    const conversation = await ConversationsRepository.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found",
          category: "not_found"
        }
      });
    }

    let messageContent = content;
    let emailSubject = '';
    
    // If using template, replace variables
    if (templateId && role === 'agent') {
      const template = await EmailTemplatesRepository.findById(templateId);
      if (template) {
        emailSubject = EmailTemplatesRepository.replaceVariables(template.subject as unknown as string, variables || {});
        messageContent = EmailTemplatesRepository.replaceVariables(template.content as unknown as string, variables || {});
        
        // Update template performance
        await EmailTemplatesRepository.updatePerformance(templateId, 'sent');
      }
    }

    // Add message to conversation
    const updatedConversation = await ConversationsRepository.addMessage(id, {
      role: role as 'agent' | 'lead',
      content: templateId ? `Subject: ${emailSubject}\n\n${messageContent}` : messageContent,
      timestamp: new Date().toISOString()
    });

    // Create communication record
    await CommunicationsRepository.create(
      conversation.leadId as unknown as string,
      'email',
      role === 'agent' ? 'outbound' : 'inbound',
      messageContent,
      'sent',
      undefined,
      {
        subject: emailSubject,
        templateId,
        variables,
        conversationId: id
      }
    );

    if (!updatedConversation) {
      return res.status(500).json({
        success: false,
        error: {
          code: "MESSAGE_ADD_ERROR",
          message: "Failed to add message to conversation",
          category: "processing"
        }
      });
    }

    // Evaluate handover conditions after adding message
    try {
      // Get the lead to find their campaign
      const lead = await LeadsRepository.findById(updatedConversation.leadId as unknown as string);
      if (lead && lead.campaign) {
        // Get campaign to access handover criteria (using campaign name as id for now)
        const campaigns = await CampaignsRepository.findAll();
        const campaign = campaigns.find(c => c.name === lead.campaign);
        
        if (campaign && campaign.handoverCriteria) {
          // Get the latest message that was just added
          const latestMessage = updatedConversation.messages[updatedConversation.messages.length - 1];
          
          // Analyze conversation and update qualification score/goal progress
          const analysis = await HandoverService.analyzeConversation(updatedConversation, latestMessage);
          
          // Update conversation with analysis results
          await ConversationsRepository.updateWithHandoverAnalysis(id, {
            qualificationScore: analysis.qualificationScore,
            goalProgress: analysis.goalProgress
          });

          // Update cross-channel context
          const crossChannelContext = await HandoverService.getCrossChannelContext(updatedConversation.leadId as unknown as string);
          await ConversationsRepository.updateCrossChannelContext(id, crossChannelContext);

          // Evaluate if handover should be triggered
          const handoverResult = await HandoverService.evaluateHandover(id, latestMessage);
          
          // If handover should be triggered, execute it automatically
          if (handoverResult.shouldHandover) {
            await HandoverService.executeHandover(id, handoverResult.reason);
            
            // Update conversation status
            await ConversationsRepository.updateStatus(id, 'handed_over');
          }
        }
      }
    } catch (handoverError) {
      // Log handover evaluation error but don't fail the message addition
      console.error("Error evaluating handover conditions:", handoverError);
    }

    res.json({
      success: true,
      data: {
        id: updatedConversation.id,
        leadId: updatedConversation.leadId,
        channel: updatedConversation.channel,
        agentType: updatedConversation.agentType,
        messages: updatedConversation.messages,
        status: updatedConversation.status,
        startedAt: (updatedConversation.startedAt as unknown as Date).toISOString(),
        endedAt: updatedConversation.endedAt ? (updatedConversation.endedAt as unknown as Date).toISOString() : null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error adding message to conversation:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "MESSAGE_ADD_ERROR",
        message: error.message || "Failed to add message to conversation",
        category: "processing"
      }
    });
  }
});

// Trigger handover to human agent
router.post("/conversations/:id/handover", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, priority = 'medium', notes } = req.body;
    
    const conversation = await ConversationsRepository.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found",
          category: "not_found"
        }
      });
    }

    // Update conversation status to indicate handover
    const handoverConversation = await ConversationsRepository.updateStatus(id, 'handed_over');
    
    // Add handover message to conversation
    await ConversationsRepository.addMessage(id, {
      role: 'agent',
      content: `[SYSTEM] Conversation handed over to human agent. Reason: ${reason}. Priority: ${priority}. Notes: ${notes || 'None'}`,
      timestamp: new Date().toISOString()
    });

    // Create communication record for handover
    await CommunicationsRepository.create(
      conversation.leadId as unknown as string,
      'email',
      'outbound',
      `Handover initiated: ${reason}`,
      'pending_handover',
      undefined,
      {
        handover: true,
        reason,
        priority,
        notes,
        conversationId: id,
        handoverTime: new Date().toISOString()
      }
    );

    res.json({
      success: true,
      data: {
        conversationId: id,
        handoverStatus: 'initiated',
        reason,
        priority,
        notes,
        handoverTime: new Date().toISOString(),
        status: 'handed_over'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error triggering handover:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "HANDOVER_ERROR",
        message: error.message || "Failed to trigger handover",
        category: "processing"
      }
    });
  }
});

// Complete/close conversation
router.put("/conversations/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, notes } = req.body;
    
    const conversation = await ConversationsRepository.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found",
          category: "not_found"
        }
      });
    }

    // Update conversation status to completed
    const completedConversation = await ConversationsRepository.updateStatus(id, 'completed');
    
    // Add completion message to conversation
    await ConversationsRepository.addMessage(id, {
      role: 'agent',
      content: `[SYSTEM] Conversation completed. Outcome: ${outcome}. Notes: ${notes || 'None'}`,
      timestamp: new Date().toISOString()
    });

    if (!completedConversation) {
      return res.status(500).json({
        success: false,
        error: {
          code: "CONVERSATION_COMPLETE_ERROR",
          message: "Failed to complete conversation",
          category: "processing"
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: completedConversation.id,
        status: 'completed',
        outcome,
        notes,
        completedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error completing conversation:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "CONVERSATION_COMPLETE_ERROR",
        message: error.message || "Failed to complete conversation",
        category: "processing"
      }
    });
  }
});

// Get conversation analytics
router.get("/conversations/analytics", async (req, res) => {
  try {
    const { timeframe = '30d', agentType = 'email' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get conversation analytics using available methods
    const activeConversations = await ConversationsRepository.getActiveConversationsByChannel();
    const communicationStats = await CommunicationsRepository.getStats();

    const analytics = {
      activeConversationsByChannel: activeConversations,
      communicationStats,
      timeframe,
      agentType,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    };

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error fetching conversation analytics:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "ANALYTICS_ERROR",
        message: error.message || "Failed to fetch conversation analytics",
        category: "processing"
      }
    });
  }
});

export default router;