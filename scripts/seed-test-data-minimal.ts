import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3_test';
const sql = postgres(connectionString);
const db = drizzle(sql);

async function seedMinimalTestData() {
  console.log('🌱 Starting minimal test data seeding...\n');

  try {
    // 1. Seed Leads (core table that exists in migration)
    console.log('📋 Seeding leads...');
    const leadIds = [uuidv4(), uuidv4(), uuidv4()];
    
    await sql`
      INSERT INTO leads (id, name, email, phone, source, status, qualification_score, metadata)
      VALUES 
        (${leadIds[0]}, 'John Doe', 'john.doe@example.com', '+15551234567', 'website', 'new', 75, ${JSON.stringify({
          creditScore: 720,
          income: 75000,
          employer: 'Acme Corp'
        })}),
        (${leadIds[1]}, 'Jane Smith', 'jane.smith@example.com', '+15559876543', 'referral', 'contacted', 65, ${JSON.stringify({
          creditScore: 680,
          income: 60000
        })}),
        (${leadIds[2]}, 'Bob Johnson', 'bob.johnson@example.com', '+15555555555', 'campaign', 'qualified', 85, ${JSON.stringify({
          creditScore: 750,
          income: 85000,
          employer: 'Tech Corp',
          approved: true
        })})
    `;
    console.log(`✅ Created 3 test leads`);

    // 2. Seed Campaigns
    console.log('\n📊 Seeding campaigns...');
    const campaignId = uuidv4();
    
    await sql`
      INSERT INTO campaigns (id, name, goals, qualification_criteria, channel_preferences, active)
      VALUES (
        ${campaignId}, 
        'Test Abandonment Campaign',
        ${JSON.stringify(['recover_abandonment', 'qualify_leads'])},
        ${JSON.stringify({ minCreditScore: 650, minIncome: 50000 })},
        ${JSON.stringify({ primary: 'email', secondary: 'sms' })},
        true
      )
    `;
    console.log(`✅ Created 1 test campaign`);

    // 3. Seed Communications
    console.log('\n📧 Seeding communications...');
    await sql`
      INSERT INTO communications (id, lead_id, channel, direction, content, status, metadata)
      VALUES 
        (${uuidv4()}, ${leadIds[0]}, 'email', 'outbound', 'Welcome to Complete Car Loans!', 'sent', ${JSON.stringify({
          templateId: 'welcome',
          sentAt: new Date()
        })}),
        (${uuidv4()}, ${leadIds[1]}, 'sms', 'outbound', 'Complete your application: bit.ly/ccl123', 'delivered', ${JSON.stringify({
          templateId: 'abandonment',
          sentAt: new Date()
        })}),
        (${uuidv4()}, ${leadIds[0]}, 'email', 'inbound', 'I am interested in a loan', 'received', ${JSON.stringify({
          receivedAt: new Date()
        })})
    `;
    console.log(`✅ Created 3 test communications`);

    // 4. Seed Conversations
    console.log('\n💬 Seeding conversations...');
    await sql`
      INSERT INTO conversations (id, lead_id, channel, agent_type, messages, status)
      VALUES (
        ${uuidv4()}, 
        ${leadIds[0]}, 
        'chat', 
        'chat',
        ${JSON.stringify([
          { role: 'assistant', content: 'Hello! How can I help you today?', timestamp: new Date() },
          { role: 'user', content: 'I need help with my loan application', timestamp: new Date() },
          { role: 'assistant', content: 'I\'d be happy to help! What specific questions do you have?', timestamp: new Date() }
        ])},
        'active'
      )
    `;
    console.log(`✅ Created 1 test conversation`);

    // 5. Seed Agent Decisions
    console.log('\n🤖 Seeding agent decisions...');
    await sql`
      INSERT INTO agent_decisions (id, lead_id, agent_type, decision, reasoning, context)
      VALUES 
        (${uuidv4()}, ${leadIds[0]}, 'email', 'send_welcome', 'New lead requires welcome email', ${JSON.stringify({
          templateSelected: 'welcome',
          priority: 'high'
        })}),
        (${uuidv4()}, ${leadIds[2]}, 'overlord', 'qualify_lead', 'Lead meets all qualification criteria', ${JSON.stringify({
          score: 85,
          criteria: { creditScore: 750, income: 85000 }
        })})
    `;
    console.log(`✅ Created 2 test agent decisions`);

    // 6. Seed users (table exists from migration)
    console.log('\n👤 Seeding users...');
    
    // Check if users already exist
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    
    if (userCount[0].count === 0) {
      // Seed users
      await sql`
        INSERT INTO users (id, email, username, password_hash, role, first_name, last_name)
        VALUES 
          (${uuidv4()}, 'admin@ccl.com', 'admin', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'admin', 'Admin', 'User'),
          (${uuidv4()}, 'agent@ccl.com', 'agent1', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'agent', 'Test', 'Agent'),
          (${uuidv4()}, 'test@ccl.com', 'testuser', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'agent', 'Test', 'User')
      `;
      console.log(`✅ Created 3 test users`);
    } else {
      console.log(`ℹ️  Users already exist, skipping...`);
    }

    console.log('\n🎉 Minimal test data seeding completed successfully!');
    
    // Verify data
    console.log('\n📊 Data verification:');
    const leadCount = await sql`SELECT COUNT(*) as count FROM leads`;
    const campaignCount = await sql`SELECT COUNT(*) as count FROM campaigns`;
    const commCount = await sql`SELECT COUNT(*) as count FROM communications`;
    
    console.log(`  - Leads: ${leadCount[0].count}`);
    console.log(`  - Campaigns: ${campaignCount[0].count}`);
    console.log(`  - Communications: ${commCount[0].count}`);

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMinimalTestData();
}

export { seedMinimalTestData };