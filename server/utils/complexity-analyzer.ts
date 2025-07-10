/**
 * Complexity Analyzer - Determines optimal model based on request complexity
 */

export interface ComplexityFactors {
  promptLength: number;        // Length of the prompt in characters
  decisionType: string;        // Type of decision: 'routing', 'generation', 'analysis', 'strategy'
  jsonSchemaDepth: number;     // Complexity of expected JSON output
  conversationDepth: number;   // Number of conversation turns
  agentType: string;          // Agent making the request
  requiresReasoning: boolean;  // Needs step-by-step thinking
  multiStep: boolean;         // Multi-step process
  businessCritical: boolean;  // High-stakes decision
  hasMemoryContext: boolean;  // Uses historical context
}

export interface ComplexityResult {
  score: number;              // 0-100 complexity score
  reasoning: string;          // Why this score was assigned
  recommendedModel: string;   // Suggested model
  fallbackModel: string;     // Backup option
  tier: 'simple' | 'medium' | 'complex';
}

export class ComplexityAnalyzer {
  private static readonly MODEL_TIERS = {
    simple: {
      primary: 'openai/gpt-4o-mini',
      fallback: 'openai/gpt-4o',
      threshold: 30
    },
    medium: {
      primary: 'openai/gpt-4o',
      fallback: 'openai/gpt-4o-mini',
      threshold: 70
    },
    complex: {
      primary: 'anthropic/claude-3-5-sonnet-20241022',
      fallback: 'openai/gpt-4o',
      threshold: 100
    }
  };

  private static readonly AGENT_COMPLEXITY_MODIFIERS = {
    overlord: 15,    // Strategic decisions need more power
    email: -5,       // Content generation is simpler
    sms: -10,        // SMS is shorter, simpler
    chat: 0,         // Neutral baseline
    default: 0
  };

  private static readonly DECISION_TYPE_WEIGHTS = {
    routing: 20,        // Simple decision tree
    generation: 25,     // Content creation
    analysis: 45,       // Requires understanding
    strategy: 65,       // Complex reasoning
    evaluation: 55,     // Assessment and judgment
    conversation: 35,   // Dynamic interaction
    qualification: 40,  // Lead assessment
    default: 30
  };

  static analyze(factors: Partial<ComplexityFactors>): ComplexityResult {
    let score = 0;
    const reasons: string[] = [];

    // Base complexity from prompt length
    const promptLength = factors.promptLength || 0;
    const lengthScore = Math.min(Math.floor(promptLength / 100), 25);
    score += lengthScore;
    if (lengthScore > 15) {
      reasons.push(`Long prompt (${promptLength} chars)`);
    }

    // Decision type complexity
    const decisionType = factors.decisionType || 'default';
    const decisionWeight = this.DECISION_TYPE_WEIGHTS[decisionType as keyof typeof this.DECISION_TYPE_WEIGHTS] || 
                          this.DECISION_TYPE_WEIGHTS.default;
    score += decisionWeight;
    if (decisionWeight > 40) {
      reasons.push(`Complex decision type: ${decisionType}`);
    }

    // JSON schema complexity
    const schemaDepth = factors.jsonSchemaDepth || 1;
    const schemaScore = Math.min(schemaDepth * 8, 20);
    score += schemaScore;
    if (schemaDepth > 2) {
      reasons.push(`Complex JSON schema (depth: ${schemaDepth})`);
    }

    // Conversation depth
    const conversationDepth = factors.conversationDepth || 0;
    const conversationScore = Math.min(conversationDepth * 3, 15);
    score += conversationScore;
    if (conversationDepth > 3) {
      reasons.push(`Extended conversation (${conversationDepth} turns)`);
    }

    // Reasoning requirements
    if (factors.requiresReasoning) {
      score += 20;
      reasons.push('Requires step-by-step reasoning');
    }

    // Multi-step processes
    if (factors.multiStep) {
      score += 15;
      reasons.push('Multi-step process');
    }

    // Business critical decisions
    if (factors.businessCritical) {
      score += 25;
      reasons.push('Business-critical decision');
    }

    // Memory context usage
    if (factors.hasMemoryContext) {
      score += 10;
      reasons.push('Uses historical context');
    }

    // Agent type modifier
    const agentType = factors.agentType || 'default';
    const agentModifier = this.AGENT_COMPLEXITY_MODIFIERS[agentType as keyof typeof this.AGENT_COMPLEXITY_MODIFIERS] || 
                         this.AGENT_COMPLEXITY_MODIFIERS.default;
    score += agentModifier;
    if (agentModifier !== 0) {
      reasons.push(`Agent type modifier: ${agentType} (${agentModifier > 0 ? '+' : ''}${agentModifier})`);
    }

    // Determine tier and model
    let tier: 'simple' | 'medium' | 'complex';
    let recommendedModel: string;
    let fallbackModel: string;

    if (score < this.MODEL_TIERS.simple.threshold) {
      tier = 'simple';
      recommendedModel = this.MODEL_TIERS.simple.primary;
      fallbackModel = this.MODEL_TIERS.simple.fallback;
    } else if (score < this.MODEL_TIERS.medium.threshold) {
      tier = 'medium';
      recommendedModel = this.MODEL_TIERS.medium.primary;
      fallbackModel = this.MODEL_TIERS.medium.fallback;
    } else {
      tier = 'complex';
      recommendedModel = this.MODEL_TIERS.complex.primary;
      fallbackModel = this.MODEL_TIERS.complex.fallback;
    }

    // Check for environment variable overrides
    const envOverride = process.env[`${agentType.toUpperCase()}_MODEL`];
    if (envOverride) {
      recommendedModel = envOverride;
      reasons.push(`Override: Using ${envOverride} from environment`);
    }

    const reasoning = reasons.length > 0 
      ? `Score: ${score} - ${reasons.join(', ')}`
      : `Score: ${score} - Standard complexity analysis`;

    return {
      score: Math.min(Math.max(score, 0), 100), // Clamp between 0-100
      reasoning,
      recommendedModel,
      fallbackModel,
      tier
    };
  }

  /**
   * Quick analysis for simple routing decisions
   */
  static quickAnalyze(agentType: string, decisionType: string, promptLength: number = 0): ComplexityResult {
    return this.analyze({
      agentType,
      decisionType,
      promptLength,
      jsonSchemaDepth: 1,
      conversationDepth: 0,
      requiresReasoning: false,
      multiStep: false,
      businessCritical: false,
      hasMemoryContext: false
    });
  }

  /**
   * Analysis for conversation-based interactions
   */
  static conversationAnalyze(
    agentType: string, 
    conversationHistory: any[] = [], 
    hasComplexContext: boolean = false
  ): ComplexityResult {
    return this.analyze({
      agentType,
      decisionType: 'conversation',
      promptLength: JSON.stringify(conversationHistory).length,
      jsonSchemaDepth: 1,
      conversationDepth: conversationHistory.length,
      requiresReasoning: hasComplexContext,
      multiStep: conversationHistory.length > 2,
      businessCritical: false,
      hasMemoryContext: conversationHistory.length > 0
    });
  }

  /**
   * Analysis for strategic decisions (Overlord agent)
   */
  static strategicAnalyze(
    lead: any, 
    campaign: any, 
    hasHistory: boolean = false
  ): ComplexityResult {
    const contextSize = JSON.stringify({ lead, campaign }).length;
    // Check if campaign has complex configuration
    const hasComplexCriteria = campaign?.qualificationCriteria || campaign?.goals?.length > 2;
    
    return this.analyze({
      agentType: 'overlord',
      decisionType: 'strategy',
      promptLength: contextSize,
      jsonSchemaDepth: 3, // Complex decision JSON output
      conversationDepth: hasHistory ? 1 : 0,
      requiresReasoning: true,
      multiStep: true,
      businessCritical: true,
      hasMemoryContext: hasHistory
    });
  }
}