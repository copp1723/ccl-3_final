import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// Test chat endpoint
router.post('/test', authenticate, async (req, res) => {
  try {
    const { agentId, message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // Mock chat agent response
    const responses = [
      "I understand you're interested in our car loan options. Let me help you with that.",
      "Thank you for your question. Based on your inquiry, I can provide you with some information.",
      "That's a great question! Let me walk you through the loan process.",
      "I'm here to help you find the best financing option for your needs.",
      "Let me check our current rates and options for you."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    res.json({
      success: true,
      response: randomResponse,
      agentId,
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Math.round(Math.random() * 1000 + 500),
        responseType: 'standard',
        sentiment: 'positive'
      }
    });
  } catch (error) {
    console.error('Error testing chat response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test chat response'
    });
  }
});

// Get chat agent capabilities
router.get('/capabilities/:agentId', authenticate, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const capabilities = {
      agentId,
      capabilities: [
        'lead_qualification',
        'loan_information',
        'rate_inquiry',
        'application_assistance',
        'general_support'
      ],
      languages: ['en', 'es'],
      maxResponseLength: 500,
      responseTimeTarget: 30,
      availableHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'America/New_York'
      }
    };
    
    res.json({
      success: true,
      capabilities
    });
  } catch (error) {
    console.error('Error fetching chat capabilities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat capabilities'
    });
  }
});

export default router; 