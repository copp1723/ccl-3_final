/**
 * Model Router - Handles intelligent model selection and request routing
 */

import { logger } from './logger';
import { ComplexityAnalyzer, ComplexityFactors, ComplexityResult } from './complexity-analyzer';

export interface ModelRequestOptions {
  prompt: string;
  systemPrompt: string;
  agentType: string;
  decisionType?: string;
  conversationHistory?: any[];
  requiresReasoning?: boolean;
  businessCritical?: boolean;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
}

export interface ModelResponse {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model: string;
  complexity: ComplexityResult;
  executionTime: number;
}

export interface ModelPerformanceMetrics {
  model: string;
  tier: string;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  totalCost: number;
  lastUsed: Date;
}

export class ModelRouter {
  private static performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private static readonly COST_PER_1K_TOKENS = {
    'openai/gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'openai/gpt-4o': { input: 0.0025, output: 0.01 },
    'anthropic/claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 }
  };

  /**
   * Route a request to the optimal model based on complexity analysis
   */
  static async routeRequest(options: ModelRequestOptions): Promise<ModelResponse> {
    const startTime = Date.now();
    
    // Analyze complexity
    const complexity = this.analyzeComplexity(options);
    
    logger.info(
      `Model selection for ${options.agentType}`,
      {
        complexity: complexity.score,
        tier: complexity.tier,
        selectedModel: complexity.recommendedModel,
        reasoning: complexity.reasoning
      }
    );

    let response: ModelResponse;
    
    try {
      // Try primary model
      response = await this.executeRequest(options, complexity.recommendedModel, complexity);
    } catch (error) {
      logger.error(
        `Primary model failed for ${options.agentType}`,
        {
          error: error as Error,
          model: complexity.recommendedModel
        }
      );
      
      // Fallback to secondary model
      try {
        response = await this.executeRequest(options, complexity.fallbackModel, complexity);
        logger.info(
          `Fallback model used for ${options.agentType}`,
          { fallbackModel: complexity.fallbackModel }
        );
      } catch (fallbackError) {
        logger.error(
          `All models failed for ${options.agentType}`,
          {
            error: fallbackError as Error,
            primaryModel: complexity.recommendedModel,
            fallbackModel: complexity.fallbackModel
          }
        );
        throw fallbackError;
      }
    }

    const executionTime = Date.now() - startTime;
    response.executionTime = executionTime;

    // Update performance metrics
    this.updatePerformanceMetrics(response.model, complexity.tier, executionTime, response.usage);

    return response;
  }

  /**
   * Analyze request complexity
   */
  private static analyzeComplexity(options: ModelRequestOptions): ComplexityResult {
    const factors: Partial<ComplexityFactors> = {
      agentType: options.agentType,
      decisionType: options.decisionType || 'default',
      promptLength: options.prompt.length + options.systemPrompt.length,
      conversationDepth: options.conversationHistory?.length || 0,
      requiresReasoning: options.requiresReasoning || false,
      businessCritical: options.businessCritical || false,
      hasMemoryContext: (options.conversationHistory?.length || 0) > 0,
      multiStep: options.decisionType === 'strategy' || options.decisionType === 'evaluation',
      jsonSchemaDepth: options.responseFormat?.type === 'json_object' ? 2 : 1
    };

    return ComplexityAnalyzer.analyze(factors);
  }

  /**
   * Execute request with specific model
   */
  private static async executeRequest(
    options: ModelRequestOptions,
    model: string,
    complexity: ComplexityResult
  ): Promise<ModelResponse> {
    if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === '') {
      // Return mock response for testing
      return {
        content: this.getMockResponse(options.prompt, options.agentType),
        model,
        complexity,
        executionTime: 0
      };
    }

    const requestBody: any = {
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 500
    };

    if (options.responseFormat) {
      requestBody.response_format = options.responseFormat;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ccl3.com',
        'X-Title': 'CCL3 SWARM'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage,
      model,
      complexity,
      executionTime: 0 // Will be set by caller
    };
  }

  /**
   * Update performance metrics for a model
   */
  private static updatePerformanceMetrics(
    model: string,
    tier: string,
    executionTime: number,
    usage?: any
  ): void {
    const existing = this.performanceMetrics.get(model) || {
      model,
      tier,
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      totalCost: 0,
      lastUsed: new Date()
    };

    existing.totalRequests++;
    existing.successfulRequests++;
    existing.averageResponseTime = (
      (existing.averageResponseTime * (existing.successfulRequests - 1)) + executionTime
    ) / existing.successfulRequests;
    existing.lastUsed = new Date();

    // Calculate cost if usage data is available
    if (usage && this.COST_PER_1K_TOKENS[model as keyof typeof this.COST_PER_1K_TOKENS]) {
      const costs = this.COST_PER_1K_TOKENS[model as keyof typeof this.COST_PER_1K_TOKENS];
      const inputCost = (usage.prompt_tokens || 0) / 1000 * costs.input;
      const outputCost = (usage.completion_tokens || 0) / 1000 * costs.output;
      existing.totalCost += inputCost + outputCost;
    }

    this.performanceMetrics.set(model, existing);
  }

  /**
   * Get performance metrics for all models
   */
  static getPerformanceMetrics(): ModelPerformanceMetrics[] {
    return Array.from(this.performanceMetrics.values());
  }

  /**
   * Get performance summary
   */
  static getPerformanceSummary(): {
    totalRequests: number;
    totalCost: number;
    modelBreakdown: { [key: string]: { requests: number; cost: number; avgTime: number } };
  } {
    const metrics = this.getPerformanceMetrics();
    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);
    
    const modelBreakdown: { [key: string]: { requests: number; cost: number; avgTime: number } } = {};
    metrics.forEach(m => {
      modelBreakdown[m.model] = {
        requests: m.totalRequests,
        cost: m.totalCost,
        avgTime: m.averageResponseTime
      };
    });

    return { totalRequests, totalCost, modelBreakdown };
  }

  /**
   * Clear performance metrics (for testing)
   */
  static clearMetrics(): void {
    this.performanceMetrics.clear();
  }

  /**
   * Mock response generator for testing
   */
  private static getMockResponse(prompt: string, agentType: string): string {
    const responseTemplates = {
      overlord: '{"action": "assign_channel", "channels": ["email"], "reasoning": "Mock overlord decision", "initialMessageFocus": "Initial contact"}',
      email: 'Mock email response generated for testing purposes.',
      sms: 'Mock SMS response for testing.',
      chat: 'Mock chat response from agent.',
      default: `Mock response from ${agentType} agent for: ${prompt.substring(0, 50)}...`
    };

    return responseTemplates[agentType as keyof typeof responseTemplates] || responseTemplates.default;
  }

  /**
   * Utility method for quick model selection without full routing
   */
  static selectModel(agentType: string, decisionType: string = 'default', promptLength: number = 0): string {
    const complexity = ComplexityAnalyzer.quickAnalyze(agentType, decisionType, promptLength);
    return complexity.recommendedModel;
  }

  /**
   * Check if a model is available (has API key and is in our supported list)
   */
  static isModelAvailable(_model: string): boolean {
    return !!(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== '');
  }
}