import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../server/db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load test environment
dotenv.config({ path: '.env.test' });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3_test';
const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

async function seedFreshData() {
  console.log('🌱 Starting fresh data seeding...\n');

  try {
    // 1. Seed Users
    console.log('👤 Creating users...');
    const passwordHash = await bcrypt.hash('password123', 10);
    
    const users = await db.insert(schema.users).values([
      {
        email: 'admin@ccl.com',
        username: 'admin',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        active: true
      },
      {
        email: 'manager@ccl.com',
        username: 'manager',
        passwordHash,
        firstName: 'Manager',
        lastName: 'User',
        role: 'manager',
        active: true
      },
      {
        email: 'agent@ccl.com',
        username: 'agent',
        passwordHash,
        firstName: 'Agent',
        lastName: 'User',
        role: 'agent',
        active: true
      }
    ]).returning();
    console.log(`✅ Created ${users.length} users`);

    // 2. Seed Agent Configurations
    console.log('\n🤖 Creating agent configurations...');
    const agentConfigs = await db.insert(schema.agentConfigurations).values([
      {
        name: 'Email Sales Agent',
        type: 'email',
        active: true,
        systemPrompt: `You are a professional sales agent for Complete Car Loans. 
Your goal is to help customers find the best car loan options.
Be friendly, knowledgeable, and focus on understanding their needs.
Always maintain a professional tone and provide accurate information.`,
        contextNote: 'Focus on building trust and understanding customer financial situations',
        temperature: 7,
        maxTokens: 500,
        channelConfig: {
          fromName: 'Complete Car Loans Team',
          replyTo: 'support@completecarloans.com',
          signature: 'Best regards,\nThe Complete Car Loans Team'
        },
        metadata: { 
          modelVersion: 'gpt-4',
          lastUpdated: new Date().toISOString()
        }
      },
      {
        name: 'SMS Follow-up Agent',
        type: 'sms',
        active: true,
        systemPrompt: `You are an SMS agent for Complete Car Loans.
Keep messages brief, friendly, and action-oriented.
Maximum 160 characters per message.
Include clear call-to-action when appropriate.`,
        contextNote: 'Keep messages concise due to SMS character limits',
        temperature: 5,
        maxTokens: 50,
        channelConfig: {
          maxLength: 160,
          includeOptOut: true,
          linkShortening: true
        },
        responseDelay: 2,
        metadata: {
          compliance: 'TCPA compliant'
        }
      },
      {
        name: 'Chat Support Agent',
        type: 'chat',
        active: true,
        systemPrompt: `You are a live chat support agent for Complete Car Loans.
Provide instant, helpful responses to customer questions.
Be conversational but professional.
Guide customers through the loan application process.`,
        contextNote: 'Prioritize quick response times and clear guidance',
        temperature: 6,
        maxTokens: 300,
        channelConfig: {
          typingIndicator: true,
          maxWaitTime: 30,
          transferThreshold: 3
        },
        responseDelay: 1,
        metadata: {
          availability: '24/7',
          languages: ['en']
        }
      },
      {
        name: 'Voice Assistant (Inactive)',
        type: 'voice',
        active: false,
        systemPrompt: 'Voice assistant for phone interactions',
        contextNote: 'Not yet implemented',
        temperature: 5,
        maxTokens: 200,
        metadata: {
          status: 'planned'
        }
      }
    ]).returning();
    console.log(`✅ Created ${agentConfigs.length} agent configurations`);

    // 3. Seed Leads
    console.log('\n📋 Creating leads...');
    const leads = await db.insert(schema.leads).values([
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+15551234567',
        source: 'website',
        status: 'new',
        qualificationScore: 75,
        creditScore: 720,
        income: 75000,
        employer: 'Acme Corp',
        jobTitle: 'Manager',
        metadata: { referrer: 'google', campaign: 'summer-2024' }
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+15559876543',
        source: 'referral',
        status: 'contacted',
        qualificationScore: 65,
        creditScore: 680,
        income: 60000,
        employer: 'Tech Startup',
        jobTitle: 'Developer',
        metadata: { referredBy: 'john.doe@example.com' }
      },
      {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.johnson@example.com',
        phone: '+15555555555',
        source: 'paid_ad',
        status: 'qualified',
        qualificationScore: 85,
        creditScore: 750,
        income: 85000,
        employer: 'Fortune 500',
        jobTitle: 'Director',
        metadata: { adCampaign: 'fb-retargeting-q4' }
      },
      {
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice.williams@example.com',
        phone: '+15554443333',
        source: 'website',
        status: 'converted',
        qualificationScore: 90,
        creditScore: 780,
        income: 95000,
        employer: 'Big Bank',
        jobTitle: 'VP',
        metadata: { loanAmount: 35000, interestRate: 4.5 }
      }
    ]).returning();
    console.log(`✅ Created ${leads.length} leads`);

    // 3. Seed Templates
    console.log('\n📧 Creating templates...');
    const templates = await db.insert(schema.templates).values([
      // Email Templates
      {
        name: 'Welcome Email',
        description: 'Initial welcome email for new leads',
        channel: 'email',
        subject: 'Welcome to Complete Car Loans, {{firstName}}!',
        content: `<h1>Welcome {{firstName}}!</h1>
<p>Thank you for your interest in Complete Car Loans. We're excited to help you find the perfect financing solution.</p>
<p>Your dedicated agent will contact you within 24 hours to discuss your needs.</p>
<p>In the meantime, you can <a href="{{dashboardLink}}">visit your dashboard</a> to track your application.</p>`,
        variables: ['firstName', 'dashboardLink'],
        category: 'onboarding',
        active: true
      },
      {
        name: 'Application Follow-up',
        description: 'Follow up on incomplete applications',
        channel: 'email',
        subject: 'Complete Your Car Loan Application',
        content: `<p>Hi {{firstName}},</p>
<p>We noticed you started a loan application but haven't completed it yet.</p>
<p>You're just a few steps away from getting approved! <a href="{{applicationLink}}">Click here to continue</a>.</p>
<p>If you have any questions, reply to this email or call us at 1-800-CAR-LOAN.</p>`,
        variables: ['firstName', 'applicationLink'],
        category: 'follow-up',
        active: true
      },
      // SMS Templates
      {
        name: 'SMS Welcome',
        description: 'Welcome SMS for new leads',
        channel: 'sms',
        content: 'Hi {{firstName}}, welcome to Complete Car Loans! Your agent will call you soon. Reply STOP to opt out.',
        variables: ['firstName'],
        category: 'onboarding',
        active: true
      },
      {
        name: 'SMS Reminder',
        description: 'Application reminder SMS',
        channel: 'sms',
        content: '{{firstName}}, complete your car loan application here: {{shortLink}}. Questions? Call 1-800-CAR-LOAN',
        variables: ['firstName', 'shortLink'],
        category: 'follow-up',
        active: true
      }
    ]).returning();
    console.log(`✅ Created ${templates.length} templates`);

    // 4. Seed Campaigns
    console.log('\n📊 Creating campaigns...');
    const campaigns = await db.insert(schema.campaigns).values([
      {
        name: 'New Lead Welcome Series',
        description: 'Automated welcome series for new leads',
        type: 'drip',
        active: true,
        targetCriteria: { 
          status: ['new'],
          minScore: 50 
        },
        settings: {
          maxAttempts: 3,
          stopOnResponse: true
        }
      },
      {
        name: 'Abandoned Application Recovery',
        description: 'Re-engage leads who started but didn\'t complete application',
        type: 'trigger',
        active: true,
        targetCriteria: {
          status: ['contacted'],
          daysSinceLastContact: 3
        },
        settings: {
          urgency: 'high',
          personalizeContent: true
        }
      },
      {
        name: 'Monthly Newsletter',
        description: 'Monthly updates and tips',
        type: 'blast',
        active: true,
        targetCriteria: {
          subscribed: true
        },
        settings: {
          sendTime: '10:00',
          timezone: 'America/Chicago'
        }
      }
    ]).returning();
    console.log(`✅ Created ${campaigns.length} campaigns`);

    // 5. Seed Campaign Steps
    console.log('\n📝 Creating campaign steps...');
    const campaignSteps = await db.insert(schema.campaignSteps).values([
      // Welcome Series Steps
      {
        campaignId: campaigns[0].id,
        templateId: templates[0].id, // Welcome Email
        stepOrder: 1,
        delayMinutes: 0, // Immediate
        conditions: {},
        active: true
      },
      {
        campaignId: campaigns[0].id,
        templateId: templates[2].id, // SMS Welcome
        stepOrder: 2,
        delayMinutes: 60, // 1 hour later
        conditions: { hasPhone: true },
        active: true
      },
      // Abandoned Application Steps
      {
        campaignId: campaigns[1].id,
        templateId: templates[1].id, // Application Follow-up Email
        stepOrder: 1,
        delayMinutes: 0,
        conditions: {},
        active: true
      },
      {
        campaignId: campaigns[1].id,
        templateId: templates[3].id, // SMS Reminder
        stepOrder: 2,
        delayMinutes: 1440, // 24 hours later
        conditions: { hasPhone: true, noEmailResponse: true },
        active: true
      }
    ]).returning();
    console.log(`✅ Created ${campaignSteps.length} campaign steps`);

    // 6. Seed Lead Campaign Enrollments
    console.log('\n🎯 Enrolling leads in campaigns...');
    const enrollments = await db.insert(schema.leadCampaignEnrollments).values([
      {
        leadId: leads[0].id, // John Doe
        campaignId: campaigns[0].id, // Welcome Series
        currentStep: 1,
        status: 'active'
      },
      {
        leadId: leads[1].id, // Jane Smith
        campaignId: campaigns[1].id, // Abandoned Application
        currentStep: 0,
        status: 'active'
      }
    ]).returning();
    console.log(`✅ Created ${enrollments.length} campaign enrollments`);

    // 7. Seed Communications
    console.log('\n💬 Creating communications...');
    const communications = await db.insert(schema.communications).values([
      {
        leadId: leads[0].id,
        campaignId: campaigns[0].id,
        channel: 'email',
        direction: 'outbound',
        status: 'sent',
        subject: 'Welcome to Complete Car Loans, John!',
        content: '<h1>Welcome John!</h1><p>Thank you for your interest...</p>',
        externalId: 'msg_01234567890',
        sentAt: new Date(),
        metadata: { templateId: templates[0].id }
      },
      {
        leadId: leads[1].id,
        channel: 'email',
        direction: 'inbound',
        status: 'received',
        subject: 'Re: Complete Your Car Loan Application',
        content: 'I have a question about the interest rates...',
        metadata: { source: 'email-reply' }
      },
      {
        leadId: leads[2].id,
        channel: 'sms',
        direction: 'outbound',
        status: 'delivered',
        content: 'Bob, complete your car loan application here: ccl.co/abc123',
        externalId: 'SM1234567890',
        sentAt: new Date(),
        deliveredAt: new Date(),
        metadata: { shortLink: 'ccl.co/abc123' }
      }
    ]).returning();
    console.log(`✅ Created ${communications.length} communications`);

    // 8. Seed Sessions (for testing auth)
    console.log('\n🔐 Creating test sessions...');
    const sessions = await db.insert(schema.sessions).values([
      {
        userId: users[0].id, // Admin user
        token: 'test-admin-token-' + uuidv4(),
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    ]).returning();
    console.log(`✅ Created ${sessions.length} sessions`);

    // 9. Seed Audit Logs
    console.log('\n📋 Creating audit logs...');
    const auditLogs = await db.insert(schema.auditLogs).values([
      {
        userId: users[0].id,
        action: 'create',
        resource: 'lead',
        resourceId: leads[0].id,
        changes: { status: { from: null, to: 'new' } },
        ipAddress: '127.0.0.1'
      },
      {
        userId: users[2].id,
        action: 'update',
        resource: 'lead',
        resourceId: leads[1].id,
        changes: { status: { from: 'new', to: 'contacted' } },
        ipAddress: '127.0.0.1'
      }
    ]).returning();
    console.log(`✅ Created ${auditLogs.length} audit logs`);

    console.log('\n🎉 Fresh data seeding completed successfully!');
    
    // Verify data
    console.log('\n📊 Data verification:');
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM agent_configurations) as agent_configs,
        (SELECT COUNT(*) FROM leads) as leads,
        (SELECT COUNT(*) FROM templates) as templates,
        (SELECT COUNT(*) FROM campaigns) as campaigns,
        (SELECT COUNT(*) FROM campaign_steps) as campaign_steps,
        (SELECT COUNT(*) FROM lead_campaign_enrollments) as enrollments,
        (SELECT COUNT(*) FROM communications) as communications,
        (SELECT COUNT(*) FROM sessions) as sessions,
        (SELECT COUNT(*) FROM audit_logs) as audit_logs
    `;
    
    const count = counts[0];
    console.log(`  - Users: ${count.users}`);
    console.log(`  - Agent Configurations: ${count.agent_configs}`);
    console.log(`  - Leads: ${count.leads}`);
    console.log(`  - Templates: ${count.templates}`);
    console.log(`  - Campaigns: ${count.campaigns}`);
    console.log(`  - Campaign Steps: ${count.campaign_steps}`);
    console.log(`  - Enrollments: ${count.enrollments}`);
    console.log(`  - Communications: ${count.communications}`);
    console.log(`  - Sessions: ${count.sessions}`);
    console.log(`  - Audit Logs: ${count.audit_logs}`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedFreshData();
}

export { seedFreshData };