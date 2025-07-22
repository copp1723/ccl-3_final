// Queue monitoring and management routes for CCL-3
// Provides visibility into job processing, queue health, and management controls

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { queueManager } from '../workers/queue-manager.js';
import { cclQueue, CCLJobType } from '../utils/queue.js';
import { logger, CCLLogger } from '../utils/logger.js';
import { CCLResponseHelper, CCLCustomError, CCLErrorCode } from '../utils/error-handler.js';
import { cclApiRateLimit } from '../middleware/rate-limit.js';

const router = Router();

// Queue statistics endpoint (requires authentication)
router.get('/stats', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const stats = await queueManager.getQueueStatistics();
    
    CCLLogger.info('Queue statistics requested', {
      event: 'queue_stats_requested',
      stats,
      userId: req.user?.id,
      ip: req.ip
    });

    res.json(CCLResponseHelper.success(stats, 'Queue statistics retrieved'));
    
  } catch (error) {
    logger.error('Failed to get queue statistics', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Add job endpoint (admin only)
router.post('/jobs', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Admin privileges required for job management',
          CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
          403
        )
      ));
    }

    const { jobType, payload, options = {} } = req.body;

    if (!jobType || !Object.values(CCLJobType).includes(jobType)) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Valid job type is required',
          CCLErrorCode.INVALID_REQUEST,
          400,
          { availableTypes: Object.values(CCLJobType) }
        )
      ));
    }

    const job = await queueManager.addJob(jobType, payload, {
      ...options,
      metadata: {
        ...options.metadata,
        addedBy: req.user.id,
        addedAt: new Date().toISOString(),
        manual: true
      }
    });

    CCLLogger.info('Job manually added', {
      jobType,
      jobId: job?.id,
      userId: req.user.id,
      ip: req.ip,
      severity: 'medium'
    });

    res.json(CCLResponseHelper.success(
      { jobId: job?.id, jobType, status: job ? 'added' : 'skipped' },
      job ? 'Job added successfully' : 'Job was skipped (queue not ready)'
    ));
    
  } catch (error) {
    logger.error('Failed to add job', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Lead processing job endpoint
router.post('/jobs/lead-processing', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const { leadId, priority = 'normal' } = req.body;

    if (!leadId) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Lead ID is required',
          CCLErrorCode.LEAD_VALIDATION_ERROR,
          400
        )
      ));
    }

    const job = await queueManager.addLeadProcessingJob(leadId, priority);

    CCLLogger.leadProcessing(leadId, 'job_queued', {
      jobId: job?.id,
      priority,
      userId: req.user?.id
    });

    res.json(CCLResponseHelper.success(
      { jobId: job?.id, leadId, priority },
      'Lead processing job queued'
    ));
    
  } catch (error) {
    logger.error('Failed to queue lead processing job', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Bulk lead processing endpoint
router.post('/jobs/bulk-lead-processing', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const { leadIds } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Array of lead IDs is required',
          CCLErrorCode.LEAD_VALIDATION_ERROR,
          400
        )
      ));
    }

    if (leadIds.length > 100) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Maximum 100 leads can be processed in bulk',
          CCLErrorCode.LEAD_VALIDATION_ERROR,
          400
        )
      ));
    }

    const jobs = await queueManager.addBulkLeadProcessingJobs(leadIds);
    const successful = jobs.filter(j => j !== null).length;
    const failed = jobs.filter(j => j === null).length;

    CCLLogger.leadProcessing('bulk', 'bulk_jobs_queued', {
      total: leadIds.length,
      successful,
      failed,
      userId: req.user?.id
    });

    res.json(CCLResponseHelper.success(
      { total: leadIds.length, successful, failed },
      `Bulk lead processing jobs queued: ${successful} successful, ${failed} failed`
    ));
    
  } catch (error) {
    logger.error('Failed to queue bulk lead processing jobs', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Email job endpoint
router.post('/jobs/email', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const { to, subject, text, html, leadId } = req.body;

    if (!to || !subject || !text) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'To, subject, and text are required for email jobs',
          CCLErrorCode.INVALID_REQUEST,
          400
        )
      ));
    }

    const job = await queueManager.addEmailJob(to, subject, text, html, leadId);

    CCLLogger.info('Email communication queued', {
      channel: 'email',
      leadId: leadId || '',
      recipient: to,
      subject,
      jobId: job?.id,
      queued: true
    });

    res.json(CCLResponseHelper.success(
      { jobId: job?.id, to, subject },
      'Email job queued'
    ));
    
  } catch (error) {
    logger.error('Failed to queue email job', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// SMS job endpoint
router.post('/jobs/sms', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const { to, body, leadId } = req.body;

    if (!to || !body) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'To and body are required for SMS jobs',
          CCLErrorCode.INVALID_REQUEST,
          400
        )
      ));
    }

    const job = await queueManager.addSMSJob(to, body, leadId);

    CCLLogger.info('SMS communication queued', {
      channel: 'sms',
      leadId: leadId || '',
      recipient: to,
      jobId: job?.id,
      queued: true
    });

    res.json(CCLResponseHelper.success(
      { jobId: job?.id, to },
      'SMS job queued'
    ));
    
  } catch (error) {
    logger.error('Failed to queue SMS job', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Boberdoo submission job endpoint
router.post('/jobs/boberdoo', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const { leadId, testMode = false } = req.body;

    if (!leadId) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Lead ID is required for Boberdoo submission',
          CCLErrorCode.LEAD_VALIDATION_ERROR,
          400
        )
      ));
    }

    const job = await queueManager.addBoberdooSubmissionJob(leadId, testMode);

    CCLLogger.externalApiCall('boberdoo', '/leadPost', 'POST', {
      leadId,
      testMode,
      jobId: job?.id,
      queued: true
    });

    res.json(CCLResponseHelper.success(
      { jobId: job?.id, leadId, testMode },
      'Boberdoo submission job queued'
    ));
    
  } catch (error) {
    logger.error('Failed to queue Boberdoo submission job', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Campaign execution job endpoint
router.post('/jobs/campaign', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const { campaignId, options = {} } = req.body;

    if (!campaignId) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Campaign ID is required',
          CCLErrorCode.CAMPAIGN_VALIDATION_ERROR,
          400
        )
      ));
    }

    const job = await queueManager.addCampaignJob(campaignId, options);

    CCLLogger.campaignEvent(campaignId, 'job_queued', {
      jobId: job?.id,
      userId: req.user?.id
    });

    res.json(CCLResponseHelper.success(
      { jobId: job?.id, campaignId },
      'Campaign execution job queued'
    ));
    
  } catch (error) {
    logger.error('Failed to queue campaign job', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Data export job endpoint
router.post('/jobs/export', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const { exportType, filters = {} } = req.body;

    if (!exportType) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Export type is required',
          CCLErrorCode.INVALID_REQUEST,
          400
        )
      ));
    }

    const job = await queueManager.addDataExportJob(exportType, filters, req.user!.id);

    CCLLogger.info('Data export job queued', {
      event: 'data_export_job_queued',
      exportType,
      filters,
      jobId: job?.id,
      userId: req.user?.id
    });

    res.json(CCLResponseHelper.success(
      { jobId: job?.id, exportType },
      'Data export job queued'
    ));
    
  } catch (error) {
    logger.error('Failed to queue data export job', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Job status endpoint
router.get('/jobs/:jobId/status', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await queueManager.getJobStatus(jobId);

    res.json(CCLResponseHelper.success(status, 'Job status retrieved'));
    
  } catch (error) {
    logger.error('Failed to get job status', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Queue health endpoint
router.get('/health', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    const health = {
      healthy: queueManager.isHealthy(),
      workerInfo: queueManager.getWorkerInfo(),
      queueReady: cclQueue.isReady(),
      timestamp: new Date().toISOString()
    };

    const statusCode = health.healthy ? 200 : 503;
    res.status(statusCode).json(CCLResponseHelper.success(health, 'Queue health status'));
    
  } catch (error) {
    logger.error('Failed to get queue health', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Queue management endpoints (admin only)
router.post('/queues/:queueType/pause', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Admin privileges required for queue management',
          CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
          403
        )
      ));
    }

    const { queueType } = req.params;
    
    if (!['critical', 'standard', 'background'].includes(queueType)) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Invalid queue type',
          CCLErrorCode.INVALID_REQUEST,
          400,
          { validTypes: ['critical', 'standard', 'background'] }
        )
      ));
    }

    await queueManager.pauseQueue(queueType as any);

    CCLLogger.warn('Queue paused manually', {
      queueType,
      userId: req.user.id,
      ip: req.ip,
      severity: 'high'
    });

    res.json(CCLResponseHelper.success(
      { queueType, status: 'paused' },
      `Queue ${queueType} paused`
    ));
    
  } catch (error) {
    logger.error('Failed to pause queue', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

router.post('/queues/:queueType/resume', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Admin privileges required for queue management',
          CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
          403
        )
      ));
    }

    const { queueType } = req.params;
    
    if (!['critical', 'standard', 'background'].includes(queueType)) {
      return res.status(400).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Invalid queue type',
          CCLErrorCode.INVALID_REQUEST,
          400,
          { validTypes: ['critical', 'standard', 'background'] }
        )
      ));
    }

    await queueManager.resumeQueue(queueType as any);

    CCLLogger.info('Queue resumed manually', {
      queueType,
      userId: req.user.id,
      ip: req.ip,
      severity: 'medium'
    });

    res.json(CCLResponseHelper.success(
      { queueType, status: 'resumed' },
      `Queue ${queueType} resumed`
    ));
    
  } catch (error) {
    logger.error('Failed to resume queue', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

// Cleanup old jobs endpoint (admin only)
router.post('/cleanup', authenticate, cclApiRateLimit, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json(CCLResponseHelper.error(
        new CCLCustomError(
          'Admin privileges required for cleanup operations',
          CCLErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
          403
        )
      ));
    }

    const { queueType } = req.body;
    await queueManager.cleanupOldJobs(queueType);

    CCLLogger.info('Queue cleanup performed', {
      queueType: queueType || 'all',
      userId: req.user.id,
      ip: req.ip,
      severity: 'medium'
    });

    res.json(CCLResponseHelper.success(
      { queueType: queueType || 'all', status: 'cleaned' },
      'Old jobs cleaned up successfully'
    ));
    
  } catch (error) {
    logger.error('Failed to cleanup jobs', { error: (error as Error).message });
    res.status(500).json(CCLResponseHelper.error(error as Error));
  }
});

export default router;