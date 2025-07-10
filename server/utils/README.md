# Complexity-Based Model Selection System

This system intelligently routes requests to the optimal AI model based on the complexity of the task, optimizing both cost and performance.

## Overview

The system automatically analyzes incoming requests and routes them to one of three model tiers:

- **Simple (0-30 complexity)**: `openai/gpt-4o-mini` - Fast and cost-effective
- **Medium (30-70 complexity)**: `openai/gpt-4o` - Balanced performance  
- **Complex (70-100 complexity)**: `anthropic/claude-3-5-sonnet-20241022` - Advanced reasoning

## How It Works

### Complexity Analysis

The `ComplexityAnalyzer` evaluates requests based on:

1. **Prompt Length** - Longer prompts often require more sophisticated processing
2. **Decision Type** - Strategic decisions vs simple content generation
3. **JSON Schema Depth** - Complex output structures need more advanced models
4. **Conversation Depth** - Extended conversations require better context understanding
5. **Agent Type** - Different agents have different complexity baselines
6. **Reasoning Requirements** - Step-by-step thinking vs direct responses
7. **Business Critical** - High-stakes decisions get more powerful models

### Model Routing

The `ModelRouter` handles:

- Automatic model selection based on complexity score
- Fallback handling if primary model fails
- Performance metrics tracking
- Cost optimization
- Error recovery

## Configuration

### Environment Variables

```bash
# Model tiers
SIMPLE_MODEL=openai/gpt-4o-mini
MEDIUM_MODEL=openai/gpt-4o  
COMPLEX_MODEL=anthropic/claude-3-5-sonnet-20241022
FALLBACK_MODEL=openai/gpt-4o

# Complexity thresholds by agent type
OVERLORD_COMPLEXITY_THRESHOLD=40
EMAIL_AGENT_COMPLEXITY_THRESHOLD=25
SMS_AGENT_COMPLEXITY_THRESHOLD=20
CHAT_AGENT_COMPLEXITY_THRESHOLD=35

# Override specific agents to always use certain models
OVERLORD_MODEL=anthropic/claude-3-5-sonnet-20241022
EMAIL_AGENT_MODEL=openai/gpt-4o
```

### Agent-Specific Behavior

**Overlord Agent**:
- Strategic decisions → Claude 3.5 Sonnet
- Simple routing → GPT-4o
- Campaign evaluation → Claude 3.5 Sonnet

**Email/SMS Agents**:
- Content generation → GPT-4o
- Complex personalization → Claude 3.5 Sonnet

**Chat Agent**:
- Quick responses → GPT-4o
- Deep conversation analysis → Claude 3.5 Sonnet

## Usage Examples

### Basic Usage (Automatic)

```typescript
// The system automatically selects the optimal model
const response = await this.callOpenRouter(prompt, systemPrompt);
```

### Advanced Usage (With Context)

```typescript
const response = await this.callOpenRouter(prompt, systemPrompt, {
  decisionType: 'strategy',
  businessCritical: true,
  requiresReasoning: true,
  responseFormat: { type: 'json_object' },
  temperature: 0.3
});
```

### Direct Model Router Usage

```typescript
import { ModelRouter } from '../utils/model-router';

const response = await ModelRouter.routeRequest({
  prompt: userPrompt,
  systemPrompt,
  agentType: 'overlord',
  decisionType: 'strategy',
  businessCritical: true,
  requiresReasoning: true,
  maxTokens: 500,
  temperature: 0.7
});
```

## Decision Types

- `routing` (20 points) - Simple decision tree logic
- `generation` (25 points) - Content creation tasks
- `analysis` (45 points) - Understanding and interpretation
- `strategy` (65 points) - Complex multi-step reasoning
- `evaluation` (55 points) - Assessment and judgment
- `conversation` (35 points) - Dynamic interaction handling
- `qualification` (40 points) - Lead assessment

## Monitoring

### Performance Metrics

The system tracks:
- Total requests per model
- Success rates
- Average response times
- Cost per model
- Complexity distribution

### Access Metrics

```typescript
import { ModelRouter } from '../utils/model-router';

// Get performance summary
const summary = ModelRouter.getPerformanceSummary();
console.log('Total cost:', summary.totalCost);
console.log('Model breakdown:', summary.modelBreakdown);

// Get detailed metrics
const metrics = ModelRouter.getPerformanceMetrics();
```

## Benefits

✅ **Cost Optimization** - Use expensive models only when needed  
✅ **Performance Optimization** - Right model for the right task  
✅ **Quality Improvement** - Complex reasoning with Claude, speed with GPT-4o  
✅ **Automatic Scaling** - No manual model selection required  
✅ **Fallback Protection** - Graceful degradation if models fail  
✅ **Monitoring** - Track performance and costs

## Complexity Scoring Examples

| Task | Complexity Score | Selected Model | Reasoning |
|------|-----------------|----------------|-----------|
| Simple email reply | 25 | GPT-4o Mini | Basic generation |
| Lead routing decision | 45 | GPT-4o | Medium complexity routing |
| Campaign strategy | 75 | Claude 3.5 Sonnet | Complex multi-step reasoning |
| JSON parsing error | 35 | GPT-4o | Medium complexity analysis |
| Multi-turn conversation | 55 | GPT-4o | Context-aware responses |

## Troubleshooting

### All Models Failing
- Check `OPENROUTER_API_KEY` is set correctly
- Verify network connectivity
- Check OpenRouter account credits

### Unexpected Model Selection
- Review complexity factors in logs
- Adjust agent-specific thresholds
- Use model overrides for testing

### High Costs
- Monitor complexity distribution
- Adjust thresholds to use simpler models more often
- Use model overrides to force cheaper models

## API Reference

### ComplexityAnalyzer

```typescript
static analyze(factors: Partial<ComplexityFactors>): ComplexityResult
static quickAnalyze(agentType: string, decisionType: string, promptLength?: number): ComplexityResult
static conversationAnalyze(agentType: string, conversationHistory?: any[], hasComplexContext?: boolean): ComplexityResult
static strategicAnalyze(lead: any, campaign: any, hasHistory?: boolean): ComplexityResult
```

### ModelRouter

```typescript
static async routeRequest(options: ModelRequestOptions): Promise<ModelResponse>
static selectModel(agentType: string, decisionType?: string, promptLength?: number): string
static getPerformanceMetrics(): ModelPerformanceMetrics[]
static getPerformanceSummary(): PerformanceSummary
static clearMetrics(): void