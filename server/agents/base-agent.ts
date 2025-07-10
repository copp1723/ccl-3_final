import { Lead, Campaign } from '../db/schema';
import { logger } from '../utils/logger';
import { executeWithOpenRouterBreaker } from '../utils/circuit-breaker';
import { superMemory } from '../services/supermemory';
import { ModelRouter, ModelRequestOptions } from '../utils/model-router';

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

  protected async storeMemory(content: string, metadata?: Record<string, any>): Promise<void> {
    await superMemory.addMemory({
      content,
      metadata: {
        agentType: this.agentType,
        timestamp: new Date().toISOString(),
        ...metadata
      },
      spaces: [this.agentType]
    });
  }

  protected async searchMemory(query: string, limit: number = 5): Promise<any[]> {
    return await superMemory.searchMemories(query, limit);
  }

  abstract processMessage(message: string, context: AgentContext): Promise<string>;
  abstract makeDecision(context: AgentContext): Promise<AgentDecision>;

  protected async callOpenRouter(
    prompt: string,
    systemPrompt: string,
    options: Partial<ModelRequestOptions> = {}
  ): Promise<string> {
    try {
      // Check if API key is available
      if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === '') {
        logger.info(`No OpenRouter API key found for ${this.agentType}, using mock responses`);
        return this.getMockResponse(prompt);
      }

      // Prepare request options for model router
      const requestOptions: ModelRequestOptions = {
        prompt,
        systemPrompt,
        agentType: this.agentType,
        decisionType: options.decisionType || 'default',
        conversationHistory: options.conversationHistory || [],
        requiresReasoning: options.requiresReasoning || false,
        businessCritical: options.businessCritical || false,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 500,
        responseFormat: options.responseFormat
      };

      // Use model router for intelligent model selection
      const response = await ModelRouter.routeRequest(requestOptions);
      
      logger.info(`OpenRouter call successful for ${this.agentType}`, {
        model: response.model,
        complexity: response.complexity.score,
        tier: response.complexity.tier,
        executionTime: response.executionTime
      });

      return response.content;
    } catch (error) {
      logger.error(`OpenRouter call failed for ${this.agentType}`, {
        error: error as Error,
        prompt: prompt.substring(0, 100)
      });
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