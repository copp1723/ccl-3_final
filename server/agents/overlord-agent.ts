import { BaseAgent, AgentContext, AgentDecision } from './base-agent';
import { Lead, LeadsRepository, AgentDecisionsRepository } from '../db';
import { CCLLogger } from '../utils/logger.js';
import { executeWithBoberdooBreaker } from '../utils/circuit-breaker.js';

interface BoberdooResponse {
  success: boolean;
  matched: boolean;
  buyerId?: string;
  price?: number;
  message?: string;
}

export class OverlordAgent extends BaseAgent {
  constructor() {
    super('overlord');
  }

  // Override getMockResponse for more intelligent mock behavior
  protected getMockResponse(prompt: string): string {
    // For lead routing decisions, return appropriate mock JSON
    if (prompt.includes('route this lead') || prompt.includes('Campaign:')) {
      // Determine channel based on lead data in prompt
      let channel = 'email'; // default
      let priority = 'medium';
      
      if (prompt.includes('phone') && prompt.includes('+')) {
        channel = Math.random() > 0.5 ? 'sms' : 'email';
      }
      
      if (prompt.includes('urgent') || prompt.includes('high priority')) {
        priority = 'high';
      }
      
      return JSON.stringify({
        action: 'assign_channel',
        channel: channel,
        reasoning: `Mock decision: Assigning lead to ${channel} channel for initial contact`,
        priority: priority,
        initialMessageFocus: 'Introduction and understanding their needs'
      });
    }
    
    // For conversation evaluation
    if (prompt.includes('evaluate') && prompt.includes('conversation')) {
      return JSON.stringify({
        action: 'continue_conversation',
        reasoning: 'Mock decision: Continue engaging with the lead',
        nextSteps: ['Gather more information', 'Address questions']
      });
    }
    
    // Default mock response
    return super.getMockResponse(prompt);
  }

  async processMessage(_message: string, _context: AgentContext): Promise<string> {
    // Overlord doesn't directly communicate with leads
    throw new Error('Overlord agent does not process direct messages');
  }

  async makeDecision(context: AgentContext): Promise<AgentDecision> {
    const { lead, campaign } = context;
    
    // Save decision to database
    const saveDecision = async (decision: AgentDecision) => {
      await AgentDecisionsRepository.create(
        lead.id,
        'overlord',
        decision.action,
        decision.reasoning,
        decision.data
      );
      return decision;
    };
    
    const systemPrompt = `You are the Overlord Agent, responsible for orchestrating the lead management process.
Your role is to:
1. Evaluate incoming leads
2. Assign them to the best communication channel (email, sms, or chat)
3. Monitor conversation progress
4. Decide when a lead is qualified
5. Trigger submission to Boberdoo when ready

Campaign Goals: ${campaign?.goals?.join(', ') || 'No specific goals'}
Qualification Criteria: ${JSON.stringify(campaign?.qualificationCriteria || {})}`;

    const prompt = `Evaluate this lead and decide the next action:
Lead Information:
- Name: ${lead.name}
- Email: ${lead.email || 'Not provided'}
- Phone: ${lead.phone || 'Not provided'}
- Source: ${lead.source}
- Campaign: ${lead.campaign || 'None'}
- Current Status: ${lead.status}
- Qualification Score: ${lead.qualificationScore}/100

Based on this information, decide:
1. Which channel to use for initial contact (email, sms, or chat)
2. What the initial message should focus on
3. Whether the lead needs immediate attention

Respond in JSON format:
{
  "action": "assign_channel|qualify_lead|send_to_boberdoo|archive",
  "channel": "email|sms|chat",
  "reasoning": "Your reasoning here",
  "priority": "high|medium|low",
  "initialMessageFocus": "Brief description of what to discuss"
}`;

    const response = await this.callOpenRouter(prompt, systemPrompt);
    
    try {
      const decision = JSON.parse(response);
      const result = {
        action: decision.action,
        reasoning: decision.reasoning,
        data: {
          channel: decision.channel,
          priority: decision.priority,
          initialMessageFocus: decision.initialMessageFocus
        }
      };
      
      // Update lead with assigned channel if action is assign_channel
      if (decision.action === 'assign_channel' && decision.channel) {
        await LeadsRepository.assignChannel(lead.id, decision.channel);
      }
      
      return saveDecision(result);
    } catch (error) {
      CCLLogger.agentError('overlord', 'decision_parsing', error as Error, { leadId: context.lead.id });
      const defaultDecision = {
        action: 'assign_channel',
        reasoning: 'Default decision due to parsing error',
        data: { channel: 'email', priority: 'medium' }
      };
      
      await LeadsRepository.assignChannel(lead.id, 'email');
      return saveDecision(defaultDecision);
    }
  }

  async evaluateConversation(conversationHistory: any[], context: AgentContext): Promise<AgentDecision> {
    const { campaign } = context;
    
    const systemPrompt = `You are evaluating a conversation to determine if the lead has met the campaign goals.
Campaign Goals: ${campaign?.goals?.join(', ') || 'No specific goals'}
Required Goals: ${campaign?.qualificationCriteria?.requiredGoals?.join(', ') || 'None'}`;

    const prompt = `Evaluate this conversation history and determine if the lead is qualified:

Conversation History:
${JSON.stringify(conversationHistory, null, 2)}

Determine:
1. Which campaign goals have been met
2. Whether the lead is qualified for Boberdoo submission
3. What the next action should be

Respond in JSON format:
{
  "action": "continue_conversation|qualify_lead|send_to_boberdoo|archive",
  "reasoning": "Your reasoning here",
  "goalsMet": ["goal1", "goal2"],
  "qualified": true|false,
  "nextSteps": "Brief description"
}`;

    const response = await this.callOpenRouter(prompt, systemPrompt);
    
    try {
      const evaluation = JSON.parse(response);
      return {
        action: evaluation.action,
        reasoning: evaluation.reasoning,
        data: {
          goalsMet: evaluation.goalsMet,
          qualified: evaluation.qualified,
          nextSteps: evaluation.nextSteps
        }
      };
    } catch (error) {
      CCLLogger.agentError('overlord', 'conversation_evaluation', error as Error, { leadId: context.lead.id });
      return {
        action: 'continue_conversation',
        reasoning: 'Unable to evaluate, continuing conversation',
        data: { goalsMet: [], qualified: false }
      };
    }
  }

  async submitToBoberdoo(lead: Lead, testMode: boolean = false): Promise<BoberdooResponse> {
    try {
      // Record the submission attempt
      await AgentDecisionsRepository.create(
        lead.id,
        'overlord',
        'boberdoo_submission_attempt',
        `Attempting to submit lead to Boberdoo (test mode: ${testMode})`,
        { testMode }
      );
      // Check if this is a test lead
      const isTestLead = lead.metadata?.Test_Lead === '1' || lead.metadata?.zip === '99999' || testMode;
      
      const boberdooUrl = process.env.BOBERDOO_API_URL || 'https://api.boberdoo.com';
      const apiKey = process.env.BOBERDOO_API_KEY;
      
      // Prepare the lead data according to Boberdoo specs
      const leadData = {
        api_key: apiKey,
        src: lead.source,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        zip: lead.metadata?.zip || '',
        ...(isTestLead && { Test_Lead: '1' }),
        ...lead.metadata // Include any additional fields
      };

      const startTime = Date.now();
      CCLLogger.externalApiCall('boberdoo', '/leadPost', 'POST', { leadId: lead.id, isTestLead, leadName: lead.name });

      // Wrap Boberdoo API call with circuit breaker protection
      const { response, xmlText } = await executeWithBoberdooBreaker(async () => {
        const response = await fetch(`${boberdooUrl}/leadPost`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/xml'
          },
          body: new URLSearchParams(leadData as any).toString()
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        return { response, xmlText };
      });
      
      // Parse XML response (basic parsing for now)
      const matched = xmlText.includes('<status>matched</status>');
      const buyerIdMatch = xmlText.match(/<buyer_id>([^<]+)<\/buyer_id>/);
      const priceMatch = xmlText.match(/<price>([^<]+)<\/price>/);
      
      const result = {
        success: response.ok,
        matched: matched,
        buyerId: buyerIdMatch?.[1],
        price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
        message: xmlText
      };

      // Log the result
      CCLLogger.externalApiSuccess('boberdoo', '/leadPost', Date.now() - startTime, {
        leadId: lead.id,
        matched: result.matched,
        buyerId: result.buyerId,
        isTest: isTestLead
      });
      
      // Update lead status based on result
      if (result.matched && result.buyerId) {
        await LeadsRepository.updateStatus(lead.id, 'sent_to_boberdoo', result.buyerId);
        await AgentDecisionsRepository.create(
          lead.id,
          'overlord',
          'boberdoo_matched',
          `Lead matched to buyer ${result.buyerId} for ${result.price || 0}`,
          { buyerId: result.buyerId, price: result.price, isTest: isTestLead }
        );
      } else {
        await AgentDecisionsRepository.create(
          lead.id,
          'overlord',
          'boberdoo_no_match',
          'No matching buyer found in Boberdoo',
          { isTest: isTestLead }
        );
      }

      return result;
    } catch (error) {
      const duration = startTime ? Date.now() - startTime : 0;
      CCLLogger.externalApiError('boberdoo', '/leadPost', error as Error, duration, { leadId: lead.id });
      await AgentDecisionsRepository.create(
        lead.id,
        'overlord',
        'boberdoo_error',
        `Error submitting to Boberdoo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : error }
      );
      
      return {
        success: false,
        matched: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async evaluateForBoberdoo(lead: Lead, context: AgentContext): Promise<AgentDecision> {
    const { campaign } = context;
    
    // Check if lead meets minimum qualification score
    const minScore = campaign?.qualificationCriteria?.minScore || 50;
    const isQualified = (lead.qualificationScore || 0) >= minScore;
    
    // Check if it's a test lead
    const isTestLead = lead.metadata?.Test_Lead === '1' || lead.metadata?.zip === '99999';
    
    if (!isQualified && !isTestLead) {
      return {
        action: 'continue_conversation',
        reasoning: `Lead score (${lead.qualificationScore}) below minimum (${minScore})`,
        data: { qualified: false }
      };
    }

    // Submit to Boberdoo
    const boberdooResult = await this.submitToBoberdoo(lead, isTestLead);
    
    if (boberdooResult.matched) {
      return {
        action: 'lead_sold',
        reasoning: `Lead ${isTestLead ? 'TEST ' : ''}matched to buyer ${boberdooResult.buyerId} for $${boberdooResult.price || 0}`,
        data: {
          buyerId: boberdooResult.buyerId,
          price: boberdooResult.price,
          isTest: isTestLead
        }
      };
    } else {
      return {
        action: 'no_buyer_found',
        reasoning: 'No matching buyer found in Boberdoo',
        data: { 
          qualified: true,
          attemptedSubmission: true,
          isTest: isTestLead
        }
      };
    }
  }

  // Helper method to validate if lead is ready for Boberdoo
  isLeadReadyForBoberdoo(lead: Lead, campaign?: any): boolean {
    const requiredFields = campaign?.qualificationCriteria?.requiredFields || ['name', 'email', 'phone'];
    
    for (const field of requiredFields) {
      if (!lead[field as keyof Lead] && !lead.metadata?.[field]) {
        return false;
      }
    }
    
    return true;
  }
}