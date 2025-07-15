import { logger } from '../utils/logger';
import { db } from '../db/client';
import { campaigns, leads, communications, emailTemplates } from '../db/schema';
import { eq, and, isNull, lt, gte } from 'drizzle-orm';
import { queueManager } from '../workers/queue-manager';
import { emailTemplateManager } from '../../email-system/services/email-campaign-templates';
import { emailMonitor } from './email-monitor';

interface CampaignTrigger {
  type: 'email' | 'time' | 'lead_status' | 'manual';
  conditions: {
    emailSubject?: string;
    emailFrom?: string;
    leadStatus?: string;
    timeDelay?: number; // minutes
    campaignId?: string;
  };
}

interface CampaignExecution {
  id: string;
  campaignId: string;
  leadId: string;
  templateId: string;
  scheduledFor: Date;
  status: 'scheduled' | 'executing' | 'completed' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  errorMessage?: string;
}

class CampaignExecutionEngine {
  private executions: Map<string, CampaignExecution> = new Map();
  private triggers: CampaignTrigger[] = [];
  private isRunning = false;
  private executionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultTriggers();
  }

  /**
   * Initialize default campaign triggers
   */
  private initializeDefaultTriggers() {
    this.triggers = [
      {
        type: 'email',
        conditions: {
          emailSubject: 'START CAMPAIGN',
          emailFrom: process.env.CAMPAIGN_TRIGGER_EMAIL || 'campaigns@completecarloans.com'
        }
      },
      {
        type: 'lead_status',
        conditions: {
          leadStatus: 'new'
        }
      },
      {
        type: 'time',
        conditions: {
          timeDelay: 60 // Check every hour
        }
      }
    ];
  }

  /**
   * Start the campaign execution engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Campaign execution engine is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Campaign Execution Engine');

    // Start email monitoring for campaign triggers
    await this.startEmailMonitoring();

    // Start periodic execution check
    this.executionInterval = setInterval(async () => {
      await this.processScheduledExecutions();
    }, 60000); // Check every minute

    // Process any pending executions immediately
    await this.processScheduledExecutions();

    logger.info('Campaign Execution Engine started successfully');
  }

  /**
   * Stop the campaign execution engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping Campaign Execution Engine');

    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    await emailMonitor.stop();
    logger.info('Campaign Execution Engine stopped');
  }

  /**
   * Start email monitoring for campaign triggers
   */
  private async startEmailMonitoring(): Promise<void> {
    try {
      // Override the email monitor's handleNewMail to check for campaign triggers
      const originalHandleNewMail = (emailMonitor as any).handleNewMail.bind(emailMonitor);
      
      (emailMonitor as any).handleNewMail = async (numNewMails: number) => {
        // Call original handler first
        await originalHandleNewMail(numNewMails);
        
        // Then check for campaign triggers
        await this.checkEmailTriggers();
      };

      await emailMonitor.start();
    } catch (error) {
      logger.error('Failed to start email monitoring for campaigns:', error as Error);
    }
  }

  /**
   * Check for email-based campaign triggers
   */
  private async checkEmailTriggers(): Promise<void> {
    const emailTriggers = this.triggers.filter(t => t.type === 'email');
    
    for (const trigger of emailTriggers) {
      try {
        // This would check recent emails for trigger conditions
        // For now, we'll simulate this with a manual trigger endpoint
        logger.debug('Checking email triggers', { trigger: trigger.conditions });
      } catch (error) {
        logger.error('Error checking email triggers:', error as Error);
      }
    }
  }

  /**
   * Manually trigger a campaign for specific leads
   */
  async triggerCampaign(campaignId: string, leadIds: string[], templateSequence?: string[]): Promise<void> {
    try {
      logger.info('Manually triggering campaign', { campaignId, leadCount: leadIds.length });

      // Get campaign details
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId));

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (!campaign.active) {
        throw new Error(`Campaign ${campaignId} is not active`);
      }

      // Get default template sequence if not provided
      const templates = templateSequence || await this.getDefaultTemplateSequence(campaign);

      // Schedule executions for each lead
      for (const leadId of leadIds) {
        await this.scheduleLeadCampaign(leadId, campaignId, templates);
      }

      logger.info('Campaign triggered successfully', { 
        campaignId, 
        leadCount: leadIds.length,
        templateCount: templates.length 
      });

    } catch (error) {
      logger.error('Failed to trigger campaign:', error as Error);
      throw error;
    }
  }

  /**
   * Schedule campaign execution for a specific lead
   */
  private async scheduleLeadCampaign(leadId: string, campaignId: string, templates: string[]): Promise<void> {
    try {
      // Assign lead to campaign
      await db
        .update(leads)
        .set({ 
          campaignId,
          updatedAt: new Date()
        })
        .where(eq(leads.id, leadId));

      // Schedule template executions with delays
      let delayMinutes = 0;
      
      for (let i = 0; i < templates.length; i++) {
        const templateId = templates[i];
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const scheduledFor = new Date();
        scheduledFor.setMinutes(scheduledFor.getMinutes() + delayMinutes);

        const execution: CampaignExecution = {
          id: executionId,
          campaignId,
          leadId,
          templateId,
          scheduledFor,
          status: 'scheduled',
          attempts: 0
        };

        this.executions.set(executionId, execution);

        // Add to queue for processing
        await queueManager.addJob(
          'campaign-execution',
          'execute_campaign_step',
          { executionId },
          1 // Normal priority
        );

        // Increment delay for next template (24 hours default)
        delayMinutes += 24 * 60;
      }

      logger.info('Lead campaign scheduled', { leadId, campaignId, steps: templates.length });

    } catch (error) {
      logger.error('Failed to schedule lead campaign:', error as Error);
      throw error;
    }
  }

  /**
   * Get default template sequence for a campaign
   */
  private async getDefaultTemplateSequence(campaign: any): Promise<string[]> {
    // Check if campaign has touchSequence in settings
    if (campaign.settings?.touchSequence) {
      return campaign.settings.touchSequence.map((touch: any) => touch.templateId);
    }

    // Fallback to default sequence based on campaign goals
    const defaultSequence = [
      'welcome_application',
      'followup_24h',
      'followup_3day',
      'followup_7day'
    ];

    return defaultSequence;
  }

  /**
   * Process scheduled campaign executions
   */
  private async processScheduledExecutions(): Promise<void> {
    if (!this.isRunning) return;

    const now = new Date();
    const pendingExecutions = Array.from(this.executions.values())
      .filter(exec => 
        exec.status === 'scheduled' && 
        exec.scheduledFor <= now
      );

    if (pendingExecutions.length === 0) {
      return;
    }

    logger.info('Processing scheduled campaign executions', { count: pendingExecutions.length });

    for (const execution of pendingExecutions) {
      try {
        await this.executeStep(execution);
      } catch (error) {
        logger.error('Failed to execute campaign step:', { error: (error as Error).message, executionId: execution.id });
      }
    }
  }

  /**
   * Execute a single campaign step
   */
  private async executeStep(execution: CampaignExecution): Promise<void> {
    try {
      execution.status = 'executing';
      execution.attempts++;
      execution.lastAttempt = new Date();

      logger.info('Executing campaign step', { 
        executionId: execution.id,
        leadId: execution.leadId,
        templateId: execution.templateId,
        attempt: execution.attempts
      });

      // Get lead details
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, execution.leadId));

      if (!lead) {
        throw new Error(`Lead ${execution.leadId} not found`);
      }

      // Get template and render with lead data
      const renderedTemplate = emailTemplateManager.renderTemplate(execution.templateId, {
        firstName: lead.name?.split(' ')[0] || 'Friend',
        vehicleInterest: 'vehicle',
        preApprovalAmount: '$25,000',
        approvalAmount: '$25,000',
        monthlyPayment: '$450'
      });

      if (!renderedTemplate) {
        throw new Error(`Template ${execution.templateId} not found`);
      }

      // Send email via queue
      await queueManager.addJob(
        'email',
        'email_send',
        {
          leadId: execution.leadId,
          to: lead.email,
          subject: renderedTemplate.subject,
          text: renderedTemplate.text,
          html: renderedTemplate.html,
          campaignId: execution.campaignId,
          templateId: execution.templateId
        },
        2 // High priority for campaign emails
      );

      // Record communication
      await db.insert(communications).values({
        id: `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        leadId: execution.leadId,
        channel: 'email',
        direction: 'outbound',
        content: renderedTemplate.text,
        status: 'sent',
        metadata: {
          campaignId: execution.campaignId,
          templateId: execution.templateId,
          executionId: execution.id
        },
        createdAt: new Date()
      });

      execution.status = 'completed';
      logger.info('Campaign step executed successfully', { executionId: execution.id });

    } catch (error) {
      execution.status = 'failed';
      execution.errorMessage = (error as Error).message;
      
      logger.error('Campaign step execution failed:', {
        error: (error as Error).message,
        executionId: execution.id,
        attempt: execution.attempts
      });

      // Retry logic
      if (execution.attempts < 3) {
        execution.status = 'scheduled';
        execution.scheduledFor = new Date(Date.now() + 30 * 60 * 1000); // Retry in 30 minutes
        logger.info('Scheduling retry for campaign step', { 
          executionId: execution.id,
          nextAttempt: execution.scheduledFor 
        });
      }
    }
  }

  /**
   * Auto-assign new leads to active campaigns
   */
  async autoAssignLeads(): Promise<void> {
    try {
      // Get unassigned leads
      const unassignedLeads = await db
        .select()
        .from(leads)
        .where(and(
          isNull(leads.campaignId),
          eq(leads.status, 'new')
        ));

      if (unassignedLeads.length === 0) {
        return;
      }

      // Get active campaigns
      const activeCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.active, true));

      if (activeCampaigns.length === 0) {
        logger.warn('No active campaigns found for lead assignment');
        return;
      }

      // Simple assignment logic - assign to first active campaign
      // In a real implementation, this would use more sophisticated matching
      const defaultCampaign = activeCampaigns[0];

      for (const lead of unassignedLeads) {
        await this.triggerCampaign(defaultCampaign.id, [lead.id]);
      }

      logger.info('Auto-assigned leads to campaigns', { 
        leadCount: unassignedLeads.length,
        campaignId: defaultCampaign.id 
      });

    } catch (error) {
      logger.error('Failed to auto-assign leads:', error as Error);
    }
  }

  /**
   * Get campaign execution statistics
   */
  async getExecutionStats(campaignId?: string): Promise<any> {
    const executions = Array.from(this.executions.values());
    const filtered = campaignId 
      ? executions.filter(e => e.campaignId === campaignId)
      : executions;

    return {
      total: filtered.length,
      scheduled: filtered.filter(e => e.status === 'scheduled').length,
      executing: filtered.filter(e => e.status === 'executing').length,
      completed: filtered.filter(e => e.status === 'completed').length,
      failed: filtered.filter(e => e.status === 'failed').length,
      executions: filtered
    };
  }

  /**
   * Cancel scheduled executions for a campaign or lead
   */
  async cancelExecutions(campaignId?: string, leadId?: string): Promise<number> {
    let cancelledCount = 0;
    
    for (const [id, execution] of this.executions.entries()) {
      if (execution.status === 'scheduled') {
        if ((campaignId && execution.campaignId === campaignId) ||
            (leadId && execution.leadId === leadId)) {
          execution.status = 'failed';
          execution.errorMessage = 'Cancelled by user';
          cancelledCount++;
        }
      }
    }

    logger.info('Cancelled campaign executions', { 
      count: cancelledCount,
      campaignId,
      leadId 
    });

    return cancelledCount;
  }
}

// Export singleton instance
export const campaignExecutionEngine = new CampaignExecutionEngine();
export default campaignExecutionEngine;