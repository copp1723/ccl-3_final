import { Router } from 'express';
import { AgentDecisionsRepository } from '../db';

const router = Router();

// Get all decisions for a lead
router.get('/api/decisions/lead/:leadId', async (req, res) => {
  try {
    const decisions = await AgentDecisionsRepository.findByLeadId(req.params.leadId);
    res.json({ decisions });
  } catch (error) {
    console.error('Error fetching decisions:', error);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

// Get decision timeline for a lead
router.get('/api/decisions/lead/:leadId/timeline', async (req, res) => {
  try {
    const timeline = await AgentDecisionsRepository.getDecisionTimeline(req.params.leadId);
    res.json({ timeline });
  } catch (error) {
    console.error('Error fetching decision timeline:', error);
    res.status(500).json({ error: 'Failed to fetch decision timeline' });
  }
});

// Get decisions by agent type
router.get('/api/decisions/agent/:agentType', async (req, res) => {
  try {
    const decisions = await AgentDecisionsRepository.findByAgentType(req.params.agentType as any);
    res.json({ decisions });
  } catch (error) {
    console.error('Error fetching agent decisions:', error);
    res.status(500).json({ error: 'Failed to fetch agent decisions' });
  }
});

// Get decision statistics
router.get('/api/decisions/stats', async (req, res) => {
  try {
    const stats = await AgentDecisionsRepository.getDecisionStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching decision stats:', error);
    res.status(500).json({ error: 'Failed to fetch decision stats' });
  }
});

// Get recent decisions
router.get('/api/decisions/recent', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const decisions = await AgentDecisionsRepository.getRecentDecisions(limit);
    res.json({ decisions });
  } catch (error) {
    console.error('Error fetching recent decisions:', error);
    res.status(500).json({ error: 'Failed to fetch recent decisions' });
  }
});

// Create a new decision (typically called by agents)
router.post('/api/decisions', async (req, res) => {
  try {
    const { leadId, agentType, decision, reasoning, context } = req.body;
    
    if (!leadId || !agentType || !decision) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const decisionRecord = await AgentDecisionsRepository.create(
      leadId,
      agentType,
      decision,
      reasoning,
      context
    );
    
    res.json({ success: true, decision: decisionRecord });
  } catch (error) {
    console.error('Error creating decision:', error);
    res.status(500).json({ error: 'Failed to create decision' });
  }
});

export default router;
