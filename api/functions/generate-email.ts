// Serverless function for email generation
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialize OpenRouter client
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

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
    
    // Generate email using OpenRouter
    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an email agent for Complete Car Loans. Generate a personalized email for auto loan leads.
Focus: ${focus || 'general inquiry'}
Be friendly, professional, and helpful.`
        },
        {
          role: 'user',
          content: `Generate an email for this lead:
Name: ${lead.name}
Email: ${lead.email}
Source: ${lead.source || 'website'}
Campaign: ${lead.campaign || 'general'}

Template: ${template || 'initial_contact'}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    
    const emailContent = completion.choices[0]?.message?.content || '';
    
    // Return generated content
    res.status(200).json({
      success: true,
      content: emailContent,
      usage: completion.usage,
    });
    
  } catch (error) {
    console.error('Email generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate email',
      details: error.message 
    });
  }
}