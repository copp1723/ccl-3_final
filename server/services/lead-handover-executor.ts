import { logger } from '../utils/logger';
import { db } from '../db/client';
import { leads, campaigns, communications } from '../db/schema';
import { eq } from 'drizzle-orm';

interface HandoverDestination {
  type: 'crm' | 'boberdoo' | 'webhook' | 'email';
  name: string;
  config: {
    url?: string;
    apiKey?: string;
    headers?: Record<string, string>;
    mapping?: Record<string, string>;
    email?: string;
  };
}

interface HandoverResult {
  success: boolean;
  destinationId?: string;
  error?: string;
  response?: any;
}

export class LeadHandoverExecutor {
  /**
   * Execute lead handover to configured destinations
   */
  static async executeHandover(
    leadId: string,
    campaignId: string,
    reason: string
  ): Promise<HandoverResult[]> {
    try {
      // Get lead data
      const lead = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (!lead[0]) {
        throw new Error(`Lead ${leadId} not found`);
      }

      // Get campaign handover configuration
      const campaign = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
      if (!campaign[0] || !campaign[0].handoverCriteria) {
        throw new Error(`Campaign ${campaignId} not found or no handover criteria configured`);
      }

      const handoverConfig = campaign[0].handoverCriteria as any;
      const destinations = handoverConfig.destinations || [];

      const results: HandoverResult[] = [];

      // Execute handover to each destination
      for (const destination of destinations) {
        const result = await this.executeToDestination(lead[0], destination, reason);
        results.push(result);

        // Record communication for each handover attempt
        await db.insert(communications).values({
          id: `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          leadId: leadId,
          channel: 'email',
          direction: 'outbound',
          content: `Lead handover to ${destination.name}: ${result.success ? 'Success' : 'Failed'}`,
          status: result.success ? 'completed' : 'failed',
          metadata: {
            handoverDestination: destination.name,
            handoverType: destination.type,
            reason,
            error: result.error,
            destinationId: result.destinationId
          }
        });
      }

      // Update lead status
      await db.update(leads)
        .set({ 
          status: 'sent_to_boberdoo',
          updatedAt: new Date()
        })
        .where(eq(leads.id, leadId));

      logger.info('Lead handover executed', {
        leadId,
        campaignId,
        destinationCount: destinations.length,
        successCount: results.filter(r => r.success).length
      });

      return results;

    } catch (error) {
      logger.error('Lead handover execution failed', {
        leadId,
        campaignId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Execute handover to specific destination
   */
  private static async executeToDestination(
    lead: any,
    destination: HandoverDestination,
    reason: string
  ): Promise<HandoverResult> {
    try {
      switch (destination.type) {
        case 'boberdoo':
          return await this.sendToBoberdoo(lead, destination, reason);
        case 'crm':
          return await this.sendToCRM(lead, destination, reason);
        case 'webhook':
          return await this.sendToWebhook(lead, destination, reason);
        case 'email':
          return await this.sendToEmail(lead, destination, reason);
        default:
          return {
            success: false,
            error: `Unknown destination type: ${destination.type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Send lead to Boberdoo
   */
  private static async sendToBoberdoo(
    lead: any,
    destination: HandoverDestination,
    reason: string
  ): Promise<HandoverResult> {
    try {
      const payload = {
        first_name: lead.firstName || '',
        last_name: lead.lastName || '',
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        campaign: lead.campaign,
        qualification_score: lead.qualificationScore,
        handover_reason: reason,
        metadata: lead.metadata,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(destination.config.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${destination.config.apiKey}`,
          ...destination.config.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Boberdoo API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        destinationId: result.id || result.lead_id,
        response: result
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Send lead to CRM system
   */
  private static async sendToCRM(
    lead: any,
    destination: HandoverDestination,
    reason: string
  ): Promise<HandoverResult> {
    try {
      // Map lead data according to CRM field mapping
      const mapping = destination.config.mapping || {};
      const payload: any = {};

      // Apply field mapping
      for (const [crmField, leadField] of Object.entries(mapping)) {
        payload[crmField] = lead[leadField] || '';
      }

      // Add standard fields
      payload.handover_reason = reason;
      payload.qualification_score = lead.qualificationScore;
      payload.source_system = 'CCL-SWARM';
      payload.created_at = new Date().toISOString();

      const response = await fetch(destination.config.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${destination.config.apiKey}`,
          ...destination.config.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`CRM API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        destinationId: result.id,
        response: result
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Send lead to webhook endpoint
   */
  private static async sendToWebhook(
    lead: any,
    destination: HandoverDestination,
    reason: string
  ): Promise<HandoverResult> {
    try {
      const payload = {
        event: 'lead_handover',
        lead: {
          id: lead.id,
          name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          campaign: lead.campaign,
          qualification_score: lead.qualificationScore,
          metadata: lead.metadata
        },
        handover: {
          reason,
          timestamp: new Date().toISOString(),
          destination: destination.name
        }
      };

      const response = await fetch(destination.config.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...destination.config.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      
      return {
        success: true,
        response: result
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Send lead notification via email
   */
  private static async sendToEmail(
    lead: any,
    destination: HandoverDestination,
    reason: string
  ): Promise<HandoverResult> {
    try {
      // This would integrate with your email service (Mailgun, etc.)
      const emailContent = `
        New Lead Handover Notification
        
        Lead Details:
        - Name: ${lead.firstName || ''} ${lead.lastName || ''}
        - Email: ${lead.email}
        - Phone: ${lead.phone}
        - Source: ${lead.source}
        - Campaign: ${lead.campaign}
        - Qualification Score: ${lead.qualificationScore}
        
        Handover Reason: ${reason}
        Timestamp: ${new Date().toISOString()}
        
        Please follow up with this lead promptly.
      `;

      // In a real implementation, you would use your email service here
      logger.info('Email handover notification sent', {
        to: destination.config.email,
        leadId: lead.id,
        reason
      });

      return {
        success: true,
        destinationId: `email_${Date.now()}`
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get handover status for a lead
   */
  static async getHandoverStatus(leadId: string): Promise<{
    handovers: any[];
    lastHandover?: any;
    totalHandovers: number;
  }> {
    try {
      const handoverCommunications = await db.select()
        .from(communications)
        .where(eq(communications.leadId, leadId));

      const handovers = handoverCommunications
        .filter(comm => comm.metadata && (comm.metadata as any).handoverDestination)
        .map(comm => ({
          id: comm.id,
          destination: (comm.metadata as any).handoverDestination,
          type: (comm.metadata as any).handoverType,
          reason: (comm.metadata as any).reason,
          success: comm.status === 'completed',
          error: (comm.metadata as any).error,
          timestamp: comm.createdAt
        }));

      return {
        handovers,
        lastHandover: handovers[handovers.length - 1],
        totalHandovers: handovers.length
      };

    } catch (error) {
      logger.error('Error getting handover status', {
        leadId,
        error: (error as Error).message
      });
      throw error;
    }
  }
}