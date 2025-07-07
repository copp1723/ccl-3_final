// server/services/email-conversation-manager.ts
// Manages the template → AI conversation flow

import { LeadsRepository, ConversationsRepository, CommunicationsRepository } from '../db';
import { nanoid } from 'nanoid';

export interface EmailTemplate {
  id: string;
  subject: string;
  body: string;
  delayMinutes: number;
  expectedReplyPatterns?: string[];
}

export interface ConversationState {
  leadId: string;
  mode: 'template' | 'ai';
  templatesStage: number; // Which template in sequence
  lastSentAt: Date;
  hasResponded: boolean;
  conversationHistory: Array<{
    role: 'system' | 'assistant' | 'user';
    content: string;
    timestamp: Date;
    isTemplate?: boolean;
  }>;
}

export class EmailConversationManager {
  private templates: EmailTemplate[] = [];
  private conversationStates = new Map<string, ConversationState>();

  constructor() {
    this.loadTemplates();
  }

  private loadTemplates() {
    // Load from environment or database
    // For now, hardcoded examples
    this.templates = [
      {
        id: 'template-1',
        subject: 'Welcome! Quick question about your needs',
        body: `Hi {{name}},

Thanks for your interest! I wanted to reach out personally to understand what brought you here.

Are you looking for a specific solution, or just exploring options?

Best regards,
The Team`,
        delayMinutes: 0, // Send immediately
        expectedReplyPatterns: ['looking for', 'need', 'interested', 'exploring']
      },
      {
        id: 'template-2',
        subject: 'Following up - how can we help?',
        body: `Hi {{name}},

I noticed you haven't had a chance to reply yet. No worries at all!

I'm here when you're ready. What's the biggest challenge you're facing right now?

Talk soon,
The Team`,
        delayMinutes: 1440, // 24 hours
        expectedReplyPatterns: ['challenge', 'problem', 'issue', 'help']
      },
      {
        id: 'template-3',
        subject: 'Last check-in',
        body: `Hi {{name}},

I'll keep this brief - just wanted to make sure you got my previous messages.

If now's not the right time, no problem at all. When would be better for you?

Best,
The Team`,
        delayMinutes: 2880, // 48 hours
        expectedReplyPatterns: ['time', 'busy', 'later', 'schedule']
      }
    ];
  }

  async initializeConversation(lead: any): Promise<void> {
    const state: ConversationState = {
      leadId: lead.id,
      mode: 'template',
      templatesStage: 0,
      lastSentAt: new Date(),
      hasResponded: false,
      conversationHistory: []
    };

    this.conversationStates.set(lead.id, state);
    
    // Send first template immediately
    await this.sendNextTemplate(lead);
  }

  async sendNextTemplate(lead: any): Promise<boolean> {
    const state = this.conversationStates.get(lead.id);
    if (!state || state.mode === 'ai') return false;

    const template = this.templates[state.templatesStage];
    if (!template) return false;

    // Check if enough time has passed
    const timeSinceLastSent = Date.now() - state.lastSentAt.getTime();
    const requiredDelay = template.delayMinutes * 60 * 1000;
    
    if (timeSinceLastSent < requiredDelay) {
      return false; // Not time yet
    }

    // Personalize template
    const personalizedBody = template.body.replace('{{name}}', lead.name);

    // Send email
    const response = await this.sendEmail(
      lead.email,
      template.subject,
      personalizedBody
    );

    if (response.success) {
      // Update state
      state.templatesStage++;
      state.lastSentAt = new Date();
      state.conversationHistory.push({
        role: 'assistant',
        content: personalizedBody,
        timestamp: new Date(),
        isTemplate: true
      });

      // Save to database
      await CommunicationsRepository.create(
        lead.id,
        'email',
        'outbound',
        personalizedBody,
        'sent',
        response.id,
        { 
          isTemplate: true,
          templateId: template.id,
          subject: template.subject
        }
      );

      return true;
    }

    return false;
  }

  async processIncomingReply(leadId: string, replyContent: string): Promise<void> {
    const state = this.conversationStates.get(leadId);
    if (!state) return;

    // Add reply to history
    state.conversationHistory.push({
      role: 'user',
      content: replyContent,
      timestamp: new Date()
    });

    // Save to database
    await CommunicationsRepository.create(
      leadId,
      'email',
      'inbound',
      replyContent,
      'received',
      null,
      { conversationMode: state.mode }
    );

    if (state.mode === 'template') {
      // CRITICAL: Switch to AI mode on first reply
      state.mode = 'ai';
      state.hasResponded = true;

      // Generate AI response
      await this.generateAIResponse(leadId);
    } else {
      // Already in AI mode, continue with AI
      await this.generateAIResponse(leadId);
    }
  }

  private async generateAIResponse(leadId: string): Promise<void> {
    const state = this.conversationStates.get(leadId);
    if (!state || state.mode !== 'ai') return;

    const lead = await LeadsRepository.findById(leadId);
    if (!lead) return;

    // Get AI agent
    const { EmailAgentAI } = await import('../agents/email-agent-ai');
    const aiAgent = new EmailAgentAI();

    // Build full context for AI
    const fullContext = {
      lead,
      conversationHistory: state.conversationHistory,
      instructions: `You are now in full AI mode. The lead has responded to our initial outreach.
      
CRITICAL RULES:
1. You must maintain a helpful, professional tone
2. Address their specific questions or concerns
3. Guide them toward booking a call or providing more information
4. Do NOT use any templates - every response must be unique and contextual
5. Reference previous messages naturally
6. Keep responses concise but valuable

The conversation so far is provided in the history. Generate a contextual, personalized response.`
    };

    // Generate AI response
    const aiResponse = await aiAgent.generateContextualResponse(fullContext);

    // Send the AI-generated email
    const response = await this.sendEmail(
      lead.email,
      aiResponse.subject,
      aiResponse.body
    );

    if (response.success) {
      // Update conversation history
      state.conversationHistory.push({
        role: 'assistant',
        content: aiResponse.body,
        timestamp: new Date(),
        isTemplate: false
      });

      // Save to database
      await CommunicationsRepository.create(
        lead.id,
        'email',
        'outbound',
        aiResponse.body,
        'sent',
        response.id,
        { 
          isTemplate: false,
          mode: 'ai',
          subject: aiResponse.subject
        }
      );
    }
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<any> {
    try {
      const response = await fetch(
        `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
          },
          body: new URLSearchParams({
            from: process.env.MAILGUN_FROM_EMAIL || 'noreply@example.com',
            to,
            subject,
            text: body
          })
        }
      );

      const result = await response.json();
      return { success: response.ok, id: result.id };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error };
    }
  }

  // Get conversation state for monitoring
  getConversationState(leadId: string): ConversationState | undefined {
    return this.conversationStates.get(leadId);
  }

  // Check all conversations for templates that need sending
  async processTemplateQueue(): Promise<void> {
    for (const [leadId, state] of this.conversationStates) {
      if (state.mode === 'template' && !state.hasResponded) {
        const lead = await LeadsRepository.findById(leadId);
        if (lead) {
          await this.sendNextTemplate(lead);
        }
      }
    }
  }
}

// Singleton instance
export const emailConversationManager = new EmailConversationManager();

// Background job to send templates
setInterval(() => {
  emailConversationManager.processTemplateQueue();
}, 60000); // Check every minute
