#!/usr/bin/env node
/**
 * DATABASE CHECKER
 * Quickly check if the database schema issues are resolved
 */

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a/ccl_3';

async function checkDatabaseStatus() {
  const sql = postgres(connectionString, { ssl: { rejectUnauthorized: false } });
  
  console.log('🔍 Checking Database Status...');
  
  try {
    // Check if leads table exists
    const tableCheck = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'leads'
    `;
    
    if (tableCheck.length === 0) {
      console.log('❌ Leads table does not exist');
      return false;
    }
    
    console.log('✅ Leads table exists');
    
    // Check required columns
    const columns = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'leads'
      ORDER BY ordinal_position
    `;
    
    const columnNames = columns.map(c => c.column_name);
    
    const requiredColumns = [
      'id', 'name', 'email', 'campaign', 
      'conversation_mode', 'template_stage', 'first_reply_at'
    ];
    
    console.log('\n📊 Column Status:');
    for (const col of requiredColumns) {
      const exists = columnNames.includes(col);
      console.log(`${exists ? '✅' : '❌'} ${col}`);
    }
    
    // Test the problematic query
    console.log('\n🧪 Testing problematic query...');
    try {
      const testQuery = await sql`
        SELECT id, campaign, conversation_mode 
        FROM leads 
        LIMIT 1
      `;
      console.log('✅ Query test passed - no "column does not exist" errors');
    } catch (queryError) {
      console.log('❌ Query test failed:', queryError.message);
      return false;
    }
    
    // Count existing leads
    const leadCount = await sql`SELECT COUNT(*) as count FROM leads`;
    console.log(`\n📈 Current leads in database: ${leadCount[0].count}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    return false;
  } finally {
    await sql.end();
  }
}

// Run the check
checkDatabaseStatus()
  .then((isHealthy) => {
    if (isHealthy) {
      console.log('\n🎉 Database is healthy! Email system should work.');
      console.log('\n🚀 You can now run: node test-email-system.js');
    } else {
      console.log('\n⚠️ Database needs fixing. Run: node emergency-db-fix.js');
    }
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
  });