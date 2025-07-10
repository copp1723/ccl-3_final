import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { leads } from '../server/db/schema.ts';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3';
const sql = postgres(connectionString);
const db = drizzle(sql);

async function seedTestLeads() {
  try {
    console.log('🌱 Seeding test leads...');

    const testLeads = [
      {
        name: 'John Smith',
        email: 'john.smith@company.com',
        phone: '+1-555-0101',
        status: 'new',
        qualificationScore: 8,
        source: 'website',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@startup.io',
        phone: '+1-555-0102',
        status: 'contacted',
        qualificationScore: 6,
        source: 'referral',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Mike Davis',
        email: 'mike.davis@enterprise.com',
        phone: '+1-555-0103',
        status: 'qualified',
        qualificationScore: 9,
        source: 'linkedin',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Emily Chen',
        email: 'emily.chen@tech.com',
        phone: '+1-555-0104',
        status: 'responded',
        qualificationScore: 7,
        source: 'webinar',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'David Wilson',
        email: 'david.wilson@business.com',
        phone: '+1-555-0105',
        status: 'new',
        qualificationScore: 5,
        source: 'cold_call',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Lisa Anderson',
        email: 'lisa.anderson@corp.com',
        phone: '+1-555-0106',
        status: 'qualified',
        qualificationScore: 8,
        source: 'trade_show',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert leads
    const insertedLeads = await db.insert(leads).values(testLeads).returning();
    
    console.log(`✅ Successfully created ${insertedLeads.length} test leads:`);
    insertedLeads.forEach(lead => {
      console.log(`  - ${lead.name} (${lead.email}) - ${lead.status} - Score: ${lead.qualificationScore}`);
    });

    console.log('\n🎉 Test leads seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding test leads:', error);
  } finally {
    await sql.end();
  }
}

seedTestLeads();