import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// Mock data for campaign intelligence
const mockInsights = [
  {
    id: '1',
    type: 'pattern',
    title: 'High Response Rate on Tuesdays',
    description: 'Email campaigns sent on Tuesdays show 23% higher open rates',
    impact: 'high',
    confidence: 0.85,
    recommendation: 'Schedule more campaigns for Tuesday sends',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    type: 'optimization',
    title: 'Subject Line Performance',
    description: 'Subject lines with questions perform 15% better',
    impact: 'medium',
    confidence: 0.78,
    recommendation: 'A/B test more question-based subject lines',
    createdAt: new Date().toISOString()
  }
];

const mockAgentMemories = [
  {
    id: '1',
    agentId: 'email-agent-1',
    agentName: 'Email Agent',
    memory: 'Leads from automotive industry respond better to technical language',
    confidence: 0.82,
    usageCount: 15,
    lastUsed: new Date().toISOString()
  },
  {
    id: '2',
    agentId: 'overlord-agent-1',
    agentName: 'Overlord Agent',
    memory: 'Friday afternoon sends have lower engagement rates',
    confidence: 0.91,
    usageCount: 23,
    lastUsed: new Date().toISOString()
  }
];

// Get AI insights
router.get('/insights', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      insights: mockInsights,
      total: mockInsights.length
    });
  } catch (error) {
    console.error('Error fetching campaign insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign insights'
    });
  }
});

// Get agent memories
router.get('/agent-memories', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      memories: mockAgentMemories,
      total: mockAgentMemories.length
    });
  } catch (error) {
    console.error('Error fetching agent memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent memories'
    });
  }
});

// Create new insight
router.post('/insights', authenticate, async (req, res) => {
  try {
    const { type, title, description, impact, confidence, recommendation } = req.body;
    
    const newInsight = {
      id: Date.now().toString(),
      type,
      title,
      description,
      impact,
      confidence,
      recommendation,
      createdAt: new Date().toISOString()
    };
    
    mockInsights.push(newInsight);
    
    res.status(201).json({
      success: true,
      insight: newInsight
    });
  } catch (error) {
    console.error('Error creating insight:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create insight'
    });
  }
});

// Get campaign analytics
router.get('/analytics/:campaignId', authenticate, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // Mock analytics data
    const analytics = {
      campaignId,
      totalLeads: 150,
      emailsSent: 450,
      opensCount: 180,
      clicksCount: 45,
      repliesCount: 12,
      conversionsCount: 8,
      openRate: 0.4,
      clickRate: 0.25,
      replyRate: 0.067,
      conversionRate: 0.053,
      topPerformingTemplates: [
        { templateId: '1', name: 'Welcome Series', openRate: 0.45 },
        { templateId: '2', name: 'Follow-up', openRate: 0.38 }
      ],
      engagement: {
        byDay: Array.from({ length: 7 }, (_, i) => ({
          day: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
          opens: Math.floor(Math.random() * 30) + 10,
          clicks: Math.floor(Math.random() * 15) + 5
        }))
      }
    };
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign analytics'
    });
  }
});

export default router; 