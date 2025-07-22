import { Router } from 'express';
import { logger } from '../utils/logger';
import { campaignExecutionEngine } from '../services/campaign-execution-engine';
import { emailReplyDetector } from '../services/email-reply-detector';
import { queueManager } from '../workers/queue-manager';

const router = Router();

/**
 * Schedule an email campaign for a lead
 */
router.post('/schedule', async (req, res) => {
  try {
    const { campaignId, leadId, templateId, scheduledFor } = req.body;

    if (!campaignId || !leadId || !templateId || !scheduledFor) {
      return res.status(400).json({
        error: 'Missing required fields: campaignId, leadId, templateId, scheduledFor'
      });
    }

    const executionId = await campaignExecutionEngine.scheduleEmailCampaign(
      campaignId,
      leadId,
      templateId,
      new Date(scheduledFor)
    );

    res.json({
      success: true,
      executionId,
      message: 'Email campaign scheduled successfully'
    });

  } catch (error) {
    logger.error('Email scheduling API error', {
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to schedule email campaign',
      details: (error as Error).message
    });
  }
});

/**
 * Get execution status
 */
router.get('/execution/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    const execution = campaignExecutionEngine.getExecutionStatus(executionId);

    if (!execution) {
      return res.status(404).json({
        error: 'Execution not found'
      });
    }

    res.json({
      success: true,
      data: execution
    });

  } catch (error) {
    logger.error('Execution status API error', {
      executionId: req.params.executionId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to get execution status',
      details: (error as Error).message
    });
  }
});

/**
 * Get all executions for a campaign
 */
router.get('/campaign/:campaignId/executions', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const executions = campaignExecutionEngine.getCampaignExecutions(campaignId);

    res.json({
      success: true,
      data: executions
    });

  } catch (error) {
    logger.error('Campaign executions API error', {
      campaignId: req.params.campaignId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to get campaign executions',
      details: (error as Error).message
    });
  }
});

/**
 * Cancel a scheduled execution
 */
router.delete('/execution/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    const cancelled = campaignExecutionEngine.cancelExecution(executionId);

    if (!cancelled) {
      return res.status(404).json({
        error: 'Execution not found or cannot be cancelled'
      });
    }

    res.json({
      success: true,
      message: 'Execution cancelled successfully'
    });

  } catch (error) {
    logger.error('Cancel execution API error', {
      executionId: req.params.executionId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to cancel execution',
      details: (error as Error).message
    });
  }
});

/**
 * Get all schedules
 */
router.get('/schedules', async (req, res) => {
  try {
    const executions = campaignExecutionEngine.getAllExecutions();
    
    res.json({
      success: true,
      data: executions
    });
    
  } catch (error) {
    logger.error('Get schedules API error', {
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to get schedules',
      details: (error as Error).message
    });
  }
});

/**
 * Check if a lead has replied
 */
router.get('/lead/:leadId/replied', async (req, res) => {
  try {
    const { leadId } = req.params;
    const hasReplied = await emailReplyDetector.hasLeadReplied(leadId);

    res.json({
      success: true,
      data: {
        leadId,
        hasReplied
      }
    });

  } catch (error) {
    logger.error('Lead reply check API error', {
      leadId: req.params.leadId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to check lead reply status',
      details: (error as Error).message
    });
  }
});

/**
 * Get latest reply from a lead
 */
router.get('/lead/:leadId/latest-reply', async (req, res) => {
  try {
    const { leadId } = req.params;
    const reply = await emailReplyDetector.getLatestReply(leadId);

    res.json({
      success: true,
      data: reply
    });

  } catch (error) {
    logger.error('Latest reply API error', {
      leadId: req.params.leadId,
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to get latest reply',
      details: (error as Error).message
    });
  }
});

/**
 * Send immediate email (bypass scheduling)
 */
router.post('/send-immediate', async (req, res) => {
  try {
    const { to, subject, html, text, leadId, campaignId, templateId } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, html'
      });
    }

    const jobId = await queueManager.addEmailJob({
      to,
      subject,
      html,
      text,
      leadId,
      campaignId,
      templateId
    }, 'high');

    res.json({
      success: true,
      jobId,
      message: 'Email queued for immediate sending'
    });

  } catch (error) {
    logger.error('Immediate email send API error', {
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to send immediate email',
      details: (error as Error).message
    });
  }
});

/**
 * Webhook endpoint for email replies (Mailgun)
 */
router.post('/webhook/reply', async (req, res) => {
  try {
    const { sender, recipient, subject, 'body-plain': content, 'Message-Id': messageId } = req.body;

    if (!sender || !subject) {
      return res.status(400).json({
        error: 'Invalid webhook payload'
      });
    }

    await emailReplyDetector.processReply({
      messageId: messageId || '',
      from: sender,
      to: recipient || '',
      subject,
      content: content || '',
      timestamp: new Date()
    });

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Email reply webhook error', {
      error: (error as Error).message
    });
    res.status(500).send('Error');
  }
});

/**
 * Get queue status
 */
router.get('/queue/status', async (req, res) => {
  try {
    const statuses = queueManager.getAllQueueStatuses();

    res.json({
      success: true,
      data: statuses
    });

  } catch (error) {
    logger.error('Queue status API error', {
      error: (error as Error).message
    });
    res.status(500).json({
      error: 'Failed to get queue status',
      details: (error as Error).message
    });
  }
});

export default router;