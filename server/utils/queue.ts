// ARCHIVED: Previous BullMQ/Redis queue system for CCL-3. Replaced with simple in-memory queue.

/*
  Lean, Redis-free in-memory queue.
  - Handles job objects with .type and .payload.
  - No priorities, just FIFO processing.
  - Supports basic retries per job (maxRetries, default=1).
  - Direct function call routing: function must exist globally with the same name as job.type.
  - Usage example:
    simpleQueue.addJob({ type: "sendEmail", payload: {...}, maxRetries: 2 });
  Replace job handler logic as needed.
*/

/*
// Enhanced BullMQ queue system for CCL-3 SWARM
// Based on foundation's queue system with CCL-3 specific enhancements

import { Queue, Worker, Job, QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';
import { redisClient } from './redis';
import { logger, CCLLogger } from './logger';
import { CCLCustomError, CCLErrorCode } from './error-handler';

// CCL-3 specific job types
export enum CCLJobType {
  // Lead processing jobs
  PROCESS_LEAD = 'process_lead',
  LEAD_ENRICHMENT = 'lead_enrichment',
  LEAD_SCORING = 'lead_scoring',
  LEAD_ROUTING = 'lead_routing',
  LEAD_VALIDATION = 'lead_validation',
  
  // Agent jobs
  AGENT_DECISION = 'agent_decision',
  AGENT_FOLLOWUP = 'agent_followup',
  AGENT_TRAINING = 'agent_training',
  
  // Communication jobs
  SEND_EMAIL = 'send_email',
  SEND_SMS = 'send_sms',
  SEND_CHAT_MESSAGE = 'send_chat_message',
  EMAIL_CAMPAIGN = 'email_campaign',
  
  // External service jobs
  BOBERDOO_SUBMISSION = 'boberdoo_submission',
  WEBHOOK_DELIVERY = 'webhook_delivery',
  API_SYNC = 'api_sync',
  
  // Analytics and reporting
  GENERATE_REPORT = 'generate_report',
  UPDATE_ANALYTICS = 'update_analytics',
  DATA_EXPORT = 'data_export',
  
  // System maintenance
  CLEANUP_OLD_DATA = 'cleanup_old_data',
  BACKUP_DATA = 'backup_data',
  HEALTH_CHECK = 'health_check',
  
  // Campaign jobs
  CAMPAIGN_EXECUTION = 'campaign_execution',
  CAMPAIGN_SCHEDULING = 'campaign_scheduling',
  CAMPAIGN_ANALYSIS = 'campaign_analysis'
}

// Job priority levels for CCL-3
export enum CCLJobPriority {
  CRITICAL = 1,    // Lead processing, critical communications
  HIGH = 5,        // Agent decisions, important communications
  NORMAL = 10,     // Regular processing, campaigns
  LOW = 15,        // Analytics, reports
  BACKGROUND = 20  // Cleanup, maintenance
}

// Enhanced job data interface
export interface CCLJobData {
  type: CCLJobType;
  payload: any;
  metadata?: {
    leadId?: string;
    userId?: string;
    campaignId?: string;
    agentType?: string;
    requestId?: string;
    source?: string;
    timestamp?: number;
    retryCount?: number;
    maxRetries?: number;
    [key: string]: any;
  };
}

// Queue configuration for different job types
const QUEUE_CONFIGS: Record<string, Partial<QueueOptions>> = {
  critical: {
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  },
  standard: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 50,
      removeOnFail: 25,
    },
  },
  background: {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
      removeOnComplete: 20,
      removeOnFail: 10,
    },
  },
};

// Worker configuration for different job types
const WORKER_CONFIGS: Record<string, Partial<WorkerOptions>> = {
  critical: {
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
  standard: {
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 1000,
    },
  },
  background: {
    concurrency: 2,
    limiter: {
      max: 2,
      duration: 1000,
    },
  },
};

// Enhanced queue class for CCL-3
export class CCLQueue {
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private isInitialized = false;

  constructor() {
    this.initializeQueues();
  }

  private initializeQueues(): void {
    if (!redisClient) {
      logger.warn('Redis not available, queue system will not function');
      return;
    }

    try {
      // Create queues for different priority levels
      const queueTypes = ['critical', 'standard', 'background'];
      
      queueTypes.forEach(type => {
        const queue = new Queue(`ccl3:${type}`, {
          connection: redisClient,
          ...QUEUE_CONFIGS[type],
        });

        // Queue event listeners
        queue.on('error', (error) => {
          logger.error(`Queue ${type} error`, { error: error.message });
          CCLLogger.securityEvent(`Queue error: ${type}`, 'medium', {
            queueType: type,
            error: error.message
          });
        });

        queue.on('waiting', (job) => {
          logger.debug(`Job ${job.id} waiting in ${type} queue`);
        });

        queue.on('active', (job) => {
          logger.debug(`Job ${job.id} active in ${type} queue`);
          CCLLogger.performance(`queue_${type}_job_started`, Date.now(), {
            jobId: job.id,
            jobType: job.name
          });
        });

        queue.on('completed', (job) => {
          const duration = Date.now() - job.processedOn!;
          logger.info(`Job ${job.id} completed in ${type} queue`, { duration });
          CCLLogger.performance(`queue_${type}_job_completed`, duration, {
            jobId: job.id,
            jobType: job.name
          });
        });

        queue.on('failed', (job, error) => {
          logger.error(`Job ${job?.id} failed in ${type} queue`, {
            error: error.message,
            attempts: job?.attemptsMade,
            maxAttempts: job?.opts.attempts
          });
          CCLLogger.securityEvent(`Job failed: ${type}`, 'medium', {
            jobId: job?.id,
            jobType: job?.name,
            error: error.message,
            attempts: job?.attemptsMade
          });
        });

        this.queues.set(type, queue);
      });

      this.isInitialized = true;
      logger.info('CCL-3 queue system initialized');
      CCLLogger.securityEvent('Queue system initialized', 'low', {
        queueCount: this.queues.size
      });

    } catch (error) {
      logger.error('Failed to initialize queue system', { error: (error as Error).message });
      throw new CCLCustomError(
        'Queue system initialization failed',
        CCLErrorCode.SYSTEM_OVERLOAD,
        500,
        { error: (error as Error).message },
        false,
        false,
        'critical'
      );
    }
  }

  // Add job to appropriate queue based on priority
  async addJob(
    jobType: CCLJobType,
    data: CCLJobData,
    options: JobsOptions = {}
  ): Promise<Job<CCLJobData> | null> {
    if (!this.isInitialized) {
      logger.warn('Queue system not initialized, job will be skipped', { jobType });
      return null;
    }

    try {
      // Determine queue based on job type
      const queueType = this.getQueueTypeForJob(jobType);
      const queue = this.queues.get(queueType);

      if (!queue) {
        throw new Error(`Queue ${queueType} not found`);
      }

      // Enhanced job options
      const jobOptions: JobsOptions = {
        priority: this.getPriorityForJob(jobType),
        delay: options.delay || 0,
        attempts: options.attempts || QUEUE_CONFIGS[queueType]?.defaultJobOptions?.attempts || 3,
        backoff: options.backoff || QUEUE_CONFIGS[queueType]?.defaultJobOptions?.backoff,
        removeOnComplete: options.removeOnComplete !== undefined ? options.removeOnComplete : 
          QUEUE_CONFIGS[queueType]?.defaultJobOptions?.removeOnComplete,
        removeOnFail: options.removeOnFail !== undefined ? options.removeOnFail :
          QUEUE_CONFIGS[queueType]?.defaultJobOptions?.removeOnFail,
        ...options,
      };

      // Add metadata
      const enhancedData: CCLJobData = {
        ...data,
        metadata: {
          ...data.metadata,
          timestamp: Date.now(),
          queueType,
          retryCount: 0,
        },
      };

      const job = await queue.add(jobType, enhancedData, jobOptions);

      logger.info('Job added to queue', {
        jobId: job.id,
        jobType,
        queueType,
        priority: jobOptions.priority
      });

      return job;

    } catch (error) {
      logger.error('Failed to add job to queue', {
        jobType,
        error: (error as Error).message
      });
      throw new CCLCustomError(
        `Failed to add ${jobType} job to queue`,
        CCLErrorCode.SYSTEM_OVERLOAD,
        500,
        { jobType, error: (error as Error).message },
        true,
        true,
        'high'
      );
    }
  }

  // Schedule recurring job
  async scheduleRecurringJob(
    jobType: CCLJobType,
    data: CCLJobData,
    pattern: string, // Cron pattern
    options: JobsOptions = {}
  ): Promise<void> {
    try {
      const queueType = this.getQueueTypeForJob(jobType);
      const queue = this.queues.get(queueType);

      if (!queue) {
        throw new Error(`Queue ${queueType} not found`);
      }

      await queue.add(jobType, data, {
        repeat: { pattern },
        ...options,
      });

      logger.info('Recurring job scheduled', { jobType, pattern, queueType });
      CCLLogger.securityEvent('Recurring job scheduled', 'low', {
        jobType,
        pattern,
        queueType
      });

    } catch (error) {
      logger.error('Failed to schedule recurring job', {
        jobType,
        pattern,
        error: (error as Error).message
      });
      throw error;
    }
  }

  // Register worker for processing jobs
  registerWorker(
    queueType: 'critical' | 'standard' | 'background',
    processor: (job: Job<CCLJobData>) => Promise<any>
  ): void {
    if (!this.isInitialized) {
      logger.warn('Cannot register worker, queue system not initialized');
      return;
    }

    try {
      const worker = new Worker(
        `ccl3:${queueType}`,
        async (job: Job<CCLJobData>) => {
          const startTime = Date.now();
          
          try {
            logger.info('Processing job', {
              jobId: job.id,
              jobType: job.name,
              queueType,
              attempts: job.attemptsMade + 1
            });

            const result = await processor(job);
            
            const duration = Date.now() - startTime;
            logger.info('Job processed successfully', {
              jobId: job.id,
              jobType: job.name,
              duration
            });

            return result;

          } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Job processing failed', {
              jobId: job.id,
              jobType: job.name,
              duration,
              attempts: job.attemptsMade + 1,
              error: (error as Error).message
            });

            // Update retry count in metadata
            if (job.data.metadata) {
              job.data.metadata.retryCount = (job.data.metadata.retryCount || 0) + 1;
            }

            throw error;
          }
        },
        {
          connection: redisClient,
          ...WORKER_CONFIGS[queueType],
        }
      );

      // Worker event listeners
      worker.on('error', (error) => {
        logger.error(`Worker ${queueType} error`, { error: error.message });
      });

      worker.on('failed', (job, error) => {
        CCLLogger.securityEvent('Job processing failed', 'medium', {
          jobId: job?.id,
          jobType: job?.name,
          queueType,
          error: error.message,
          attempts: job?.attemptsMade
        });
      });

      this.workers.set(queueType, worker);
      logger.info(`Worker registered for ${queueType} queue`);

    } catch (error) {
      logger.error(`Failed to register worker for ${queueType}`, {
        error: (error as Error).message
      });
      throw error;
    }
  }

  // Get queue statistics
  async getQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [queueType, queue] of this.queues) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed(),
        ]);

        stats[queueType] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          total: waiting.length + active.length + completed.length + failed.length + delayed.length,
        };
      } catch (error) {
        logger.error(`Failed to get stats for ${queueType} queue`, {
          error: (error as Error).message
        });
        stats[queueType] = { error: (error as Error).message };
      }
    }

    return stats;
  }

  // Clean up old jobs
  async cleanupJobs(queueType?: string): Promise<void> {
    const queuesToClean = queueType ? [queueType] : Array.from(this.queues.keys());

    for (const type of queuesToClean) {
      const queue = this.queues.get(type);
      if (queue) {
        try {
          await queue.clean(24 * 60 * 60 * 1000, 100, 'completed'); // Clean completed jobs older than 24h
          await queue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'); // Clean failed jobs older than 7 days
          logger.info(`Cleaned up old jobs in ${type} queue`);
        } catch (error) {
          logger.error(`Failed to cleanup ${type} queue`, {
            error: (error as Error).message
          });
        }
      }
    }
  }

  // Pause/resume queue
  async pauseQueue(queueType: string): Promise<void> {
    const queue = this.queues.get(queueType);
    if (queue) {
      await queue.pause();
      logger.info(`Queue ${queueType} paused`);
      CCLLogger.securityEvent('Queue paused', 'medium', { queueType });
    }
  }

  async resumeQueue(queueType: string): Promise<void> {
    const queue = this.queues.get(queueType);
    if (queue) {
      await queue.resume();
      logger.info(`Queue ${queueType} resumed`);
      CCLLogger.securityEvent('Queue resumed', 'medium', { queueType });
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down queue system');

    // Close all workers first
    for (const [type, worker] of this.workers) {
      try {
        await worker.close();
        logger.info(`Worker ${type} closed`);
      } catch (error) {
        logger.error(`Failed to close worker ${type}`, {
          error: (error as Error).message
        });
      }
    }

    // Close all queues
    for (const [type, queue] of this.queues) {
      try {
        await queue.close();
        logger.info(`Queue ${type} closed`);
      } catch (error) {
        logger.error(`Failed to close queue ${type}`, {
          error: (error as Error).message
        });
      }
    }

    this.workers.clear();
    this.queues.clear();
    this.isInitialized = false;

    logger.info('Queue system shutdown complete');
  }

  // Helper methods
  private getQueueTypeForJob(jobType: CCLJobType): string {
    const criticalJobs = [
      CCLJobType.PROCESS_LEAD,
      CCLJobType.LEAD_ROUTING,
      CCLJobType.AGENT_DECISION,
      CCLJobType.BOBERDOO_SUBMISSION,
      CCLJobType.SEND_EMAIL,
      CCLJobType.SEND_SMS,
    ];

    const backgroundJobs = [
      CCLJobType.CLEANUP_OLD_DATA,
      CCLJobType.BACKUP_DATA,
      CCLJobType.HEALTH_CHECK,
      CCLJobType.UPDATE_ANALYTICS,
    ];

    if (criticalJobs.includes(jobType)) {
      return 'critical';
    } else if (backgroundJobs.includes(jobType)) {
      return 'background';
    } else {
      return 'standard';
    }
  }

  private getPriorityForJob(jobType: CCLJobType): number {
    const priorityMap: Record<CCLJobType, CCLJobPriority> = {
      [CCLJobType.PROCESS_LEAD]: CCLJobPriority.CRITICAL,
      [CCLJobType.BOBERDOO_SUBMISSION]: CCLJobPriority.CRITICAL,
      [CCLJobType.AGENT_DECISION]: CCLJobPriority.HIGH,
      [CCLJobType.SEND_EMAIL]: CCLJobPriority.HIGH,
      [CCLJobType.SEND_SMS]: CCLJobPriority.HIGH,
      [CCLJobType.LEAD_ENRICHMENT]: CCLJobPriority.NORMAL,
      [CCLJobType.EMAIL_CAMPAIGN]: CCLJobPriority.NORMAL,
      [CCLJobType.GENERATE_REPORT]: CCLJobPriority.LOW,
      [CCLJobType.UPDATE_ANALYTICS]: CCLJobPriority.LOW,
      [CCLJobType.CLEANUP_OLD_DATA]: CCLJobPriority.BACKGROUND,
      [CCLJobType.BACKUP_DATA]: CCLJobPriority.BACKGROUND,
      [CCLJobType.HEALTH_CHECK]: CCLJobPriority.BACKGROUND,
      [CCLJobType.LEAD_SCORING]: CCLJobPriority.NORMAL,
      [CCLJobType.LEAD_ROUTING]: CCLJobPriority.HIGH,
      [CCLJobType.LEAD_VALIDATION]: CCLJobPriority.NORMAL,
      [CCLJobType.AGENT_FOLLOWUP]: CCLJobPriority.NORMAL,
      [CCLJobType.AGENT_TRAINING]: CCLJobPriority.LOW,
      [CCLJobType.SEND_CHAT_MESSAGE]: CCLJobPriority.HIGH,
      [CCLJobType.WEBHOOK_DELIVERY]: CCLJobPriority.NORMAL,
      [CCLJobType.API_SYNC]: CCLJobPriority.NORMAL,
      [CCLJobType.DATA_EXPORT]: CCLJobPriority.LOW,
      [CCLJobType.CAMPAIGN_EXECUTION]: CCLJobPriority.NORMAL,
      [CCLJobType.CAMPAIGN_SCHEDULING]: CCLJobPriority.NORMAL,
      [CCLJobType.CAMPAIGN_ANALYSIS]: CCLJobPriority.LOW,
    };

    return priorityMap[jobType] || CCLJobPriority.NORMAL;
  }

  // Check if queue system is ready
  isReady(): boolean {
    return this.isInitialized && redisClient !== null;
  }

  // Get queue instance (for advanced operations)
  getQueue(queueType: string): Queue | undefined {
    return this.queues.get(queueType);
  }

  // Get worker instance (for advanced operations)
  getWorker(queueType: string): Worker | undefined {
    return this.workers.get(queueType);
  }
}

// Global queue instance
export const cclQueue = new CCLQueue();

export default {
  CCLQueue,
  cclQueue,
  CCLJobType,
  CCLJobPriority
};
*/

// Minimal in-memory queue system for current needs

type SimpleJob = {
  type: string;
  payload: any;
  onComplete?: (result: any) => void;
  retryCount?: number;
  maxRetries?: number;
};

class InMemoryQueue {
  private queue: SimpleJob[] = [];
  private isProcessing = false;

  addJob(job: SimpleJob) {
    this.queue.push({ ...job, retryCount: 0 });
    this.process();
  }

  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (this.queue.length) {
      const job = this.queue.shift();
      if (!job) continue;
      try {
        // Directly call operation handler (to be customized per use case)
        const result = await this.handleJob(job);
        job.onComplete?.(result);
      } catch (e) {
        if ((job.retryCount ?? 0) < (job.maxRetries ?? 1)) {
          job.retryCount = (job.retryCount ?? 0) + 1;
          this.queue.push(job);
        }
      }
    }
    this.isProcessing = false;
  }

  private async handleJob(job: SimpleJob): Promise<any> {
    // Replace with your direct function call or operation switch
    if (typeof job.type === "string" && typeof (globalThis as any)[job.type] === "function") {
      return await (globalThis as any)[job.type](job.payload);
    }
    throw new Error("Unknown job type: " + job.type);
  }
}

export const simpleQueue = new InMemoryQueue();