import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../server/db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3_test';
const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

async function seedAllTestData() {
  console.log('🌱 Starting comprehensive test data seeding...\n');

  try {
    // 1. Seed Users
    console.log('👤 Seeding users...');
    const users = await db.insert(schema.users).values([
      { username: 'admin', password: '$2b$10$abcdefghijklmnopqrstuvwxyz' }, // bcrypt hash of "admin123"
      { username: 'agent1', password: '$2b$10$abcdefghijklmnopqrstuvwxyz' },
      { username: 'testuser', password: '$2b$10$abcdefghijklmnopqrstuvwxyz' }
    ]).returning();
    console.log(`✅ Created ${users.length} users`);

    // 2. Seed Visitors
    console.log('\n🚶 Seeding visitors...');
    const visitors = await db.insert(schema.visitors).values([
      {
        sessionId: 'test-session-001',
        email: 'john.doe@example.com',
        phoneNumber: '+15551234567',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        abandonmentStep: 2,
        abandonmentDetected: true,
        firstName: 'John',
        lastName: 'Doe',
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        employer: 'Acme Corp',
        jobTitle: 'Manager',
        annualIncome: 75000,
        timeOnJobMonths: 36,
        piiComplete: true,
        creditScore: 720,
        ingestSource: 'website'
      },
      {
        sessionId: 'test-session-002',
        email: 'jane.smith@example.com',
        phoneNumber: '+15559876543',
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 Test Browser',
        abandonmentStep: 1,
        abandonmentDetected: true,
        firstName: 'Jane',
        lastName: 'Smith',
        piiComplete: false,
        ingestSource: 'sftp'
      },
      {
        sessionId: 'test-session-003',
        email: 'bob.johnson@example.com',
        phoneNumber: '+15555555555',
        ipAddress: '192.168.1.3',
        userAgent: 'Mozilla/5.0 Test Browser',
        abandonmentStep: 3,
        abandonmentDetected: false,
        firstName: 'Bob',
        lastName: 'Johnson',
        street: '456 Oak St',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        piiComplete: true,
        creditScore: 650,
        ingestSource: 'api'
      }
    ]).returning();
    console.log(`✅ Created ${visitors.length} visitors`);

    // 3. Seed System Leads
    console.log('\n📋 Seeding system leads...');
    const systemLeads = await db.insert(schema.systemLeads).values([
      {
        id: uuidv4(),
        email: 'qualified.lead@example.com',
        status: 'qualified',
        leadData: {
          name: 'Qualified Lead',
          phone: '+15551112222',
          income: 80000,
          creditScore: 750
        },
        creditScore: 750,
        approvedAmount: 35000,
        interestRate: '4.5%',
        boberdooStatus: 'accepted'
      },
      {
        id: uuidv4(),
        email: 'new.lead@example.com',
        status: 'new',
        leadData: {
          name: 'New Lead',
          phone: '+15553334444',
          income: 60000
        },
        boberdooStatus: 'pending'
      },
      {
        id: uuidv4(),
        email: 'contacted.lead@example.com',
        status: 'contacted',
        leadData: {
          name: 'Contacted Lead',
          phone: '+15556667777',
          income: 70000,
          creditScore: 680
        },
        creditScore: 680,
        boberdooStatus: 'submitted',
        submissionAttempts: 1
      }
    ]).returning();
    console.log(`✅ Created ${systemLeads.length} system leads`);

    // 4. Seed Email Templates
    console.log('\n📧 Seeding email templates...');
    const emailTemplates = await db.insert(schema.emailTemplates).values([
      {
        name: 'Welcome Email',
        subject: 'Welcome to Complete Car Loans!',
        body: '<h1>Welcome {{firstName}}!</h1><p>Thank you for your interest in Complete Car Loans.</p>'
      },
      {
        name: 'Abandonment Follow-up',
        subject: 'Complete Your Application',
        body: '<p>Hi {{firstName}}, we noticed you started an application. Click here to continue: {{returnLink}}</p>'
      },
      {
        name: 'Approved Notification',
        subject: 'Congratulations! You\'re Approved',
        body: '<h2>Great news {{firstName}}!</h2><p>You\'ve been approved for ${{approvedAmount}}.</p>'
      }
    ]).returning();
    console.log(`✅ Created ${emailTemplates.length} email templates`);

    // 5. Seed SMS Templates
    console.log('\n💬 Seeding SMS templates...');
    const smsTemplates = await db.insert(schema.smsTemplates).values([
      {
        name: 'Quick Follow-up',
        messageTemplate: 'Hi {{firstName}}, complete your car loan application here: {{shortLink}}',
        category: 'abandonment',
        characterCount: 65,
        estimatedSegments: 1,
        variables: ['firstName', 'shortLink']
      },
      {
        name: 'Approval SMS',
        messageTemplate: '🎉 Congrats {{firstName}}! You\'re approved for ${{amount}}. Call {{phone}} to finalize.',
        category: 'approval',
        characterCount: 85,
        estimatedSegments: 1,
        variables: ['firstName', 'amount', 'phone']
      },
      {
        name: 'Reminder SMS',
        messageTemplate: 'Reminder: Your car loan application expires soon. Complete it now: {{link}}',
        category: 'reminder',
        characterCount: 75,
        estimatedSegments: 1,
        variables: ['link']
      }
    ]).returning();
    console.log(`✅ Created ${smsTemplates.length} SMS templates`);

    // 6. Seed SMS Campaigns
    console.log('\n📱 Seeding SMS campaigns...');
    const smsCampaigns = await db.insert(schema.smsCampaigns).values([
      {
        name: 'Abandonment Recovery Campaign',
        description: 'Multi-step campaign to recover abandoned applications',
        campaignType: 'drip',
        isActive: true,
        targetCriteria: { abandonmentDetected: true, piiComplete: false },
        allowedHours: { start: '09:00', end: '20:00' },
        allowedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        timeZone: 'America/Chicago'
      },
      {
        name: 'Lead Nurture Campaign',
        description: 'Nurture qualified leads to conversion',
        campaignType: 'nurture',
        isActive: true,
        targetCriteria: { status: 'qualified' },
        allowedHours: { start: '10:00', end: '18:00' },
        allowedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      }
    ]).returning();
    console.log(`✅ Created ${smsCampaigns.length} SMS campaigns`);

    // 7. Seed Campaign Steps
    console.log('\n📊 Seeding campaign steps...');
    const campaignSteps = await db.insert(schema.smsCampaignSteps).values([
      {
        campaignId: smsCampaigns[0].id,
        templateId: smsTemplates[0].id,
        sequenceOrder: 1,
        delayMinutes: 60, // 1 hour after enrollment
        sendWindow: { preferredTime: '10:00' }
      },
      {
        campaignId: smsCampaigns[0].id,
        templateId: smsTemplates[2].id,
        sequenceOrder: 2,
        delayMinutes: 1440, // 24 hours after first message
        sendWindow: { preferredTime: '14:00' }
      },
      {
        campaignId: smsCampaigns[1].id,
        templateId: smsTemplates[1].id,
        sequenceOrder: 1,
        delayMinutes: 0, // Immediate
        sendConditions: { creditScore: { min: 650 } }
      }
    ]).returning();
    console.log(`✅ Created ${campaignSteps.length} campaign steps`);

    // 8. Seed Agents
    console.log('\n🤖 Seeding agents...');
    const agents = await db.insert(schema.agents).values([
      {
        name: 'Email Agent',
        email: 'email-agent@system.local',
        role: 'email_automation'
      },
      {
        name: 'SMS Agent',
        email: 'sms-agent@system.local',
        role: 'sms_automation'
      },
      {
        name: 'Lead Qualifier',
        email: 'qualifier@system.local',
        role: 'lead_qualification'
      }
    ]).returning();
    console.log(`✅ Created ${agents.length} agents`);

    // 9. Seed System Agents
    console.log('\n🎯 Seeding system agents...');
    const systemAgents = await db.insert(schema.systemAgents).values([
      {
        id: 'email-agent-001',
        name: 'Email Automation Agent',
        status: 'active',
        description: 'Handles automated email campaigns',
        icon: '📧',
        color: '#3B82F6',
        processedToday: 25
      },
      {
        id: 'sms-agent-001',
        name: 'SMS Campaign Agent',
        status: 'active',
        description: 'Manages SMS outreach campaigns',
        icon: '💬',
        color: '#10B981',
        processedToday: 42
      },
      {
        id: 'lead-qualifier-001',
        name: 'Lead Qualification Agent',
        status: 'active',
        description: 'Qualifies and scores incoming leads',
        icon: '🎯',
        color: '#F59E0B',
        processedToday: 18
      }
    ]).returning();
    console.log(`✅ Created ${systemAgents.length} system agents`);

    // 10. Seed Leads (connected to visitors)
    console.log('\n🎪 Seeding leads...');
    const leads = await db.insert(schema.leads).values([
      {
        visitorId: visitors[0].id,
        leadId: 'LEAD-001',
        contactEmail: visitors[0].email,
        contactPhone: visitors[0].phoneNumber,
        creditStatus: 'approved',
        leadData: {
          ...visitors[0],
          qualificationScore: 85
        },
        status: 'submitted',
        dealerCrmSubmitted: true
      },
      {
        visitorId: visitors[1].id,
        leadId: 'LEAD-002',
        contactEmail: visitors[1].email,
        contactPhone: visitors[1].phoneNumber,
        creditStatus: 'pending',
        leadData: {
          ...visitors[1],
          qualificationScore: 65
        },
        status: 'processing'
      }
    ]).returning();
    console.log(`✅ Created ${leads.length} leads`);

    // 11. Seed Campaign Schedules
    console.log('\n📅 Seeding campaign schedules...');
    const campaignSchedules = await db.insert(schema.campaignSchedules).values([
      {
        id: uuidv4(),
        name: 'Standard Follow-up Schedule',
        description: '3-attempt email follow-up for abandoned applications',
        isActive: true,
        attempts: [
          { attemptNumber: 1, delayHours: 1, templateId: emailTemplates[1].id },
          { attemptNumber: 2, delayHours: 24, templateId: emailTemplates[1].id },
          { attemptNumber: 3, delayHours: 72, templateId: emailTemplates[1].id }
        ]
      }
    ]).returning();
    console.log(`✅ Created ${campaignSchedules.length} campaign schedules`);

    // 12. Seed Outreach Attempts
    console.log('\n📤 Seeding outreach attempts...');
    const outreachAttempts = await db.insert(schema.outreachAttempts).values([
      {
        visitorId: visitors[0].id,
        channel: 'email',
        messageContent: 'Test email content',
        externalMessageId: 'mailgun-msg-001',
        status: 'delivered',
        deliveredAt: new Date()
      },
      {
        visitorId: visitors[0].id,
        channel: 'sms',
        messageContent: 'Test SMS content',
        externalMessageId: 'twilio-msg-001',
        status: 'sent'
      },
      {
        visitorId: visitors[1].id,
        channel: 'email',
        messageContent: 'Follow-up email',
        status: 'failed',
        errorMessage: 'Invalid email address'
      }
    ]).returning();
    console.log(`✅ Created ${outreachAttempts.length} outreach attempts`);

    // 13. Seed Chat Sessions
    console.log('\n💬 Seeding chat sessions...');
    const chatSessions = await db.insert(schema.chatSessions).values([
      {
        sessionId: 'chat-session-001',
        visitorId: visitors[0].id,
        isActive: false,
        messages: [
          { role: 'assistant', content: 'Hello! How can I help you today?' },
          { role: 'user', content: 'I need help with my loan application' },
          { role: 'assistant', content: 'I\'d be happy to help! What specific questions do you have?' }
        ]
      }
    ]).returning();
    console.log(`✅ Created ${chatSessions.length} chat sessions`);

    // 14. Seed System Activities
    console.log('\n📊 Seeding system activities...');
    const activities = await db.insert(schema.systemActivities).values([
      {
        id: uuidv4(),
        type: 'lead_qualified',
        description: 'Lead qualified with score 85',
        agentType: 'qualifier',
        metadata: { leadId: leads[0].id, score: 85 }
      },
      {
        id: uuidv4(),
        type: 'email_sent',
        description: 'Welcome email sent',
        agentType: 'email',
        metadata: { templateId: emailTemplates[0].id, recipientEmail: visitors[0].email }
      },
      {
        id: uuidv4(),
        type: 'sms_campaign_enrolled',
        description: 'Lead enrolled in abandonment campaign',
        agentType: 'sms',
        metadata: { campaignId: smsCampaigns[0].id, leadId: systemLeads[1].id }
      }
    ]).returning();
    console.log(`✅ Created ${activities.length} system activities`);

    console.log('\n🎉 Test data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Users: ${users.length}`);
    console.log(`  - Visitors: ${visitors.length}`);
    console.log(`  - System Leads: ${systemLeads.length}`);
    console.log(`  - Email Templates: ${emailTemplates.length}`);
    console.log(`  - SMS Templates: ${smsTemplates.length}`);
    console.log(`  - SMS Campaigns: ${smsCampaigns.length}`);
    console.log(`  - Campaign Steps: ${campaignSteps.length}`);
    console.log(`  - Agents: ${agents.length}`);
    console.log(`  - System Agents: ${systemAgents.length}`);
    console.log(`  - Leads: ${leads.length}`);
    console.log(`  - Outreach Attempts: ${outreachAttempts.length}`);
    console.log(`  - Chat Sessions: ${chatSessions.length}`);
    console.log(`  - System Activities: ${activities.length}`);

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAllTestData();
}

export { seedAllTestData };