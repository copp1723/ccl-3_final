import { Lead, Campaign } from '../db/schema';
import { CCLLogger } from '../utils/logger.js';
import { executeWithOpenRouterBreaker } from '../utils/circuit-breaker.js';

export interface AgentContext {
  lead: Lead;
  campaign?: Campaign;
  conversationHistory?: any[];
}

export interface AgentDecision {
  action: string;
  reasoning: string;
  data?: any;
}

export abstract class BaseAgent {
  protected agentType: string;
  
  constructor(agentType: string) {
    this.agentType = agentType;
  }

  abstract processMessage(message: string, context: AgentContext): Promise<string>;
  abstract makeDecision(context: AgentContext): Promise<AgentDecision>;

  protected async callOpenRouter(prompt: string, systemPrompt: string): Promise<string> {
    try {
      // Check if API key is available
      if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === '') {
        CCLLogger.agentAction(this.agentType as any, 'openrouter_fallback', { reason: 'No API key found, using mock responses' });
        return this.getMockResponse(prompt);
      }

      // Wrap OpenRouter API call with circuit breaker protection
      const response = await executeWithOpenRouterBreaker(async () => {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ccl3.com',
            'X-Title': 'CCL3 SWARM'
          },
          body: JSON.stringify({
            model: process.env[`${this.agentType.toUpperCase()}_MODEL`] || 'openai/gpt-3.5-turbo',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      CCLLogger.agentError(this.agentType as any, 'openrouter_call', error as Error, { prompt: prompt.substring(0, 100) });
      // Fallback to mock response if API fails
      return this.getMockResponse(prompt);
    }
  }

  // Mock response generator for testing without API
  protected getMockResponse(prompt: string): string {
    // Default mock response - override in specific agents
    return `Mock response from ${this.agentType} agent for: ${prompt.substring(0, 50)}...`;
  }
}