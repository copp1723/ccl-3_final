import { Router } from 'express';
import { AgentConfigurationsRepository } from '../db';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const router = Router();

// Validation schemas
const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['overlord', 'email', 'sms', 'chat']),
  role: z.string().min(1).max(255),
  endGoal: z.string().min(1),
  instructions: z.object({
    dos: z.array(z.string()).min(1),
    donts: z.array(z.string()).min(1)
  }),
  domainExpertise: z.array(z.string()).optional(),
  personality: z.string().min(1),
  tone: z.string().min(1),
  responseLength: z.enum(['short', 'medium', 'long']).optional(),
  apiModel: z.string().optional(),
  temperature: z.number().min(0).max(100).optional(),
  maxTokens: z.number().min(50).max(4000).optional(),
  metadata: z.record(z.any()).optional()
});

const updateAgentSchema = createAgentSchema.partial().extend({
  active: z.boolean().optional()
});

// Get all agent configurations
router.get('/api/agent-configurations', async (req, res) => {
  try {
    const { type, active, search, personality, tone, limit, offset } = req.query;
    
    const agents = await AgentConfigurationsRepository.findAll({
      type: type as string,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      search: search as string,
      personality: personality as string,
      tone: tone as string
    });
    
    // Apply pagination if requested
    let paginatedAgents = agents;
    if (limit || offset) {
      const start = parseInt(offset as string) || 0;
      const end = start + (parseInt(limit as string) || agents.length);
      paginatedAgents = agents.slice(start, end);
    }
    
    res.json({
      agents: paginatedAgents,
      total: agents.length,
      offset: parseInt(offset as string) || 0,
      limit: parseInt(limit as string) || agents.length
    });
  } catch (error) {
    console.error('Error fetching agent configurations:', error);
    res.status(500).json({ error: 'Failed to fetch agent configurations' });
  }
});

// Get agents by type
router.get('/api/agent-configurations/type/:type', async (req, res) => {
  try {
    const validTypes = ['overlord', 'email', 'sms', 'chat'];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ error: 'Invalid agent type' });
    }
    
    const agents = await AgentConfigurationsRepository.findByType(
      req.params.type as 'overlord' | 'email' | 'sms' | 'chat'
    );
    
    res.json({ agents });
  } catch (error) {
    console.error('Error fetching agents by type:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get single agent configuration
router.get('/api/agent-configurations/:id', async (req, res) => {
  try {
    const agent = await AgentConfigurationsRepository.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent configuration not found' });
    }
    
    res.json({ agent });
  } catch (error) {
    console.error('Error fetching agent configuration:', error);
    res.status(500).json({ error: 'Failed to fetch agent configuration' });
  }
});

// Create agent configuration
router.post('/api/agent-configurations', async (req, res) => {
  try {
    // Validate request body
    const validationResult = createAgentSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationError.toString()
      });
    }
    
    const data = validationResult.data;
    
    // Check for duplicate name
    const existing = await AgentConfigurationsRepository.findByName(data.name);
    if (existing) {
      return res.status(409).json({ error: 'Agent configuration with this name already exists' });
    }
    
    const agent = await AgentConfigurationsRepository.create({
      ...data,
      active: true
    });
    
    res.status(201).json({ success: true, agent });
  } catch (error) {
    console.error('Error creating agent configuration:', error);
    res.status(500).json({ error: 'Failed to create agent configuration' });
  }
});

// Update agent configuration
router.put('/api/agent-configurations/:id', async (req, res) => {
  try {
    // Validate request body
    const validationResult = updateAgentSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationError.toString()
      });
    }
    
    // Check if agent exists
    const existing = await AgentConfigurationsRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Agent configuration not found' });
    }
    
    const data = validationResult.data;
    
    // Check for duplicate name if name is being changed
    if (data.name && data.name !== existing.name) {
      const duplicate = await AgentConfigurationsRepository.findByName(data.name);
      if (duplicate) {
        return res.status(409).json({ error: 'Agent configuration with this name already exists' });
      }
    }
    
    const agent = await AgentConfigurationsRepository.update(req.params.id, data);
    
    res.json({ success: true, agent });
  } catch (error) {
    console.error('Error updating agent configuration:', error);
    res.status(500).json({ error: 'Failed to update agent configuration' });
  }
});

// Toggle agent active status
router.patch('/api/agent-configurations/:id/toggle', async (req, res) => {
  try {
    const agent = await AgentConfigurationsRepository.toggleActive(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent configuration not found' });
    }
    
    res.json({
      success: true,
      agent,
      message: `Agent ${agent.active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling agent configuration:', error);
    res.status(500).json({ error: 'Failed to toggle agent configuration status' });
  }
});

// Delete agent configuration
router.delete('/api/agent-configurations/:id', async (req, res) => {
  try {
    const agent = await AgentConfigurationsRepository.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent configuration not found' });
    }
    
    // Check if agent has been used
    const performance = agent.performance as any;
    if (performance && performance.conversations > 0) {
      return res.status(409).json({
        error: 'Cannot delete agent configuration that has been used',
        details: `This agent has handled ${performance.conversations} conversations`
      });
    }
    
    const deleted = await AgentConfigurationsRepository.delete(req.params.id);
    
    res.json({
      success: true,
      message: 'Agent configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting agent configuration:', error);
    res.status(500).json({ error: 'Failed to delete agent configuration' });
  }
});

// Clone agent configuration
router.post('/api/agent-configurations/:id/clone', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'New agent name is required' });
    }
    
    // Check for duplicate name
    const existing = await AgentConfigurationsRepository.findByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Agent configuration with this name already exists' });
    }
    
    const cloned = await AgentConfigurationsRepository.clone(req.params.id, name);
    
    if (!cloned) {
      return res.status(404).json({ error: 'Agent configuration not found' });
    }
    
    res.status(201).json({
      success: true,
      agent: cloned,
      message: 'Agent configuration cloned successfully'
    });
  } catch (error) {
    console.error('Error cloning agent configuration:', error);
    res.status(500).json({ error: 'Failed to clone agent configuration' });
  }
});

// Get agent performance stats
router.get('/api/agent-configurations/:id/performance', async (req, res) => {
  try {
    const agent = await AgentConfigurationsRepository.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent configuration not found' });
    }
    
    res.json({
      performance: agent.performance,
      agentId: agent.id,
      agentName: agent.name,
      agentType: agent.type
    });
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    res.status(500).json({ error: 'Failed to fetch agent performance' });
  }
});

// Get top performing agents
router.get('/api/agent-configurations/top-performing', async (req, res) => {
  try {
    const { metric, limit } = req.query;
    const validMetrics = ['satisfactionScore', 'conversations', 'successfulOutcomes'];
    
    const selectedMetric = validMetrics.includes(metric as string)
      ? (metric as 'satisfactionScore' | 'conversations' | 'successfulOutcomes')
      : 'satisfactionScore';
    
    const agents = await AgentConfigurationsRepository.getTopPerforming(
      selectedMetric,
      limit ? parseInt(limit as string) : 10
    );
    
    res.json({
      agents,
      metric: selectedMetric
    });
  } catch (error) {
    console.error('Error fetching top performing agents:', error);
    res.status(500).json({ error: 'Failed to fetch top performing agents' });
  }
});

// Create default agents
router.post('/api/agent-configurations/create-defaults', async (req, res) => {
  try {
    const created = await AgentConfigurationsRepository.createDefaultAgents();
    
    res.json({
      success: true,
      message: `Created ${created.length} default agent configurations`,
      agents: created
    });
  } catch (error) {
    console.error('Error creating default agents:', error);
    res.status(500).json({ error: 'Failed to create default agents' });
  }
});

// Update agent performance (webhook endpoint)
router.post('/api/agent-configurations/:id/track', async (req, res) => {
  try {
    const { metric, value } = req.body;
    const validMetrics = ['conversations', 'successfulOutcomes', 'averageResponseTime'];
    
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({ error: 'Invalid metric' });
    }
    
    const agent = await AgentConfigurationsRepository.updatePerformance(
      req.params.id,
      metric as 'conversations' | 'successfulOutcomes' | 'averageResponseTime',
      value
    );
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent configuration not found' });
    }
    
    res.json({
      success: true,
      performance: agent.performance
    });
  } catch (error) {
    console.error('Error tracking agent performance:', error);
    res.status(500).json({ error: 'Failed to track agent performance' });
  }
});

// Generate prompt from agent configuration
router.post('/api/agent-configurations/:id/generate-prompt', async (req, res) => {
  try {
    const agent = await AgentConfigurationsRepository.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent configuration not found' });
    }
    
    const context = req.body.context || {};
    const prompt = AgentConfigurationsRepository.generatePromptFromConfig(agent, context);
    
    res.json({
      prompt,
      agentId: agent.id,
      agentName: agent.name,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens
    });
  } catch (error) {
    console.error('Error generating prompt:', error);
    res.status(500).json({ error: 'Failed to generate prompt' });
  }
});

// Get active agent by type
router.get('/api/agent-configurations/active/:type', async (req, res) => {
  try {
    const validTypes = ['overlord', 'email', 'sms', 'chat'];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ error: 'Invalid agent type' });
    }
    
    const agent = await AgentConfigurationsRepository.getActiveByType(
      req.params.type as 'overlord' | 'email' | 'sms' | 'chat'
    );
    
    if (!agent) {
      return res.status(404).json({ 
        error: `No active ${req.params.type} agent found`,
        message: 'Please configure and activate an agent of this type'
      });
    }
    
    res.json({ agent });
  } catch (error) {
    console.error('Error fetching active agent:', error);
    res.status(500).json({ error: 'Failed to fetch active agent' });
  }
});

export default router;