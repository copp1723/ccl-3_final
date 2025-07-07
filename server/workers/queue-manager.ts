// Queue manager for CCL-3 SWARM
// Handles worker registration, job scheduling, and queue monitoring

import { Job } from 'bullmq';
import { cclQueue, CCLJobType, CCLJobData } from '../utils/queue.js';
import { JOB_PROCESSORS } from './job-processors.js';
import { logger, CCLLogger } from '../utils/logger.js';
import { CCLCustomError, CCLErrorCode } from '../utils/error-handler.js';

export class CCLQueueManager {
  private isInitialized = false;
  private workers: string[] = [];

  constructor() {
    this.initializeWorkers();
  }

  // Initialize all queue workers
  private async initializeWorkers(): Promise<void> {
    if (!cclQueue.isReady()) {
      logger.warn('Queue system not ready, workers will not be initialized');
      return;
    }

    try {
      // Register critical queue worker
      cclQueue.registerWorker('critical', async (job: Job<CCLJobData>) => {
        return await this.processJob(job);
      });
      this.workers.push('critical');

      // Register standard queue worker
      cclQueue.registerWorker('standard', async (job: Job<CCLJobData>) => {
        return await this.processJob(job);
      });
      this.workers.push('standard');

      // Register background queue worker
      cclQueue.registerWorker('background', async (job: Job<CCLJobData>) => {
        return await this.processJob(job);
      });
      this.workers.push('background');

      this.isInitialized = true;
      logger.info('Queue workers initialized successfully', { 
        workerCount: this.workers.length 
      });

      // Schedule recurring maintenance jobs
      await this.scheduleMaintenanceJobs();

      CCLLogger.securityEvent('Queue manager initialized', 'low', {
        workerCount: this.workers.length,
        queues: this.workers
      });

    } catch (error) {
      logger.error('Failed to initialize queue workers', {
        error: (error as Error).message
      });
      throw new CCLCustomError(
        'Queue worker initialization failed',
        CCLErrorCode.SYSTEM_OVERLOAD,
        500,
        { error: (error as Error).message },
        false,
        false,
        'critical'
      );
    }
  }

  // Process individual job
  private async processJob(job: Job<CCLJobData>): Promise<any> {
    const { type } = job.data;
    const processor = JOB_PROCESSORS[type];

    if (!processor) {
      throw new CCLCustomError(
        `No processor found for job type: ${type}`,
        CCLErrorCode.INTERNAL_SERVER_ERROR,
        500,
        { jobType: type, jobId: job.id }
      );
    }

    logger.info('Processing job', {
      jobId: job.id,
      jobType: type,
      attempts: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts
    });

    try {
      const result = await processor(job);
      
      logger.info('Job completed successfully', {
        jobId: job.id,
        jobType: type,
        result: typeof result === 'object' ? Object.keys(result).length + ' keys' : result
      });

      return result;

    } catch (error) {
      logger.error('Job processing failed', {
        jobId: job.id,
        jobType: type,
        error: (error as Error).message,
        attempts: job.attemptsMade + 1
      });

      // Add context to error for better tracking
      if (error instanceof CCLCustomError) {
        error.context.jobId = job.id;
        error.context.jobType = type;
        error.context.attempts = job.attemptsMade + 1;
      }

      throw error;
    }
  }

  // Schedule recurring maintenance jobs
  private async scheduleMaintenanceJobs(): Promise<void> {
    try {
      // Daily cleanup job (runs at 2 AM)
      await cclQueue.scheduleRecurringJob(
        CCLJobType.CLEANUP_OLD_DATA,
        {
          type: CCLJobType.CLEANUP_OLD_DATA,
          payload: {
            cleanupCommunications: true,
            cleanupCache: true,
            cleanupSessions: true
          },
          metadata: {
            source: 'scheduled',
            recurring: true
          }
        },
        '0 2 * * *' // Daily at 2 AM
      );

      // Hourly analytics update
      await cclQueue.scheduleRecurringJob(
        CCLJobType.UPDATE_ANALYTICS,
        {
          type: CCLJobType.UPDATE_ANALYTICS,
          payload: {
            calculateLeadMetrics: true,
            updateCampaignStats: true,
            updateAgentPerformance: true
          },
          metadata: {
            source: 'scheduled',
            recurring: true
          }
        },
        '0 * * * *' // Hourly
      );

      // Weekly system health check
      await cclQueue.scheduleRecurringJob(
        CCLJobType.HEALTH_CHECK,
        {
          type: CCLJobType.HEALTH_CHECK,
          payload: {
            checkServices: true,
            checkDatabase: true,
            checkExternalAPIs: true
          },
          metadata: {
            source: 'scheduled',
            recurring: true
          }
        },
        '0 3 * * 0' // Weekly on Sunday at 3 AM
      );

      logger.info('Maintenance jobs scheduled successfully');

    } catch (error) {
      logger.error('Failed to schedule maintenance jobs', {
        error: (error as Error).message
      });
    }
  }

  // Add job to queue (convenience method)
  async addJob(jobType: CCLJobType, payload: any, options: any = {}): Promise<Job<CCLJobData> | null> {
    if (!this.isInitialized) {
      logger.warn('Queue manager not initialized, job will be skipped', { jobType });
      return null;
    }

    const jobData: CCLJobData = {
      type: jobType,
      payload,
      metadata: {
        source: 'queue_manager',
        timestamp: Date.now(),
        ...options.metadata
      }
    };

    return await cclQueue.addJob(jobType, jobData, options);
  }

  // Add lead processing job
  async addLeadProcessingJob(leadId: string, priority: 'high' | 'normal' = 'normal'): Promise<Job<CCLJobData> | null> {
    return await this.addJob(
      CCLJobType.PROCESS_LEAD,
      { leadId },
      {
        priority: priority === 'high' ? 1 : 10,
        metadata: {
          leadId,
          operation: 'lead_processing'
        }
      }
    );
  }

  // Add communication jobs
  async addEmailJob(to: string, subject: string, text: string, html?: string, leadId?: string): Promise<Job<CCLJobData> | null> {
    return await this.addJob(
      CCLJobType.SEND_EMAIL,
      { to, subject, text, html, leadId },
      {
        priority: 5, // High priority for communications
        metadata: {
          leadId,
          recipient: to,
          operation: 'send_email'
        }
      }
    );
  }

  async addSMSJob(to: string, body: string, leadId?: string): Promise<Job<CCLJobData> | null> {
    return await this.addJob(
      CCLJobType.SEND_SMS,
      { to, body, leadId },
      {
        priority: 5, // High priority for communications
        metadata: {
          leadId,
          recipient: to,
          operation: 'send_sms'
        }
      }
    );
  }

  // Add Boberdoo submission job
  async addBoberdooSubmissionJob(leadId: string, testMode: boolean = false): Promise<Job<CCLJobData> | null> {
    return await this.addJob(
      CCLJobType.BOBERDOO_SUBMISSION,
      { leadId, testMode },
      {
        priority: 1, // Critical priority for lead submissions
        attempts: 5, // More attempts for critical operations
        metadata: {
          leadId,
          operation: 'boberdoo_submission',
          testMode
        }
      }
    );
  }

  // Add campaign execution job
  async addCampaignJob(campaignId: string, options: any = {}): Promise<Job<CCLJobData> | null> {
    return await this.addJob(
      CCLJobType.CAMPAIGN_EXECUTION,
      { campaignId, ...options },
      {
        priority: 10, // Normal priority for campaigns
        metadata: {
          campaignId,
          operation: 'campaign_execution'
        }
      }
    );
  }

  // Add data export job
  async addDataExportJob(exportType: string, filters: any, userId: string): Promise<Job<CCLJobData> | null> {
    return await this.addJob(
      CCLJobType.DATA_EXPORT,
      { exportType, filters, userId },
      {
        priority: 15, // Low priority for exports
        metadata: {
          userId,
          operation: 'data_export',
          exportType
        }
      }
    );
  }

  // Get queue statistics
  async getQueueStatistics(): Promise<any> {
    if (!this.isInitialized) {
      return { error: 'Queue manager not initialized' };
    }

    try {
      const stats = await cclQueue.getQueueStats();
      const timestamp = new Date().toISOString();

      return {
        timestamp,
        initialized: this.isInitialized,
        workers: this.workers,
        queues: stats,
        summary: {
          totalJobs: Object.values(stats).reduce((sum: number, queue: any) => 
            sum + (queue.total || 0), 0),
          activeJobs: Object.values(stats).reduce((sum: number, queue: any) => 
            sum + (queue.active || 0), 0),
          waitingJobs: Object.values(stats).reduce((sum: number, queue: any) => 
            sum + (queue.waiting || 0), 0),
          failedJobs: Object.values(stats).reduce((sum: number, queue: any) => 
            sum + (queue.failed || 0), 0)
        }
      };

    } catch (error) {
      logger.error('Failed to get queue statistics', {
        error: (error as Error).message
      });
      return { error: (error as Error).message };
    }
  }

  // Pause/resume queues
  async pauseQueue(queueType: 'critical' | 'standard' | 'background'): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Queue manager not initialized');
    }

    await cclQueue.pauseQueue(queueType);
    
    CCLLogger.securityEvent('Queue paused by manager', 'medium', {
      queueType,
      timestamp: new Date().toISOString()
    });
  }

  async resumeQueue(queueType: 'critical' | 'standard' | 'background'): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Queue manager not initialized');
    }

    await cclQueue.resumeQueue(queueType);
    
    CCLLogger.securityEvent('Queue resumed by manager', 'medium', {
      queueType,
      timestamp: new Date().toISOString()
    });
  }

  // Clean up old jobs
  async cleanupOldJobs(queueType?: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Queue manager not initialized');
    }

    await cclQueue.cleanupJobs(queueType);
    
    logger.info('Old jobs cleaned up', { queueType: queueType || 'all' });
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<any> {
    try {
      // This would require implementing job tracking
      // For now, return basic information
      return {
        jobId,
        status: 'unknown',
        note: 'Job status tracking requires additional implementation'
      };
    } catch (error) {
      logger.error('Failed to get job status', {
        jobId,
        error: (error as Error).message
      });
      return { error: (error as Error).message };
    }
  }

  // Bulk operations
  async addBulkLeadProcessingJobs(leadIds: string[]): Promise<(Job<CCLJobData> | null)[]> {
    const jobs = [];
    
    for (const leadId of leadIds) {
      try {
        const job = await this.addLeadProcessingJob(leadId);
        jobs.push(job);
      } catch (error) {
        logger.error('Failed to add bulk lead processing job', {
          leadId,
          error: (error as Error).message
        });
        jobs.push(null);
      }
    }

    logger.info('Bulk lead processing jobs added', {
      total: leadIds.length,
      successful: jobs.filter(j => j !== null).length,
      failed: jobs.filter(j => j === null).length
    });

    return jobs;
  }

  // Health check
  isHealthy(): boolean {
    return this.isInitialized && cclQueue.isReady();
  }

  // Get worker information
  getWorkerInfo(): any {
    return {
      initialized: this.isInitialized,
      workers: this.workers,
      queueReady: cclQueue.isReady(),
      timestamp: new Date().toISOString()
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down queue manager');

    try {
      await cclQueue.shutdown();
      this.isInitialized = false;
      this.workers = [];
      
      logger.info('Queue manager shutdown complete');
      
    } catch (error) {
      logger.error('Error during queue manager shutdown', {
        error: (error as Error).message
      });
      throw error;
    }
  }
}

// Global queue manager instance
export const queueManager = new CCLQueueManager();

export default {
  CCLQueueManager,
  queueManager
};