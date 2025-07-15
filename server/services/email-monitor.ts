import imaps, { ImapSimple } from 'imap-simple';
import { simpleParser } from 'mailparser';
import { db } from '../db';
import { leads } from '../db/schema';
import { logger } from '../utils/logger';

import 'dotenv/config';
import * as crypto from 'crypto';

interface LeadData {
  email: string;
  name?: string;
  metadata: Record<string, any>;
}

class EmailMonitor {
  private connection: ImapSimple | null = null;

  async start() {
    const config = {
      imap: {
        user: process.env.IMAP_USER!,
        password: process.env.IMAP_PASSWORD!,
        host: process.env.IMAP_HOST!,
        port: Number(process.env.IMAP_PORT!),
        tls: true,
        authTimeout: 3000,
        connTimeout: 10000,
      },
      onmail: this.handleNewMail.bind(this),
    };

    try {
      this.connection = await imaps.connect(config);
      await this.connection.openBox('INBOX');
      logger.info('Email monitor connected and listening');
    } catch (error) {
      logger.error('Failed to start email monitor:', error as Error);
      throw error;
    }
  }

  private async handleNewMail(numNewMails: number) {
    if (!this.connection) return;

    try {
      const searchCriteria = ['UNSEEN'];
      const fetchOptions = { bodies: [''], markSeen: true };
      const messages = await this.connection.search(searchCriteria, fetchOptions);

      for (const message of messages) {
        const all = message.parts.find((part: any) => part.which === '');
        if (!all?.body) continue;

        const parsed = await simpleParser(all.body);
        const leadData: LeadData = {
          email: parsed.from?.value[0].address || 'unknown',
          name: parsed.subject || 'New Lead',
          metadata: {
            body: parsed.text,
            html: parsed.html,
            from: parsed.from?.text,
            subject: parsed.subject,
          },
        };

        await this.createLead(leadData);
      }
    } catch (error) {
      logger.error('Error handling new mail:', error as Error);
    }
  }

  private async createLead(data: LeadData) {
    try {
      const newLead = {
        id: crypto.randomUUID(),
        name: data.name || 'Unnamed Lead',
        email: data.email,
        source: 'email',
        status: 'new',
        metadata: data.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as const;

      await db.insert(leads).values(newLead);
      logger.info(`Created new lead from email: ${newLead.id}`);
    } catch (error) {
      logger.error('Failed to create lead:', error as Error);
    }
  }

  async stop() {
    if (this.connection) {
      this.connection.end();
      this.connection = null;
      logger.info('Email monitor stopped');
    }
  }
}

export const emailMonitor = new EmailMonitor(); 