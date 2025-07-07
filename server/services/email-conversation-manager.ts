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
    // Support dynamic template count from environment
    const templateCount = parseInt(process.env.EMAIL_TEMPLATE_COUNT || '6');
    const templatePath = process.env.EMAIL_TEMPLATES_PATH;
    
    // Try to load from file if path provided
    if (templatePath) {
      try {
        const templates = require(templatePath);
        this.templates = templates.templates || templates;
        console.log(`Loaded ${this.templates.length} templates from ${templatePath}`);
        return;
      } catch (error) {
        console.error(`Failed to load templates from ${templatePath}, generating dynamic templates`);
      }
    }
    
    // Generate dynamic templates based on count
    this.templates = this.generateDynamicTemplates(templateCount);
    console.log(`Generated ${this.templates.length} dynamic email templates`);
  }

  private generateDynamicTemplates(count: number): EmailTemplate[] {
    const templates: EmailTemplate[] = [];
    
    // Determine nurture strategy based on count
    const strategy = count <= 10 ? 'sprint' : count <= 30 ? 'standard' : count <= 50 ? 'extended' : 'marathon';
    
    for (let i = 0; i < count; i++) {
      // Calculate delay based on position in sequence
      let delayMinutes: number;
      if (i === 0) delayMinutes = 0; // First email immediately
      else if (i === 1) delayMinutes = 60; // Second after 1 hour
      else if (i < 5) delayMinutes = 1440 * (i - 1); // Daily for first week
      else if (i < 10) delayMinutes = 1440 * 3 * (i - 4); // Every 3 days
      else if (i < 20) delayMinutes = 1440 * 7 * (i - 9); // Weekly
      else if (i < 30) delayMinutes = 1440 * 14 * (i - 19); // Bi-weekly
      else delayMinutes = 1440 * 30 * (i - 29); // Monthly
      
      // Generate varied subjects
      const subjects = [
        'Welcome! Quick question about your needs',
        'Did you find what you were looking for?',
        '🎯 Special offer inside',
        'Your personalized recommendations',
        'Still thinking it over?',
        'Important update for you',
        'Last chance to connect',
        'Quick tip that might help',
        'Success story from someone like you',
        'One more thing to consider'
      ];
      
      // Generate content based on stage
      const stage = i < 3 ? 'early' : i < 10 ? 'middle' : 'late';
      const urgency = i < 5 ? 'low' : i < 15 ? 'medium' : 'high';
      
      templates.push({
        id: `template-${i + 1}`,
        subject: subjects[i % subjects.length] || `Follow-up #${i + 1}`,
        body: this.generateTemplateBody(i, stage, urgency),
        delayMinutes,
        expectedReplyPatterns: this.getExpectedPatterns(stage)
      });
    }
    
    return templates;
  }

  private generateTemplateBody(index: number, stage: string, urgency: string): string {
    const greetings = ['Hi', 'Hello', 'Hey', 'Good morning', 'Good afternoon'];
    const greeting = greetings[index % greetings.length];
    
    const bodies = {
      early: [
        'Thanks for your interest! I wanted to reach out personally to understand what brought you here.',
        'I noticed you were checking out our solutions. What specific challenge are you trying to solve?',
        'Just following up on your recent visit. How can we help you achieve your goals?'
      ],
      middle: [
        'I wanted to check in and see if you had any questions I could help answer.',
        'Many of our customers had similar concerns before getting started. What\'s holding you back?',
        'I have some insights that might be helpful for your situation. When would be a good time to chat?'
      ],
      late: [
        'This will be one of my last emails. Is there anything I can help clarify?',
        'I\'ll stop reaching out soon, but wanted to leave the door open. Reply anytime if you need help.',
        'Final check-in: If the timing isn\'t right, I understand. Just let me know if you\'d like to stay in touch.'
      ]
    };
    
    const bodyOptions = bodies[stage] || bodies.middle;
    const bodyText = bodyOptions[index % bodyOptions.length];
    
    return `${greeting} {{name}},

${bodyText}

${urgency === 'high' ? '\nP.S. This offer expires soon, so don\'t wait too long!\n' : ''}
Best regards,
The Team`;
  }

  private getExpectedPatterns(stage: string): string[] {
    const patterns = {
      early: ['interested', 'looking for', 'need', 'want', 'help'],
      middle: ['question', 'concern', 'thinking', 'considering', 'maybe'],
      late: ['stop', 'unsubscribe', 'not interested', 'remove', 'later']
    };
    
    return patterns[stage] || patterns.middle;
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
