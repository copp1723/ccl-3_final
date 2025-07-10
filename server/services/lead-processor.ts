import { LeadsRepository, ConversationsRepository, AgentDecisionsRepository, CommunicationsRepository, CampaignsRepository } from '../db';
import { getOverlordAgent, getEmailAgent, getSMSAgent, getChatAgent } from '../agents';
import { CCLLogger } from '../utils/logger.js';
import { feedbackService } from './feedback-service';
import { queueManager } from '../workers/queue-manager.js';

/**
 * Lead processing service - the heart of the system
 * Can process immediately or queue for background processing
 */
export class LeadProcessor {
  private broadcastCallback?: (data: any) => void;

  constructor(broadcastCallback?: (data: any) => void) {
    this.broadcastCallback = broadcastCallback;
  }

  async processNewLead(lead: any, useBackgroundJob: boolean = false) {
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
        console.warn('Failed to queue lead for background processing, processing immediately', {
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
      CCLLogger.agentDecision('overlord', decision.action, decision.reasoning || 'No reasoning provided', { 
        leadId: lead.id, 
        leadName: lead.name, 
        decision 
      });
      
      // 4. Check if the decision is to assign a channel
      if (decision.action === 'assign_channel' && decision.data.channel) {
        await this.processChannelAssignment(lead, decision, campaign);
      } else if (decision.action === 'send_to_boberdoo') {
        await this.processBoberdooSubmission(lead, overlord);
      }
      
    } catch (error) {
      await this.handleProcessingError(lead, error as Error);
    }
  }

  private async processChannelAssignment(lead: any, decision: any, campaign: any) {
    const channel = decision.data.channel;
    
    // 5. Generate initial contact message
    let messageContent = '';
    let subject = '';
    
    if (channel === 'email') {
      const emailAgent = getEmailAgent();
      messageContent = await emailAgent.generateInitialEmail(
        { lead, campaign },
        decision.data.initialMessageFocus || 'general inquiry'
      );
      subject = `Thank you for your interest${campaign?.name ? ` in ${campaign.name}` : ''}`;
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
    const sendResult = await this.sendMessage(lead, channel, messageContent, subject, conversation.id);
    
    // 8. Broadcast updates to WebSocket clients
    this.broadcast({
      type: 'lead_processed',
      lead,
      decision,
      conversation: {
        id: conversation.id,
        content: messageContent,
        channel,
        status: sendResult.status
      }
    });
    
    // 9. Update lead qualification score based on initial engagement
    const newScore = Math.min(lead.qualificationScore + 10, 100);
    await LeadsRepository.updateQualificationScore(lead.id, newScore);
    
    // Send success feedback
    feedbackService.success(`Lead ${lead.name} assigned to ${channel} channel`);
  }

  private async sendMessage(lead: any, channel: string, messageContent: string, subject: string, conversationId: string) {
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
      
      // Record the communication
      if (externalId || channel === 'chat') {
        await CommunicationsRepository.create(
          lead.id,
          channel as 'email' | 'sms' | 'chat',
          'outbound',
          messageContent,
          sendStatus,
          externalId,
          { conversationId }
        );
      }
    } catch (sendError) {
      CCLLogger.communicationFailed(channel as 'email' | 'sms' | 'chat', lead.id, sendError as Error, { messageContent });
      sendStatus = 'failed';
      
      // Still record the failed attempt
      await CommunicationsRepository.create(
        lead.id,
        channel as 'email' | 'sms' | 'chat',
        'outbound',
        messageContent,
        'failed',
        undefined,
        { error: (sendError as Error).message, conversationId }
      );
    }
    
    return { status: sendStatus, externalId };
  }

  private async processBoberdooSubmission(lead: any, overlord: any) {
    // Lead is already qualified, send directly to Boberdoo
    CCLLogger.externalApiCall('boberdoo', '/lead', 'POST', { 
      leadId: lead.id, 
      leadName: lead.name 
    });
    
    const boberdooResult = await overlord.submitToBoberdoo(lead);
    
    this.broadcast({
      type: 'lead_sent_to_boberdoo',
      lead,
      result: boberdooResult
    });
    
    // Send notification
    feedbackService.leadQualified(lead);
  }

  private async handleProcessingError(lead: any, error: Error) {
    CCLLogger.leadError(lead.id, error, { 
      leadName: lead.name, 
      step: 'lead_processing' 
    });
    
    // Record the error as a decision
    await AgentDecisionsRepository.create(
      lead.id,
      'overlord',
      'processing_error',
      `Error processing lead: ${error.message}`,
      { error: error.toString() }
    );
    
    // Notify clients of the error
    this.broadcast({
      type: 'lead_processing_error',
      lead,
      error: error.message
    });
    
    // Send error feedback
    feedbackService.error(`Failed to process lead ${lead.name}: ${error.message}`);
  }

  private broadcast(data: any) {
    if (this.broadcastCallback) {
      this.broadcastCallback(data);
    }
  }
}

// Export a default instance for backward compatibility
export const leadProcessor = new LeadProcessor();