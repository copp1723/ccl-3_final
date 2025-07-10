// Serverless function for lead processing decisions
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ModelRouter } from '../../server/utils/model-router';

interface LeadDecision {
  action: 'assign_channel' | 'send_to_boberdoo' | 'require_info' | 'reject';
  channel?: 'email' | 'sms' | 'chat';
  reasoning: string;
  confidence: number;
  nextSteps: string[];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { lead, campaign } = req.body;
    
    // Make routing decision using Model Router for intelligent model selection
    const systemPrompt = `You are the Overlord Agent for Complete Car Loans. Analyze leads and make routing decisions.
          
Available actions:
- assign_channel: Route to email, sms, or chat
- send_to_boberdoo: Qualified lead ready for lenders
- require_info: Need more information
- reject: Not a valid lead

Consider:
- Lead completeness (email, phone, name)
- Lead source and campaign
- Qualification score
- Time of day and urgency`;

    const userPrompt = `Analyze this lead and make a routing decision:
${JSON.stringify(lead, null, 2)}

Campaign: ${campaign ? JSON.stringify(campaign, null, 2) : 'None'}

Respond in JSON format with: action, channel (if assign_channel), reasoning, confidence (0-100), nextSteps[]`;

    const response = await ModelRouter.routeRequest({
      prompt: userPrompt,
      systemPrompt,
      agentType: 'overlord',
      decisionType: 'strategy',
      businessCritical: true,
      requiresReasoning: true,
      responseFormat: { type: "json_object" },
      maxTokens: 300,
      temperature: 0.3
    });
    
    const decision = JSON.parse(response.content || '{}') as LeadDecision;
    
    // Validate decision
    if (!decision.action) {
      throw new Error('Invalid decision format');
    }
    
    res.status(200).json({
      success: true,
      decision,
      model: response.model,
      complexity: response.complexity,
      usage: response.usage,
    });
    
  } catch (error) {
    console.error('Lead processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process lead',
      details: error.message 
    });
  }
}