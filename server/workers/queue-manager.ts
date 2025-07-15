// Queue Manager for CCL-3 SWARM
// Handles background job processing and task queuing

import { logger } from '../utils/logger';

interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
}

interface QueueConfig {
  maxConcurrent: number;
  retryDelay: number;
  maxRetries: number;
}

class SimpleQueueManager {
  private queues: Map<string, QueueJob[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 3,
      retryDelay: config.retryDelay || 5000,
      maxRetries: config.maxRetries || 3
    };
  }

  // Add job to queue
  async addJob(queueName: string, jobType: string, data: any, priority: number = 0): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: QueueJob = {
      id: jobId,
      type: jobType,
      data,
      priority,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.config.maxRetries
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    const queue = this.queues.get(queueName)!;
    queue.push(job);
    
    // Sort by priority (higher first)
    queue.sort((a, b) => b.priority - a.priority);

    logger.info(`Job added to queue`, { queueName, jobId, jobType, priority });

    // Start processing if not already running
    this.processQueue(queueName);

    return jobId;
  }

  // Process jobs in queue
  private async processQueue(queueName: string): Promise<void> {
    if (this.processing.get(queueName)) {
      return; // Already processing
    }

    this.processing.set(queueName, true);

    try {
      const queue = this.queues.get(queueName);
      if (!queue || queue.length === 0) {
        this.processing.set(queueName, false);
        return;
      }

      const job = queue.shift()!;
      await this.executeJob(job);

      // Continue processing if more jobs exist
      if (queue.length > 0) {
        setImmediate(() => this.processQueue(queueName));
      } else {
        this.processing.set(queueName, false);
      }

    } catch (error) {
      logger.error(`Queue processing error`, { queueName, error: (error as Error).message });
      this.processing.set(queueName, false);
    }
  }

  // Execute individual job
  private async executeJob(job: QueueJob): Promise<void> {
    job.attempts++;

    try {
      logger.info(`Executing job`, { jobId: job.id, type: job.type, attempt: job.attempts });

      // Job execution logic based on type
      switch (job.type) {
        case 'lead_processing':
          await this.processLead(job.data);
          break;
        case 'email_send':
          await this.sendEmail(job.data);
          break;
        case 'sms_send':
          await this.sendSMS(job.data);
          break;
        case 'agent_decision':
          await this.processAgentDecision(job.data);
          break;
        case 'execute_campaign_step':
          await this.executeCampaignStep(job.data);
          break;
        case 'campaign_trigger':
          await this.triggerCampaign(job.data);
          break;
        case 'lead_handover':
          await this.processLeadHandover(job.data);
          break;
        default:
          logger.warn(`Unknown job type: ${job.type}`);
      }

      logger.info(`Job completed successfully`, { jobId: job.id, type: job.type });

    } catch (error) {
      logger.error(`Job execution failed`, { 
        jobId: job.id, 
        type: job.type, 
        attempt: job.attempts,
        error: (error as Error).message 
      });

      // Retry if not exceeded max attempts
      if (job.attempts < job.maxAttempts) {
        logger.info(`Retrying job`, { jobId: job.id, attempt: job.attempts + 1 });
        
        // Add back to queue after delay
        setTimeout(() => {
          const queueName = this.getQueueNameForJobType(job.type);
          const queue = this.queues.get(queueName);
          if (queue) {
            queue.unshift(job); // Add to front for retry
          }
        }, this.config.retryDelay);
      } else {
        logger.error(`Job failed permanently`, { jobId: job.id, type: job.type, maxAttempts: job.maxAttempts });
      }
    }
  }

  // Job type handlers
  private async processLead(data: any): Promise<void> {
    // Placeholder for lead processing
    logger.info('Processing lead', { leadId: data.leadId });
    // In a real implementation, this would call the lead processor
  }

  private async sendEmail(data: any): Promise<void> {
    try {
      // Import email service dynamically to avoid circular dependencies
      const { emailTemplateManager } = await import('../../email-system/services/email-campaign-templates');
      
      // Send email using the email service
      const result = await fetch(process.env.MAILGUN_API_URL || 'https://api.mailgun.net/v3/your-domain/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          from: process.env.FROM_EMAIL || 'noreply@completecarloans.com',
          to: data.to,
          subject: data.subject,
          html: data.html,
          text: data.text || data.html?.replace(/<[^>]*>/g, '') || data.subject
        })
      });

      if (!result.ok) {
        throw new Error(`Email send failed: ${result.status} ${result.statusText}`);
      }

      const response = await result.json();
      logger.info('Email sent successfully', { 
        to: data.to, 
        subject: data.subject,
        messageId: response.id,
        leadId: data.leadId
      });

      // Update communication record if provided
      if (data.leadId) {
        const { db } = await import('../db/client');
        const { communications } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        
        await db.update(communications)
          .set({ 
            status: 'sent',
            externalId: response.id,
            metadata: {
              ...data,
              sentAt: new Date().toISOString(),
              messageId: response.id
            }
          })
          .where(eq(communications.leadId, data.leadId));
      }

    } catch (error) {
      logger.error('Email sending failed', { 
        to: data.to, 
        subject: data.subject,
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private async sendSMS(data: any): Promise<void> {
    // Placeholder for SMS sending
    logger.info('Sending SMS', { to: data.to });
    // In a real implementation, this would call the SMS service
  }

  private async processAgentDecision(data: any): Promise<void> {
    // Placeholder for agent decision processing
    logger.info('Processing agent decision', { leadId: data.leadId, agent: data.agent });
    // In a real implementation, this would call the agent system
  }

  private async executeCampaignStep(data: any): Promise<void> {
    // Placeholder for campaign step execution
    logger.info('Executing campaign step', { executionId: data.executionId });
    // In a real implementation, this would call the campaign execution engine
    try {
      const { campaignExecutionEngine } = await import('../services/campaign-execution-engine');
      // The actual execution logic is handled by the campaign execution engine
      logger.info('Campaign step execution delegated to engine', { executionId: data.executionId });
    } catch (error) {
      logger.error('Failed to execute campaign step', { error: (error as Error).message });
      throw error;
    }
  }

  private async triggerCampaign(data: any): Promise<void> {
    // Placeholder for campaign triggering
    logger.info('Triggering campaign', { campaignId: data.campaignId, leadIds: data.leadIds });
    try {
      const { campaignExecutionEngine } = await import('../services/campaign-execution-engine');
      await campaignExecutionEngine.triggerCampaign(data.campaignId, data.leadIds, data.templateSequence);
      logger.info('Campaign triggered successfully', { campaignId: data.campaignId });
    } catch (error) {
      logger.error('Failed to trigger campaign', { error: (error as Error).message });
      throw error;
    }
  }

  private async processLeadHandover(data: any): Promise<void> {
    logger.info('Processing lead handover', { leadId: data.leadId, campaignId: data.campaignId, reason: data.reason });
    try {
      const { LeadHandoverExecutor } = await import('../services/lead-handover-executor');
      const results = await LeadHandoverExecutor.executeHandover(data.leadId, data.campaignId, data.reason);
      
      const successCount = results.filter(r => r.success).length;
      logger.info('Lead handover completed', { 
        leadId: data.leadId, 
        totalDestinations: results.length,
        successfulHandovers: successCount
      });
      
      if (successCount === 0) {
        throw new Error('All handover attempts failed');
      }
    } catch (error) {
      logger.error('Failed to process lead handover', { 
        leadId: data.leadId,
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private getQueueNameForJobType(jobType: string): string {
    switch (jobType) {
      case 'lead_processing':
        return 'leads';
      case 'email_send':
        return 'email';
      case 'sms_send':
        return 'sms';
      case 'agent_decision':
        return 'agents';
      default:
        return 'default';
    }
  }

  // Get queue status
  getQueueStatus(queueName: string): { pending: number; processing: boolean } {
    const queue = this.queues.get(queueName) || [];
    return {
      pending: queue.length,
      processing: this.processing.get(queueName) || false
    };
  }

  // Get all queue statuses
  getAllQueueStatuses(): Record<string, { pending: number; processing: boolean }> {
    const statuses: Record<string, { pending: number; processing: boolean }> = {};
    
    for (const [queueName] of this.queues) {
      statuses[queueName] = this.getQueueStatus(queueName);
    }

    return statuses;
  }

  // Graceful shutdown
  // Check if queue manager is healthy
  isHealthy(): boolean {
    return true; // Simple implementation - could check memory, queue sizes, etc.
  }

  // Add lead processing job
  async addLeadProcessingJob(leadId: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<string> {
    const priorityMap = { low: 0, normal: 1, high: 2 };
    return await this.addJob('leads', 'lead_processing', { leadId }, priorityMap[priority]);
  }

  // Add email sending job
  async addEmailJob(emailData: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    leadId?: string;
    campaignId?: string;
    templateId?: string;
  }, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<string> {
    const priorityMap = { low: 0, normal: 1, high: 2 };
    return await this.addJob('email', 'email_send', emailData, priorityMap[priority]);
  }

  // Add handover job
  async addHandoverJob(leadId: string, campaignId: string, reason: string, priority: 'low' | 'normal' | 'high' = 'high'): Promise<string> {
    const priorityMap = { low: 0, normal: 1, high: 2 };
    return await this.addJob('handover', 'lead_handover', { leadId, campaignId, reason }, priorityMap[priority]);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down queue manager...');
    
    // Wait for current processing to complete
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const anyProcessing = Array.from(this.processing.values()).some(processing => processing);
      if (!anyProcessing) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Queue manager shutdown complete');
  }
}

// Export singleton instance
export const queueManager = new SimpleQueueManager({
  maxConcurrent: parseInt(process.env.QUEUE_MAX_CONCURRENT || '3'),
  retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY || '5000'),
  maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3')
});

export default queueManager;
export type { QueueJob, QueueConfig };
export { SimpleQueueManager };