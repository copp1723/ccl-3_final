import { BaseAgent, AgentContext, AgentDecision } from './base-agent';
import Mailgun from 'mailgun';
import formData from 'form-data';
import { CCLLogger } from '../utils/logger';
import { executeWithMailgunBreaker } from '../utils/circuit-breaker';

export class EmailAgent extends BaseAgent {
  private mailgun: any;
  private domain: string;

  constructor() {
    super('email');
    
    // Initialize Mailgun only if credentials are available
    if (process.env.MAILGUN_API_KEY) {
      const mailgun = new Mailgun(formData);
      this.mailgun = mailgun.client({
        username: 'api',
        key: process.env.MAILGUN_API_KEY
      });
      this.domain = process.env.MAILGUN_DOMAIN || '';
    } else {
      CCLLogger.agentAction('email', 'mailgun_fallback', { reason: 'No API key found, email sending will be simulated' });
      this.mailgun = null;
      this.domain = '';
    }
  }

  // Override getMockResponse for email-specific mock behavior
  protected getMockResponse(prompt: string): string {
    if (prompt.includes('initial email') || prompt.includes('first contact')) {
      return `Hello! Thank you for your interest in our services. We're excited to learn more about your needs and how we can help you. 

I noticed you're interested in getting more information. Could you tell me a bit more about what you're looking for?

Best regards,
CCL-3 Team`;
    }
    
    if (prompt.includes('response to this customer email')) {
      return `Thank you for your message! I understand your interest and I'm here to help. Let me address your questions and provide you with the information you need.

Based on what you've shared, I believe we can definitely assist you. Would you like to schedule a brief call to discuss your specific requirements?

Looking forward to hearing from you!`;
    }
    
    return super.getMockResponse(prompt);
  }

  async processMessage(message: string, context: AgentContext): Promise<string> {
    const { lead, campaign } = context;
    
    const systemPrompt = `You are an Email Agent communicating with a potential customer.
Your goal is to engage them professionally and move them towards the campaign goals.
Campaign Goals: ${campaign?.goals?.join(', ') || 'General engagement'}
Be friendly, helpful, and focus on understanding their needs.`;

    const prompt = `Generate a response to this customer email:
Customer Name: ${lead.name}
Their Message: "${message}"

Context:
- They came from: ${lead.source}
- Campaign: ${lead.campaign || 'General inquiry'}

Create a professional, engaging email response that:
1. Addresses their message directly
2. Moves towards campaign goals
3. Asks relevant qualifying questions
4. Maintains a helpful, non-pushy tone`;

    return await this.callOpenRouter(prompt, systemPrompt);
  }

  async makeDecision(_context: AgentContext): Promise<AgentDecision> {
    // Email agent doesn't make strategic decisions, that's Overlord's job
    return {
      action: 'send_email',
      reasoning: 'Email agent executing communication task',
      data: {}
    };
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<any> {
    try {
      // Check if Mailgun is configured
      if (!process.env.MAILGUN_API_KEY || !this.domain) {
        CCLLogger.agentAction('email', 'simulated_send', { to, subject, reason: 'Mailgun not configured' });
        const mockResponse = {
          id: `mock-${Date.now()}@example.com`,
          message: 'Simulated email send (Mailgun not configured)'
        };
        CCLLogger.communicationSent('email', '', { recipient: to, subject, mock: true });
        return mockResponse;
      }

      const messageData = {
        from: process.env.MAILGUN_FROM_EMAIL || 'noreply@example.com',
        to: to,
        subject: subject,
        text: text,
        html: html || text
      };

      // Wrap Mailgun API call with circuit breaker protection
      const response = await executeWithMailgunBreaker(async () => {
        return await this.mailgun.messages.create(this.domain, messageData);
      });
      
      CCLLogger.communicationSent('email', '', { recipient: to, subject, externalId: response.id });
      return response;
    } catch (error) {
      CCLLogger.communicationFailed('email', '', error as Error, { recipient: to, subject });
      // Return mock response instead of throwing
      return {
        id: `mock-error-${Date.now()}@example.com`,
        message: 'Email send failed, returning mock response',
        error: (error as Error).message
      };
    }
  }

  async generateInitialEmail(context: AgentContext, focus: string): Promise<string> {
    const { lead } = context;
    
    const systemPrompt = `You are crafting the first email to a potential customer.
Make it welcoming, professional, and focused on understanding their needs.`;

    const prompt = `Create an initial email for:
Customer Name: ${lead.name}
Source: ${lead.source}
Focus Area: ${focus}

The email should:
1. Thank them for their interest
2. Briefly introduce how you can help
3. Ask an engaging question related to the focus area
4. Be concise (under 150 words)
5. End with a clear call-to-action`;

    return await this.callOpenRouter(prompt, systemPrompt);
  }
}