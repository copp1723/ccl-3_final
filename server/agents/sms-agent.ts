import { BaseAgent, AgentContext, AgentDecision } from './base-agent';
import twilio from 'twilio';
import { CCLLogger } from '../utils/logger.js';
import { executeWithTwilioBreaker } from '../utils/circuit-breaker.js';

export class SMSAgent extends BaseAgent {
  private twilioClient: any;
  private fromNumber: string;

  constructor() {
    super('sms');
    
    // Initialize Twilio only if credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    } else {
      CCLLogger.agentAction('sms', 'twilio_fallback', { reason: 'No credentials found, SMS sending will be simulated' });
      this.twilioClient = null;
      this.fromNumber = '';
    }
  }

  // Override getMockResponse for SMS-specific mock behavior
  protected getMockResponse(prompt: string): string {
    if (prompt.includes('initial SMS') || prompt.includes('first contact')) {
      return `Hi! Thanks for your interest. We'd love to help with your needs. Reply YES to learn more or call us at 1-800-EXAMPLE.`;
    }
    
    if (prompt.includes('SMS response')) {
      return `Thanks for your reply! We can definitely help with that. When would be a good time for a quick call to discuss?`;
    }
    
    return super.getMockResponse(prompt);
  }

  async processMessage(message: string, context: AgentContext): Promise<string> {
    const { lead, campaign } = context;
    
    const systemPrompt = `You are an SMS Agent communicating with a potential customer via text message.
Keep responses brief, friendly, and focused on the campaign goals.
Campaign Goals: ${campaign?.goals?.join(', ') || 'General engagement'}
SMS messages should be under 160 characters when possible.`;

    const prompt = `Generate a brief SMS response:
Customer Name: ${lead.name}
Their Message: "${message}"

Context:
- Source: ${lead.source}
- Campaign: ${lead.campaign || 'General'}

Create a concise, friendly text that:
1. Addresses their message
2. Moves towards campaign goals
3. Uses conversational language
4. Stays under 160 characters if possible`;

    return await this.callOpenRouter(prompt, systemPrompt);
  }

  async makeDecision(_context: AgentContext): Promise<AgentDecision> {
    return {
      action: 'send_sms',
      reasoning: 'SMS agent executing communication task',
      data: {}
    };
  }

  async sendSMS(to: string, body: string): Promise<any> {
    try {
      // Check if Twilio is configured
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !this.fromNumber) {
        CCLLogger.agentAction('sms', 'simulated_send', { to, reason: 'Twilio not configured' });
        const mockResponse = {
          sid: `mock-sms-${Date.now()}`,
          to: to,
          from: this.fromNumber || '+1234567890',
          body: body,
          status: 'sent',
          message: 'Simulated SMS send (Twilio not configured)'
        };
        CCLLogger.communicationSent('sms', '', { recipient: to, body, mock: true });
        return mockResponse;
      }

      // Wrap Twilio API call with circuit breaker protection
      const message = await executeWithTwilioBreaker(async () => {
        return await this.twilioClient.messages.create({
          body: body,
          from: this.fromNumber,
          to: to
        });
      });
      
      CCLLogger.communicationSent('sms', '', { recipient: to, externalId: message.sid });
      return message;
    } catch (error) {
      CCLLogger.communicationFailed('sms', '', error as Error, { recipient: to });
      // Return mock response instead of throwing
      return {
        sid: `mock-error-${Date.now()}`,
        to: to,
        from: this.fromNumber || '+1234567890',
        body: body,
        status: 'failed',
        message: 'SMS send failed, returning mock response',
        error: (error as Error).message
      };
    }
  }

  async generateInitialSMS(context: AgentContext, focus: string): Promise<string> {
    const { lead } = context;
    
    const systemPrompt = `You are crafting the first SMS to a potential customer.
Keep it very brief, friendly, and engaging. Maximum 160 characters.`;

    const prompt = `Create an initial SMS for:
Customer Name: ${lead.name}
Focus: ${focus}

The SMS should:
1. Greet them by name
2. Mention the focus area
3. Ask a simple engaging question
4. Be under 160 characters
5. Sound conversational, not robotic`;

    return await this.callOpenRouter(prompt, systemPrompt);
  }
}