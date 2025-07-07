import { db } from './server/db/client';
import { leads } from './server/db/schema';

async function testDB() {
  try {
    console.log('Testing database connection...');
    const result = await db.select().from(leads).limit(1);
    console.log('✅ Database connection successful');
    console.log('Leads count:', result.length);
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testDB();