import { Router } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { campaignExecutionEngine } from '../services/campaign-execution-engine';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const triggerCampaignSchema = z.object({
  campaignId: z.string().min(1),
  leadIds: z.array(z.string()).min(1),
  templateSequence: z.array(z.string()).optional()
});

const autoAssignSchema = z.object({
  force: z.boolean().optional()
});

// Trigger campaign execution
router.post('/trigger', async (req, res) => {
  try {
    const validationResult = triggerCampaignSchema.safeParse(req.body);

    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationError.toString()
      });
    }

    const { campaignId, leadIds, templateSequence } = validationResult.data;

    await campaignExecutionEngine.triggerCampaign(campaignId, leadIds, templateSequence);

    res.json({
      success: true,
      message: `Campaign triggered for ${leadIds.length} leads`,
      data: {
        campaignId,
        leadCount: leadIds.length,
        templateCount: templateSequence?.length || 'default'
      }
    });

  } catch (error) {
    logger.error('Failed to trigger campaign:', { error: (error as Error).message });
    res.status(500).json({
      error: 'Failed to trigger campaign',
      details: (error as Error).message
    });
  }
});

// Auto-assign leads to campaigns
router.post('/auto-assign', async (req, res) => {
  try {
    const validationResult = autoAssignSchema.safeParse(req.body);

    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        error: 'Validation failed',
        details: validationError.toString()
      });
    }

    await campaignExecutionEngine.autoAssignLeads();

    res.json({
      success: true,
      message: 'Auto-assignment completed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to auto-assign leads:', { error: (error as Error).message });
    res.status(500).json({
      error: 'Failed to auto-assign leads',
      details: (error as Error).message
    });
  }
});

// Get execution statistics
router.get('/stats/:campaignId?', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const stats = await campaignExecutionEngine.getExecutionStats(campaignId);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get execution stats:', { error: (error as Error).message });
    res.status(500).json({
      error: 'Failed to get execution statistics',
      details: (error as Error).message
    });
  }
});

// Cancel executions
router.post('/cancel', async (req, res) => {
  try {
    const { campaignId, leadId } = req.body;

    if (!campaignId && !leadId) {
      return res.status(400).json({
        error: 'Either campaignId or leadId must be provided'
      });
    }

    const cancelledCount = await campaignExecutionEngine.cancelExecutions(campaignId, leadId);

    res.json({
      success: true,
      message: `Cancelled ${cancelledCount} executions`,
      data: {
        cancelledCount,
        campaignId,
        leadId
      }
    });

  } catch (error) {
    logger.error('Failed to cancel executions:', { error: (error as Error).message });
    res.status(500).json({
      error: 'Failed to cancel executions',
      details: (error as Error).message
    });
  }
});

// Start/stop engine
router.post('/engine/:action', async (req, res) => {
  try {
    const { action } = req.params;

    if (action === 'start') {
      await campaignExecutionEngine.start();
      res.json({
        success: true,
        message: 'Campaign execution engine started'
      });
    } else if (action === 'stop') {
      await campaignExecutionEngine.stop();
      res.json({
        success: true,
        message: 'Campaign execution engine stopped'
      });
    } else {
      res.status(400).json({
        error: 'Invalid action. Use "start" or "stop"'
      });
    }

  } catch (error) {
    logger.error('Failed to control engine:', { error: (error as Error).message });
    res.status(500).json({
      error: 'Failed to control campaign execution engine',
      details: (error as Error).message
    });
  }
});

// Health check for the execution engine
router.get('/health', async (req, res) => {
  try {
    const stats = await campaignExecutionEngine.getExecutionStats();
    
    res.json({
      success: true,
      status: 'healthy',
      data: {
        totalExecutions: stats.total,
        activeExecutions: stats.executing + stats.scheduled,
        completedExecutions: stats.completed,
        failedExecutions: stats.failed
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Engine health check failed:', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: (error as Error).message
    });
  }
});

export default router;