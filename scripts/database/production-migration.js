#!/usr/bin/env node
/**
 * PRODUCTION SCHEMA MIGRATION
 * This script can be run in the production environment to fix database schema
 * Deploy this and run it on Render where the database connection works
 */

import postgres from 'postgres';

async function runProductionMigration() {
  console.log('🚀 Starting Production Database Schema Migration...');
  
  // Use production environment DATABASE_URL
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable not found');
    process.exit(1);
  }
  
  console.log('🔌 Connecting to production database...');
  console.log('Host:', connectionString.split('@')[1]?.split('/')[0] || 'unknown');
  
  const sql = postgres(connectionString, {
    ssl: { rejectUnauthorized: false }, // Required for Render
    max: 1 // Single connection for migration
  });
  
  try {
    // Check current database state
    console.log('1️⃣ Checking current schema...');
    
    const currentColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'leads'
      ORDER BY ordinal_position
    `;
    
    const columnNames = currentColumns.map(c => c.column_name);
    console.log('📊 Current columns:', columnNames.join(', '));
    
    // Apply schema fixes
    console.log('2️⃣ Applying schema fixes...');
    
    const requiredColumns = [
      {
        name: 'campaign',
        sql: 'ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign TEXT'
      },
      {
        name: 'conversation_mode', 
        sql: 'ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversation_mode VARCHAR(20) DEFAULT \'template\''
      },
      {
        name: 'template_stage',
        sql: 'ALTER TABLE leads ADD COLUMN IF NOT EXISTS template_stage INTEGER DEFAULT 0'
      },
      {
        name: 'first_reply_at',
        sql: 'ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_reply_at TIMESTAMP'
      }
    ];
    
    for (const column of requiredColumns) {
      const exists = columnNames.includes(column.name);
      
      if (!exists) {
        console.log(`   Adding ${column.name}...`);
        await sql.unsafe(column.sql);
        console.log(`   ✅ Added ${column.name}`);
      } else {
        console.log(`   ✅ ${column.name} already exists`);
      }
    }
    
    // Create performance indexes
    console.log('3️⃣ Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign)',
      'CREATE INDEX IF NOT EXISTS idx_leads_conversation_mode ON leads(conversation_mode)',
      'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)',
      'CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)'
    ];
    
    for (const indexSql of indexes) {
      try {
        await sql.unsafe(indexSql);
        console.log(`   ✅ Index created`);
      } catch (error) {
        console.log(`   ⚠️ Index might already exist`);
      }
    }
    
    // Test the problematic query
    console.log('4️⃣ Testing queries...');
    
    const testQuery = await sql`
      SELECT id, name, email, campaign, conversation_mode, status, created_at
      FROM leads 
      LIMIT 3
    `;
    
    console.log('✅ Query test successful!');
    console.log('📊 Sample data:', testQuery.length, 'rows');
    
    // Show final schema
    console.log('5️⃣ Final schema verification...');
    
    const finalColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'leads'
      ORDER BY ordinal_position
    `;
    
    console.log('📋 Final columns:');
    finalColumns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Update any existing leads to have default values
    console.log('6️⃣ Setting default values for existing leads...');
    
    const updateResult = await sql`
      UPDATE leads 
      SET 
        conversation_mode = COALESCE(conversation_mode, 'template'),
        template_stage = COALESCE(template_stage, 0),
        campaign = COALESCE(campaign, '')
      WHERE conversation_mode IS NULL OR template_stage IS NULL OR campaign IS NULL
    `;
    
    console.log(`   ✅ Updated ${updateResult.count} leads with default values`);
    
    console.log('\n🎉 PRODUCTION MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('\n📋 SUMMARY:');
    console.log('✅ All required columns added');
    console.log('✅ Performance indexes created');
    console.log('✅ Query tests passed');
    console.log('✅ Default values set');
    console.log('\n🚀 Email system is now ready for testing!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('🔌 Database connection closed');
  }
}

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionMigration()
    .then(() => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error.message);
      process.exit(1);
    });
}

export { runProductionMigration };