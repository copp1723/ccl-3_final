import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../email-system/database/schema.js';
import * as dotenv from 'dotenv';
import { seedAllTestData } from '../scripts/seed-all-test-data.js';

// Load test environment
dotenv.config({ path: '.env.test' });

export class DatabaseTestUtils {
  private sql: any;
  private db: any;
  private connectionString: string;

  constructor() {
    this.connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3_test';
  }

  async connect() {
    this.sql = postgres(this.connectionString);
    this.db = drizzle(this.sql, { schema });
    return this.db;
  }

  async disconnect() {
    if (this.sql) {
      await this.sql.end();
    }
  }

  getDb() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  async cleanDatabase() {
    console.log('🧹 Cleaning database...');
    
    // Delete in reverse order of foreign key dependencies
    await this.db.delete(schema.smsOptOuts);
    await this.db.delete(schema.smsMessageLog);
    await this.db.delete(schema.smsCampaignEnrollments);
    await this.db.delete(schema.smsCampaignSteps);
    await this.db.delete(schema.smsCampaigns);
    await this.db.delete(schema.smsTemplates);
    await this.db.delete(schema.campaignAttempts);
    await this.db.delete(schema.campaignSchedules);
    await this.db.delete(schema.agentActivity);
    await this.db.delete(schema.leads);
    await this.db.delete(schema.emailCampaigns);
    await this.db.delete(schema.chatSessions);
    await this.db.delete(schema.outreachAttempts);
    await this.db.delete(schema.visitors);
    await this.db.delete(schema.conversations);
    await this.db.delete(schema.campaignDrafts);
    await this.db.delete(schema.segments);
    await this.db.delete(schema.emailTemplates);
    await this.db.delete(schema.systemActivities);
    await this.db.delete(schema.systemAgents);
    await this.db.delete(schema.systemLeads);
    await this.db.delete(schema.agents);
    await this.db.delete(schema.queueJobs);
    await this.db.delete(schema.ingestedFiles);
    await this.db.delete(schema.userSessions);
    await this.db.delete(schema.users);
    
    console.log('✅ Database cleaned');
  }

  async seedTestData() {
    console.log('🌱 Seeding test data...');
    await seedAllTestData();
    console.log('✅ Test data seeded');
  }

  async resetDatabase() {
    await this.cleanDatabase();
    await this.seedTestData();
  }

  // Test data factories
  createTestVisitor(overrides = {}) {
    return {
      sessionId: `test-session-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      phoneNumber: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
      ipAddress: '192.168.1.100',
      userAgent: 'Test Browser',
      abandonmentStep: 1,
      abandonmentDetected: false,
      firstName: 'Test',
      lastName: 'User',
      ingestSource: 'test',
      ...overrides
    };
  }

  createTestLead(visitorId: number, overrides = {}) {
    return {
      visitorId,
      leadId: `TEST-LEAD-${Date.now()}`,
      contactEmail: `lead-${Date.now()}@example.com`,
      contactPhone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
      creditStatus: 'pending',
      source: 'test',
      leadData: {},
      status: 'pending' as const,
      ...overrides
    };
  }

  createTestEmailTemplate(overrides = {}) {
    return {
      name: `Test Template ${Date.now()}`,
      subject: 'Test Subject {{variable}}',
      body: '<p>Test body with {{variable}}</p>',
      ...overrides
    };
  }

  createTestSmsTemplate(overrides = {}) {
    return {
      name: `Test SMS Template ${Date.now()}`,
      messageTemplate: 'Test message {{variable}}',
      category: 'test',
      characterCount: 50,
      estimatedSegments: 1,
      variables: ['variable'],
      ...overrides
    };
  }

  // Query helpers
  async findVisitorByEmail(email: string) {
    const results = await this.db
      .select()
      .from(schema.visitors)
      .where(schema.visitors.email.eq(email))
      .limit(1);
    return results[0];
  }

  async findLeadById(leadId: string) {
    const results = await this.db
      .select()
      .from(schema.leads)
      .where(schema.leads.leadId.eq(leadId))
      .limit(1);
    return results[0];
  }

  async countOutreachAttempts(visitorId: number) {
    const results = await this.db
      .select({ count: schema.outreachAttempts.id })
      .from(schema.outreachAttempts)
      .where(schema.outreachAttempts.visitorId.eq(visitorId));
    return results.length;
  }

  // Assertion helpers
  async assertEmailSent(to: string, subject?: string) {
    const attempts = await this.db
      .select()
      .from(schema.outreachAttempts)
      .where(
        schema.outreachAttempts.channel.eq('email')
      );

    const emailAttempt = attempts.find(a => 
      a.messageContent?.includes(to) && 
      (!subject || a.messageContent?.includes(subject))
    );

    if (!emailAttempt) {
      throw new Error(`No email found sent to ${to}${subject ? ` with subject containing "${subject}"` : ''}`);
    }

    return emailAttempt;
  }

  async assertSmsSent(phoneNumber: string, content?: string) {
    const attempts = await this.db
      .select()
      .from(schema.outreachAttempts)
      .innerJoin(
        schema.visitors,
        schema.visitors.id.eq(schema.outreachAttempts.visitorId)
      )
      .where(
        schema.outreachAttempts.channel.eq('sms')
      );

    const smsAttempt = attempts.find(a => 
      a.visitors.phoneNumber === phoneNumber &&
      (!content || a.outreach_attempts.messageContent?.includes(content))
    );

    if (!smsAttempt) {
      throw new Error(`No SMS found sent to ${phoneNumber}${content ? ` with content containing "${content}"` : ''}`);
    }

    return smsAttempt;
  }
}

// Export singleton instance for tests
export const testDb = new DatabaseTestUtils();

// Export types
export type TestDb = typeof testDb;