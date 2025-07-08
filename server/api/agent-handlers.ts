import { Request, Response } from 'express';

export const agentHandler = {
  getAgents: async (req: Request, res: Response) => {
    // Return available agents
    res.json({
      agents: [
        { id: 'overlord', name: 'Overlord Agent', status: 'active', role: 'orchestrator' },
        { id: 'email', name: 'Email Agent', status: 'active', role: 'email_communication' },
        { id: 'sms', name: 'SMS Agent', status: 'active', role: 'sms_communication' },
        { id: 'chat', name: 'Chat Agent', status: 'active', role: 'website_chat' }
      ]
    });
  }
};