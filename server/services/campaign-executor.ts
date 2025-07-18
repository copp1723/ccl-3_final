import Bull from 'bull';
import { db } from '../db';
import { leads, campaigns, conversations } from '../db/schema';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';

import 'dotenv/config';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class CampaignExecutor {
  private leadQueue: Bull.Queue;

  constructor() {
    this.leadQueue = new Bull('lead-processing', REDIS_URL);
    this.leadQueue.process(this.processLead.bind(this));
  }

  async addLeadToQueue(leadId: string) {
    await this.leadQueue.add({ leadId });
    logger.info(`Added lead ${leadId} to processing queue`);
  }

  private async processLead(job: Bull.Job<{ leadId: string }>) {
    const { leadId } = job.data;
    try {
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
      if (!lead) throw new Error('Lead not found');

      // Assign to campaign (simple rule: first active campaign)
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.active, true)).limit(1);
      if (!campaign) throw new Error('No active campaign found');

      await db.update(leads).set({ campaignId: campaign.id }).where(eq(leads.id, leadId));

      // Initialize conversation
      await db.insert(conversations).values({
        id: crypto.randomUUID(),
        leadId,
        channel: 'email', // default
        agentType: 'email',
        messages: [],
        status: 'active',
        startedAt: new Date(),
      });

      // Schedule follow-up (using bull for simplicity)
      await this.leadQueue.add('followup', { leadId }, { delay: 24 * 60 * 60 * 1000 }); // 24h delay

      logger.info(`Processed lead ${leadId} assigned to campaign ${campaign.id}`);
    } catch (error) {
      logger.error(`Error processing lead ${leadId}:`, error as Error);
      throw error;
    }
  }

  async cleanup() {
    await this.leadQueue.close();
  }
}

export const campaignExecutor = new CampaignExecutor();

// To add new leads, call campaignExecutor.addLeadToQueue(leadId) 