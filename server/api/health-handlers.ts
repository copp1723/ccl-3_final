import { Request, Response } from 'express';

export const healthHandler = {
  check: (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      service: 'ccl3-swarm',
      timestamp: new Date().toISOString()
    });
  }
};