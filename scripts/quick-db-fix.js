#!/usr/bin/env node
/**
 * Quick Database Fix - Adds missing columns that are causing the campaign error
 */

import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

const connectionString = process.env.DATABASE_URL || 'postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a/ccl_3';

async function quickDatabaseFix() {
  console.log('🔧 Starting quick database fix...');
  
  const sql = postgres(connectionString, {
    max: 1,
    ssl: { rejectUnauthorized: false } // Render requires SSL
  });
  
  try {
    console.log('🔌 Connecting to database...');
    
    // First, check if the leads table exists and what columns it has
    console.log('📊 Checking current leads table structure...');
    const existingColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
      ORDER BY ordinal_position
    `;
    
    console.log('Current columns in leads table:');
    console.table(existingColumns);
    
    // Check if campaign column exists
    const hasCampaign = existingColumns.some(col => col.column_name === 'campaign');
    console.log(`Campaign column exists: ${hasCampaign}`);
    
    if (!hasCampaign) {
      console.log('🔧 Adding missing campaign column...');
      await sql`ALTER TABLE leads ADD COLUMN campaign TEXT`;
      console.log('✅ Campaign column added');
    }
    
    // Check and add email conversation columns
    const hasConversationMode = existingColumns.some(col => col.column_name === 'conversation_mode');
    const hasTemplateStage = existingColumns.some(col => col.column_name === 'template_stage');
    const hasFirstReplyAt = existingColumns.some(col => col.column_name === 'first_reply_at');
    
    if (!hasConversationMode) {
      console.log('🔧 Adding conversation_mode column...');
      await sql`ALTER TABLE leads ADD COLUMN conversation_mode VARCHAR(20) DEFAULT 'template'`;
      console.log('✅ conversation_mode column added');
    }
    
    if (!hasTemplateStage) {
      console.log('🔧 Adding template_stage column...');
      await sql`ALTER TABLE leads ADD COLUMN template_stage INTEGER DEFAULT 0`;
      console.log('✅ template_stage column added');
    }
    
    if (!hasFirstReplyAt) {
      console.log('🔧 Adding first_reply_at column...');
      await sql`ALTER TABLE leads ADD COLUMN first_reply_at TIMESTAMP`;
      console.log('✅ first_reply_at column added');
    }
    
    // Create indexes for performance
    console.log('🔧 Creating performance indexes...');
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_leads_conversation_mode ON leads(conversation_mode)`;
      console.log('✅ Indexes created');
    } catch (indexError) {
      console.log('⚠️ Some indexes might already exist:', indexError.message);
    }
    
    // Test the problematic query
    console.log('🧪 Testing the query that was failing...');
    const testQuery = await sql`
      SELECT id, name, email, campaign, conversation_mode, status, created_at
      FROM leads 
      LIMIT 3
    `;
    
    console.log('✅ Query test successful! Sample data:');
    console.table(testQuery);
    
    // Show final column structure
    console.log('📊 Final leads table structure:');
    const finalColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
      ORDER BY ordinal_position
    `;
    console.table(finalColumns);
    
    console.log('🎉 Database fix completed successfully!');
    console.log('🚀 You can now test email functionality');
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the fix
quickDatabaseFix()
  .then(() => {
    console.log('✅ All done! Your database schema is now fixed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to fix database:', error);
    process.exit(1);
  });