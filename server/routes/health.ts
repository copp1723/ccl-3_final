import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

// Simple health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Simple status endpoint
router.get('/status', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'ccl-3',
    version: '1.0.0'
  });
});

export default router;
