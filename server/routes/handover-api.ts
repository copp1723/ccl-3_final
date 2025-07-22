import { Router } from 'express';
import { logger } from '../utils/logger';
import { LeadHandoverExecutor } from '../services/lead-handover-executor';
import { HandoverService } from '../services/handover-service';
import { queueManager } from '../workers/queue-manager';

const router = Router();

/**
 * Execute lead handover
 */
router.post('/execute', async (req, res) => {
  try {
    const { leadId, campaignId, reason } = req.body;

    if (!leadId || !campaignId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: leadId, campaignId, reason'
      });
    }

    // Queue the handover for background processing
    const jobId = await queueManager.addHandoverJob(leadId, campaignId, reason, 'high');

    res.json({
      success: true,
      message: 'Handover queued for execution',
      jobId
    });

  } catch (error) {
    logger.error('Handover execution API error', {
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to execute handover',
      details: (error as Error).message
    });
  }
});

/**
 * Get handover status for a lead
 */
router.get('/status/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const status = await LeadHandoverExecutor.getHandoverStatus(leadId);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Handover status API error', {
      leadId: req.params.leadId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to get handover status',
      details: (error as Error).message
    });
  }
});

/**
 * Evaluate if a lead should be handed over
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { conversationId, newMessage } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        error: 'Missing required field: conversationId'
      });
    }

    const evaluation = await HandoverService.evaluateHandover(conversationId, newMessage);

    res.json({
      success: true,
      data: evaluation
    });

  } catch (error) {
    logger.error('Handover evaluation API error', {
      conversationId: req.body.conversationId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to evaluate handover',
      details: (error as Error).message
    });
  }
});

/**
 * Execute handover with evaluation
 */
router.post('/execute-with-evaluation', async (req, res) => {
  try {
    const { conversationId, reason, humanAgentId } = req.body;

    if (!conversationId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: conversationId, reason'
      });
    }

    const success = await HandoverService.executeHandover(conversationId, reason, humanAgentId);

    res.json({
      success,
      message: success ? 'Handover executed successfully' : 'Handover execution failed'
    });

  } catch (error) {
    logger.error('Handover execution with evaluation API error', {
      conversationId: req.body.conversationId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to execute handover',
      details: (error as Error).message
    });
  }
});

/**
 * Get cross-channel context for a lead
 */
router.get('/context/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const context = await HandoverService.getCrossChannelContext(leadId);

    res.json({
      success: true,
      data: context
    });

  } catch (error) {
    logger.error('Cross-channel context API error', {
      leadId: req.params.leadId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to get cross-channel context',
      details: (error as Error).message
    });
  }
});

/**
 * Webhook endpoint for external handover confirmations
 */
router.post('/webhook/confirmation', async (req, res) => {
  try {
    const { leadId, destinationId, status, externalId, error } = req.body;

    logger.info('Received handover confirmation webhook', {
      leadId,
      destinationId,
      status,
      externalId
    });

    // Update handover execution record
    // This would require a database update to track handover confirmations

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    logger.error('Handover webhook error', {
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to process webhook',
      details: (error as Error).message
    });
  }
});

export default router;