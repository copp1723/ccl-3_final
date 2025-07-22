// Job processors for CCL-3 SWARM background operations
// Handles various types of background jobs with proper error handling and logging

import { Job } from 'bullmq';
import { CCLJobData, CCLJobType } from '../utils/queue.js';
import { logger, CCLLogger } from '../utils/logger.js';
import { CCLCustomError, CCLErrorCode, cclDbOperation, cclExternalOperation } from '../utils/error-handler.js';
import { LeadsRepository, ConversationsRepository, CommunicationsRepository, CampaignsRepository } from '../db/index.js';
import { getOverlordAgent, getEmailAgent, getSMSAgent } from '../agents/index.js';
import { CCLRedisOperations } from '../utils/redis.js';

// Lead processing job processor
export async function processLeadJob(job: Job<CCLJobData>): Promise<any> {
  const { payload } = job.data;
  const leadId = payload.leadId;

  if (!leadId) {
    throw new CCLCustomError(
      'Lead ID is required for lead processing job',
      CCLErrorCode.LEAD_VALIDATION_ERROR,
      400,
      { jobId: job.id, payload }
    );
  }

  try {
    CCLLogger.leadProcessing(leadId, 'background_processing_started', {
      jobId: job.id,
      attempts: job.attemptsMade + 1
    });

    // Get lead data
    const lead = await cclDbOperation(async () => {
      return await LeadsRepository.findById(leadId);
    }, { leadId, operation: 'fetch_lead' });

    if (!lead) {
      throw new CCLCustomError(
        `Lead ${leadId} not found`,
        CCLErrorCode.RESOURCE_NOT_FOUND,
        404,
        { leadId, jobId: job.id }
      );
    }

    // Check if lead is already being processed
    const processingCache = await CCLRedisOperations.getLeadProcessing(leadId);
    if (processingCache && processingCache.status === 'processing') {
      logger.warn('Lead already being processed, skipping', { leadId, jobId: job.id });
      return { skipped: true, reason: 'already_processing' };
    }

    // Mark lead as being processed
    await CCLRedisOperations.cacheLeadProcessing(leadId, {
      status: 'processing',
      jobId: job.id,
      startTime: Date.now()
    }, 3600); // 1 hour TTL

    // Get overlord agent
    const overlordAgent = getOverlordAgent();
    
    // Make overlord decision
    const decision = await overlordAgent.makeDecision({ lead });
    
    // Cache the decision
    await CCLRedisOperations.cacheAgentDecision(leadId, 'overlord', decision, 1800); // 30 minutes

    // Store decision in database
    await cclDbOperation(async () => {
      return await ConversationsRepository.create(
        leadId,
        decision.reasoning || 'Overlord agent decision',
        'overlord',
        'assistant',
        { decision }
      );
    }, { leadId, operation: 'store_decision' });

    // Process based on decision
    let communicationResult = null;
    if (decision.action === 'send_email') {
      communicationResult = await processEmailCommunication(leadId, decision.data);
    } else if (decision.action === 'send_sms') {
      communicationResult = await processSMSCommunication(leadId, decision.data);
    } else if (decision.action === 'submit_to_boberdoo') {
      communicationResult = await processBoberdooSubmission(leadId);
    }

    // Update lead processing cache
    await CCLRedisOperations.cacheLeadProcessing(leadId, {
      status: 'completed',
      jobId: job.id,
      completedTime: Date.now(),
      decision,
      communicationResult
    }, 86400); // 24 hours TTL

    CCLLogger.leadProcessing(leadId, 'background_processing_completed', {
      jobId: job.id,
      decision: decision.action,
      communicationResult: communicationResult ? 'success' : 'none'
    });

    return {
      leadId,
      decision,
      communicationResult,
      processedAt: new Date().toISOString()
    };

  } catch (error) {
    CCLLogger.leadError(leadId, error as Error, {
      jobId: job.id,
      step: 'background_processing',
      attempts: job.attemptsMade + 1
    });

    // Update processing cache with error
    await CCLRedisOperations.cacheLeadProcessing(leadId, {
      status: 'failed',
      jobId: job.id,
      failedTime: Date.now(),
      error: (error as Error).message
    }, 86400);

    throw error;
  }
}

// Email communication processor
export async function processEmailJob(job: Job<CCLJobData>): Promise<any> {
  const { payload } = job.data;
  
  try {
    const emailAgent = getEmailAgent();
    const result = await emailAgent.sendEmail(
      payload.to,
      payload.subject,
      payload.text,
      payload.html
    );

    // Store communication record
    if (payload.leadId) {
      await cclDbOperation(async () => {
        return await CommunicationsRepository.create(
          payload.leadId,
          'email',
          'outbound',
          payload.text,
          'sent',
          result.id,
          { subject: payload.subject, jobId: job.id }
        );
      }, { leadId: payload.leadId, operation: 'store_communication' });
    }

    CCLLogger.communicationSent('email', payload.leadId || '', {
      recipient: payload.to,
      subject: payload.subject,
      externalId: result.id,
      jobId: job.id
    });

    return { messageId: result.id, status: 'sent' };

  } catch (error) {
    CCLLogger.communicationFailed('email', payload.leadId || '', error as Error, {
      recipient: payload.to,
      subject: payload.subject,
      jobId: job.id
    });
    throw error;
  }
}

// SMS communication processor
export async function processSMSJob(job: Job<CCLJobData>): Promise<any> {
  const { payload } = job.data;
  
  try {
    const smsAgent = getSMSAgent();
    const result = await smsAgent.sendSMS(payload.to, payload.body);

    // Store communication record
    if (payload.leadId) {
      await cclDbOperation(async () => {
        return await CommunicationsRepository.create(
          payload.leadId,
          'sms',
          'outbound',
          payload.body,
          'sent',
          result.sid,
          { jobId: job.id }
        );
      }, { leadId: payload.leadId, operation: 'store_communication' });
    }

    CCLLogger.communicationSent('sms', payload.leadId || '', {
      recipient: payload.to,
      externalId: result.sid,
      jobId: job.id
    });

    return { messageId: result.sid, status: 'sent' };

  } catch (error) {
    CCLLogger.communicationFailed('sms', payload.leadId || '', error as Error, {
      recipient: payload.to,
      jobId: job.id
    });
    throw error;
  }
}

// Boberdoo submission processor
export async function processBoberdooJob(job: Job<CCLJobData>): Promise<any> {
  const { payload } = job.data;
  const leadId = payload.leadId;

  if (!leadId) {
    throw new CCLCustomError(
      'Lead ID is required for Boberdoo submission',
      CCLErrorCode.LEAD_VALIDATION_ERROR,
      400,
      { jobId: job.id, payload }
    );
  }

  try {
    // Get overlord agent to handle submission
    const overlordAgent = getOverlordAgent();
    const lead = await cclDbOperation(async () => {
      return await LeadsRepository.findById(leadId);
    }, { leadId, operation: 'fetch_lead_for_boberdoo' });

    if (!lead) {
      throw new CCLCustomError(
        `Lead ${leadId} not found for Boberdoo submission`,
        CCLErrorCode.RESOURCE_NOT_FOUND,
        404,
        { leadId, jobId: job.id }
      );
    }

    const result = await overlordAgent.submitToBoberdoo(lead, payload.testMode || false);

    CCLLogger.externalApiSuccess('boberdoo', '/leadPost', 0, {
      leadId,
      matched: result.matched,
      buyerId: result.buyerId,
      jobId: job.id
    });

    return result;

  } catch (error) {
    CCLLogger.externalApiError('boberdoo', '/leadPost', error as Error, 0, {
      leadId,
      jobId: job.id
    });
    throw error;
  }
}

// Campaign execution processor
export async function processCampaignJob(job: Job<CCLJobData>): Promise<any> {
  const { payload } = job.data;
  const campaignId = payload.campaignId;

  if (!campaignId) {
    throw new CCLCustomError(
      'Campaign ID is required for campaign execution',
      CCLErrorCode.CAMPAIGN_VALIDATION_ERROR,
      400,
      { jobId: job.id, payload }
    );
  }

  try {
    CCLLogger.campaignEvent(campaignId, 'execution_started', {
      jobId: job.id,
      attempts: job.attemptsMade + 1
    });

    // Get campaign data
    const campaign = await cclDbOperation(async () => {
      return await CampaignsRepository.findById(campaignId);
    }, { campaignId, operation: 'fetch_campaign' });

    if (!campaign) {
      throw new CCLCustomError(
        `Campaign ${campaignId} not found`,
        CCLErrorCode.RESOURCE_NOT_FOUND,
        404,
        { campaignId, jobId: job.id }
      );
    }

    // Cache campaign data
    await CCLRedisOperations.cacheCampaignData(campaignId, campaign, 7200); // 2 hours

    // Process campaign based on type
    let results = [];
    if (campaign.type === 'email') {
      results = await processEmailCampaign(campaign, job);
    } else if (campaign.type === 'sms') {
      results = await processSMSCampaign(campaign, job);
    }

    CCLLogger.campaignEvent(campaignId, 'execution_completed', {
      jobId: job.id,
      resultsCount: results.length
    });

    return {
      campaignId,
      type: campaign.type,
      results,
      completedAt: new Date().toISOString()
    };

  } catch (error) {
    CCLLogger.campaignEvent(campaignId, 'execution_failed', {
      jobId: job.id,
      error: (error as Error).message
    });
    throw error;
  }
}

// Data cleanup processor
export async function processCleanupJob(job: Job<CCLJobData>): Promise<any> {
  const { payload } = job.data;
  
  try {
    logger.info('Starting data cleanup job', { jobId: job.id, payload });

    const cleanupResults = {
      oldCommunications: 0,
      oldSessions: 0,
      expiredCache: 0
    };

    // Cleanup old communications (older than 90 days)
    if (payload.cleanupCommunications !== false) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      const deletedCommunications = await cclDbOperation(async () => {
        // This would be a custom cleanup query
        return 0; // Placeholder
      }, { operation: 'cleanup_communications' });
      
      cleanupResults.oldCommunications = deletedCommunications;
    }

    // Cleanup Redis cache
    if (payload.cleanupCache !== false && CCLRedisOperations) {
      // Redis cleanup would be implemented here
      cleanupResults.expiredCache = 1;
    }

    logger.info('Data cleanup completed', { 
      jobId: job.id, 
      results: cleanupResults 
    });

    CCLLogger.securityEvent('Data cleanup completed', 'low', {
      jobId: job.id,
      results: cleanupResults
    });

    return cleanupResults;

  } catch (error) {
    logger.error('Data cleanup failed', {
      jobId: job.id,
      error: (error as Error).message
    });
    throw error;
  }
}

// Analytics update processor
export async function processAnalyticsJob(job: Job<CCLJobData>): Promise<any> {
  const { payload } = job.data;
  
  try {
    logger.info('Starting analytics update job', { jobId: job.id, payload });

    // This would calculate and update various analytics
    const analyticsData = {
      leadsProcessed: 0,
      conversionsRate: 0,
      campaignPerformance: {},
      agentEfficiency: {}
    };

    // Calculate lead metrics
    if (payload.calculateLeadMetrics !== false) {
      // Lead metrics calculation would go here
      analyticsData.leadsProcessed = 100; // Placeholder
    }

    // Update analytics in database
    // Analytics update logic would go here

    CCLLogger.analyticsEvent('analytics_update_completed', analyticsData, {
      jobId: job.id
    });

    return analyticsData;

  } catch (error) {
    logger.error('Analytics update failed', {
      jobId: job.id,
      error: (error as Error).message
    });
    throw error;
  }
}

// Export data processor
export async function processDataExportJob(job: Job<CCLJobData>): Promise<any> {
  const { payload } = job.data;
  
  try {
    logger.info('Starting data export job', { jobId: job.id, payload });

    // Export logic would go here based on payload.exportType
    const exportResult = {
      type: payload.exportType,
      fileName: `export_${Date.now()}.csv`,
      recordCount: 0,
      fileSize: 0
    };

    CCLLogger.analyticsEvent('data_export_completed', exportResult, {
      jobId: job.id,
      userId: payload.userId
    });

    return exportResult;

  } catch (error) {
    logger.error('Data export failed', {
      jobId: job.id,
      error: (error as Error).message
    });
    throw error;
  }
}

// Helper functions
async function processEmailCommunication(leadId: string, data: any): Promise<any> {
  return await cclExternalOperation('mailgun', async () => {
    const emailAgent = getEmailAgent();
    return await emailAgent.sendEmail(data.to, data.subject, data.text, data.html);
  }, { leadId, operation: 'send_email' });
}

async function processSMSCommunication(leadId: string, data: any): Promise<any> {
  return await cclExternalOperation('twilio', async () => {
    const smsAgent = getSMSAgent();
    return await smsAgent.sendSMS(data.to, data.body);
  }, { leadId, operation: 'send_sms' });
}

async function processBoberdooSubmission(leadId: string): Promise<any> {
  return await cclExternalOperation('boberdoo', async () => {
    const overlordAgent = getOverlordAgent();
    const lead = await LeadsRepository.findById(leadId);
    if (!lead) throw new Error('Lead not found');
    return await overlordAgent.submitToBoberdoo(lead);
  }, { leadId, operation: 'submit_boberdoo' });
}

async function processEmailCampaign(campaign: any, job: Job<CCLJobData>): Promise<any[]> {
  // Email campaign processing logic
  const results = [];
  
  // Get target leads for campaign
  // Process each lead
  // Return results
  
  return results;
}

async function processSMSCampaign(campaign: any, job: Job<CCLJobData>): Promise<any[]> {
  // SMS campaign processing logic
  const results = [];
  
  // Get target leads for campaign
  // Process each lead
  // Return results
  
  return results;
}

// Job processor mapping
export const JOB_PROCESSORS = {
  [CCLJobType.PROCESS_LEAD]: processLeadJob,
  [CCLJobType.SEND_EMAIL]: processEmailJob,
  [CCLJobType.SEND_SMS]: processSMSJob,
  [CCLJobType.BOBERDOO_SUBMISSION]: processBoberdooJob,
  [CCLJobType.EMAIL_CAMPAIGN]: processCampaignJob,
  [CCLJobType.CAMPAIGN_EXECUTION]: processCampaignJob,
  [CCLJobType.CLEANUP_OLD_DATA]: processCleanupJob,
  [CCLJobType.UPDATE_ANALYTICS]: processAnalyticsJob,
  [CCLJobType.DATA_EXPORT]: processDataExportJob,
};

export default {
  processLeadJob,
  processEmailJob,
  processSMSJob,
  processBoberdooJob,
  processCampaignJob,
  processCleanupJob,
  processAnalyticsJob,
  processDataExportJob,
  JOB_PROCESSORS
};