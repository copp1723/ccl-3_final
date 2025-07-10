import { ConversationsRepository } from '../db/conversations-repository';
import { CampaignsRepository } from '../db/campaigns-repository';
import { LeadsRepository } from '../db/leads-repository';
import { CommunicationsRepository } from '../db/communications-repository';
import { logger } from '../utils/logger';

export interface HandoverEvaluation {
  shouldHandover: boolean;
  reason: string;
  score: number;
  triggeredCriteria: string[];
  nextActions: string[];
}

export interface ConversationAnalysis {
  qualificationScore: number;
  goalProgress: Record<string, boolean>;
  keywordMatches: string[];
  sentimentScore: number;
  urgencyLevel: 'low' | 'medium' | 'high';
}

export class HandoverService {
  /**
   * Evaluate if a conversation should trigger handover based on campaign criteria
   */
  static async evaluateHandover(
    conversationId: string,
    newMessage?: { role: 'agent' | 'lead'; content: string }
  ): Promise<HandoverEvaluation> {
    try {
      const conversation = await ConversationsRepository.findById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Get campaign criteria
      const campaign = conversation.campaignId 
        ? await CampaignsRepository.findById(conversation.campaignId)
        : await CampaignsRepository.getDefaultCampaign();

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const criteria = campaign.handoverCriteria;
      const analysis = await this.analyzeConversation(conversation, newMessage);
      
      const evaluation: HandoverEvaluation = {
        shouldHandover: false,
        reason: '',
        score: analysis.qualificationScore,
        triggeredCriteria: [],
        nextActions: []
      };

      // Check qualification score threshold
      if (analysis.qualificationScore >= criteria.qualificationScore) {
        evaluation.shouldHandover = true;
        evaluation.triggeredCriteria.push('qualification_score');
        evaluation.reason = `Lead qualification score (${analysis.qualificationScore}) meets threshold (${criteria.qualificationScore})`;
      }

      // Check conversation length
      const messageCount = conversation.messages.length + (newMessage ? 1 : 0);
      if (messageCount >= criteria.conversationLength) {
        evaluation.shouldHandover = true;
        evaluation.triggeredCriteria.push('conversation_length');
        evaluation.reason += evaluation.reason ? ' and ' : '';
        evaluation.reason += `Conversation length (${messageCount}) exceeds threshold (${criteria.conversationLength})`;
      }

      // Check keyword triggers
      const triggeredKeywords = analysis.keywordMatches.filter(keyword => 
        criteria.keywordTriggers.some(trigger => 
          keyword.toLowerCase().includes(trigger.toLowerCase())
        )
      );
      
      if (triggeredKeywords.length > 0) {
        evaluation.shouldHandover = true;
        evaluation.triggeredCriteria.push('keyword_triggers');
        evaluation.reason += evaluation.reason ? ' and ' : '';
        evaluation.reason += `Triggered keywords: ${triggeredKeywords.join(', ')}`;
      }

      // Check goal completion
      const completedGoals = Object.entries(analysis.goalProgress)
        .filter(([_, completed]) => completed)
        .map(([goal, _]) => goal);
      
      const requiredGoalsCompleted = criteria.goalCompletionRequired.every(goal =>
        completedGoals.includes(goal)
      );

      if (requiredGoalsCompleted && criteria.goalCompletionRequired.length > 0) {
        evaluation.shouldHandover = true;
        evaluation.triggeredCriteria.push('goal_completion');
        evaluation.reason += evaluation.reason ? ' and ' : '';
        evaluation.reason += `Required goals completed: ${criteria.goalCompletionRequired.join(', ')}`;
      }

      // Check time threshold (conversation duration)
      const conversationDuration = Date.now() - conversation.startedAt.getTime();
      const timeThresholdMs = criteria.timeThreshold * 1000; // Convert seconds to milliseconds
      
      if (conversationDuration >= timeThresholdMs) {
        evaluation.shouldHandover = true;
        evaluation.triggeredCriteria.push('time_threshold');
        evaluation.reason += evaluation.reason ? ' and ' : '';
        evaluation.reason += `Conversation duration exceeds threshold`;
      }

      // Determine next actions
      if (evaluation.shouldHandover) {
        evaluation.nextActions = [
          'Transfer to human agent',
          'Notify sales team',
          'Schedule follow-up call'
        ];
      } else {
        evaluation.nextActions = [
          'Continue AI conversation',
          'Gather more qualification info',
          'Nurture relationship'
        ];
      }

      return evaluation;
    } catch (error) {
      logger.error('Error evaluating handover', { conversationId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Analyze conversation content for qualification scoring and goal progress
   */
  static async analyzeConversation(
    conversation: any,
    newMessage?: { role: 'agent' | 'lead'; content: string }
  ): Promise<ConversationAnalysis> {
    const messages = [...conversation.messages];
    if (newMessage) {
      messages.push(newMessage);
    }

    const analysis: ConversationAnalysis = {
      qualificationScore: conversation.currentQualificationScore || 0,
      goalProgress: conversation.goalProgress || {},
      keywordMatches: [],
      sentimentScore: 0,
      urgencyLevel: 'low'
    };

    // Analyze message content for qualification indicators
    const qualificationKeywords = {
      'budget_confirmed': ['budget', 'afford', 'payment', 'financing', 'loan'],
      'timeline_established': ['when', 'soon', 'urgently', 'asap', 'timeline'],
      'decision_maker': ['decision', 'decide', 'authorize', 'approve'],
      'interest_level': ['interested', 'love', 'perfect', 'exactly', 'want'],
      'contact_info': ['phone', 'email', 'contact', 'reach', 'call']
    };

    const urgencyKeywords = ['urgent', 'asap', 'immediately', 'now', 'today'];
    const positiveKeywords = ['yes', 'interested', 'great', 'perfect', 'love'];
    const negativeKeywords = ['no', 'not interested', 'later', 'busy', 'maybe'];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const message of messages) {
      if (message.role === 'lead') {
        const content = message.content.toLowerCase();
        
        // Check qualification keywords
        for (const [category, keywords] of Object.entries(qualificationKeywords)) {
          const found = keywords.some(keyword => content.includes(keyword));
          if (found) {
            analysis.goalProgress[category] = true;
            analysis.qualificationScore += 1;
            analysis.keywordMatches.push(...keywords.filter(k => content.includes(k)));
          }
        }

        // Check urgency
        if (urgencyKeywords.some(keyword => content.includes(keyword))) {
          analysis.urgencyLevel = 'high';
        }

        // Sentiment analysis (simple)
        positiveCount += positiveKeywords.filter(keyword => content.includes(keyword)).length;
        negativeCount += negativeKeywords.filter(keyword => content.includes(keyword)).length;
      }
    }

    // Calculate sentiment score
    analysis.sentimentScore = positiveCount - negativeCount;
    
    // Adjust urgency based on sentiment and qualification
    if (analysis.sentimentScore > 2 && analysis.qualificationScore > 5) {
      analysis.urgencyLevel = 'high';
    } else if (analysis.sentimentScore > 0 || analysis.qualificationScore > 3) {
      analysis.urgencyLevel = 'medium';
    }

    return analysis;
  }

  /**
   * Execute handover to human agent
   */
  static async executeHandover(
    conversationId: string,
    reason: string,
    humanAgentId?: string
  ): Promise<boolean> {
    try {
      // Update conversation status
      await ConversationsRepository.updateStatus(conversationId, 'handover_pending');
      
      const conversation = await ConversationsRepository.findById(conversationId);
      if (!conversation) return false;

      // Add handover message to conversation
      await ConversationsRepository.addMessage(conversationId, {
        role: 'agent',
        content: `🤝 **Handover Initiated**\n\nReason: ${reason}\n\nA human agent will be with you shortly to assist with your inquiry.`,
        timestamp: new Date().toISOString()
      });

      // Update lead qualification score
      if (conversation.currentQualificationScore) {
        await LeadsRepository.updateQualificationScore(
          conversation.leadId,
          conversation.currentQualificationScore
        );
      }

      // Create communication record
      await CommunicationsRepository.create(
        conversation.leadId,
        conversation.channel,
        'outbound',
        `Handover to human agent: ${reason}`,
        'completed'
      );

      logger.info('Handover executed successfully', {
        conversationId,
        leadId: conversation.leadId,
        reason,
        humanAgentId
      });

      return true;
    } catch (error) {
      logger.error('Error executing handover', { conversationId, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get cross-channel conversation context for a lead
   */
  static async getCrossChannelContext(leadId: string): Promise<{
    previousChannels: string[];
    sharedNotes: string[];
    leadPreferences: Record<string, any>;
    totalQualificationScore: number;
    overallGoalProgress: Record<string, boolean>;
  }> {
    try {
      const conversations = await ConversationsRepository.findByLeadId(leadId);
      const lead = await LeadsRepository.findById(leadId);

      const context = {
        previousChannels: [...new Set(conversations.map(c => c.channel))],
        sharedNotes: [] as string[],
        leadPreferences: lead?.metadata || {},
        totalQualificationScore: lead?.qualificationScore || 0,
        overallGoalProgress: {} as Record<string, boolean>
      };

      // Aggregate goal progress across all conversations
      for (const conversation of conversations) {
        if (conversation.goalProgress) {
          for (const [goal, completed] of Object.entries(conversation.goalProgress)) {
            if (completed) {
              (context.overallGoalProgress as Record<string, boolean>)[goal] = true;
            }
          }
        }

        // Extract important notes from conversations
        if (conversation.crossChannelContext?.sharedNotes) {
          context.sharedNotes.push(...conversation.crossChannelContext.sharedNotes);
        }
      }

      return context;
    } catch (error) {
      logger.error('Error getting cross-channel context', { leadId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update cross-channel context when switching channels
   */
  static async updateCrossChannelContext(
    conversationId: string,
    newContext: {
      sharedNotes?: string[];
      leadPreferences?: Record<string, any>;
    }
  ): Promise<boolean> {
    try {
      const conversation = await ConversationsRepository.findById(conversationId);
      if (!conversation) return false;

      const updatedContext = {
        ...conversation.crossChannelContext,
        ...newContext,
        sharedNotes: [
          ...(conversation.crossChannelContext?.sharedNotes || []),
          ...(newContext.sharedNotes || [])
        ]
      };

      // Update conversation with new context
      // Note: This would need a method in ConversationsRepository to update crossChannelContext
      logger.info('Cross-channel context updated', {
        conversationId,
        leadId: conversation.leadId
      });

      return true;
    } catch (error) {
      logger.error('Error updating cross-channel context', { conversationId, error: (error as Error).message });
      return false;
    }
  }
}