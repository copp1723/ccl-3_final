import 'dotenv/config';
import { db } from './db/client.js';
import { logger } from './utils/logger.js';

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await db.execute('SELECT 1 as test');
    console.log('✅ Database connection successful');
    
    // Test if tables exist
    const result = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('📋 Available tables:', result.rows.map(r => r.table_name));
    
    // Test specific repositories
    console.log('\n🧪 Testing repositories...');
    
    // Test leads
    try {
      const { LeadsRepository } = await import('./db/leads-repository.js');
      const leads = await LeadsRepository.findAll({ limit: 1 });
      console.log('✅ LeadsRepository working');
    } catch (error) {
      console.log('❌ LeadsRepository error:', error.message);
    }
    
    // Test agent configurations
    try {
      const { AgentConfigurationsRepository } = await import('./db/agent-configurations-repository.js');
      const agents = await AgentConfigurationsRepository.findAll({});
      console.log('✅ AgentConfigurationsRepository working');
    } catch (error) {
      console.log('❌ AgentConfigurationsRepository error:', error.message);
    }
    
    console.log('\n✅ Database diagnostic complete');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('\n💡 Troubleshooting steps:');
    console.log('1. Ensure PostgreSQL is running: brew services start postgresql');
    console.log('2. Create database: createdb ccl3_swarm');
    console.log('3. Run migrations: npm run db:push');
  }
  
  process.exit(0);
}

testDatabaseConnection();
