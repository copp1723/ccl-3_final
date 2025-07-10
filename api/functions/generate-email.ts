// Serverless function for email generation
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ModelRouter } from '../../server/utils/model-router';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { lead, template, focus } = req.body;
    
    // Generate email using Model Router for intelligent model selection
    const systemPrompt = `You are an email agent for Complete Car Loans. Generate a personalized email for auto loan leads.
Focus: ${focus || 'general inquiry'}
Be friendly, professional, and helpful.`;

    const userPrompt = `Generate an email for this lead:
Name: ${lead.name}
Email: ${lead.email}
Source: ${lead.source || 'website'}
Campaign: ${lead.campaign || 'general'}

Template: ${template || 'initial_contact'}`;

    const response = await ModelRouter.routeRequest({
      prompt: userPrompt,
      systemPrompt,
      agentType: 'email',
      decisionType: 'generation',
      maxTokens: 500,
      temperature: 0.7
    });
    
    const emailContent = response.content;
    
    // Return generated content
    res.status(200).json({
      success: true,
      content: emailContent,
      model: response.model,
      complexity: response.complexity,
      usage: response.usage,
    });
    
  } catch (error) {
    console.error('Email generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate email',
      details: error.message 
    });
  }
}