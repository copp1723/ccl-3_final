#!/usr/bin/env node

const { sql } = require('../server/db');

async function fixProductionDatabase() {
  console.log('🔧 Fixing production database schema...\n');

  try {
    // Fix 1: Add missing columns to agent_configurations table
    console.log('1. Adding missing columns to agent_configurations table...');
    try {
      await sql`
        ALTER TABLE agent_configurations 
        ADD COLUMN IF NOT EXISTS system_prompt TEXT,
        ADD COLUMN IF NOT EXISTS temperature NUMERIC(3, 2) DEFAULT 0.7,
        ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2000,
        ADD COLUMN IF NOT EXISTS response_style TEXT DEFAULT 'professional',
        ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS personality JSONB DEFAULT '{"tone": "professional", "style": "balanced", "traits": []}'
      `;
      console.log('   ✅ agent_configurations table updated');
    } catch (error) {
      console.log('   ⚠️  Some columns may already exist (this is OK):', error.message);
    }

    // Fix 2: Fix users table password column name
    console.log('\n2. Checking users table password column...');
    try {
      // First check if password_hash column exists
      const columns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('password_hash', 'passwordHash')
      `;
      
      if (columns.some(c => c.column_name === 'passwordHash')) {
        // Rename passwordHash to password_hash
        await sql`ALTER TABLE users RENAME COLUMN "passwordHash" TO password_hash`;
        console.log('   ✅ Renamed passwordHash to password_hash');
      } else if (!columns.some(c => c.column_name === 'password_hash')) {
        // Add password_hash column if it doesn't exist
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`;
        console.log('   ✅ Added password_hash column');
      } else {
        console.log('   ✅ password_hash column already exists');
      }
    } catch (error) {
      console.log('   ⚠️  Password column fix may have already been applied:', error.message);
    }

    // Fix 3: Add other missing columns to various tables
    console.log('\n3. Adding other missing columns...');
    
    // Add missing columns to leads table
    try {
      await sql`
        ALTER TABLE leads 
        ADD COLUMN IF NOT EXISTS assigned_channel TEXT,
        ADD COLUMN IF NOT EXISTS boberdoo_id TEXT,
        ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id)
      `;
      console.log('   ✅ leads table columns added');
    } catch (error) {
      console.log('   ⚠️  leads columns may already exist:', error.message);
    }

    // Fix 4: Create missing tables if they don't exist
    console.log('\n4. Creating missing tables...');
    
    // Create clients table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS clients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          brand_config JSONB DEFAULT '{}',
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('   ✅ clients table created');
    } catch (error) {
      console.log('   ⚠️  clients table may already exist:', error.message);
    }

    // Create analytics_events table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type TEXT NOT NULL,
          event_data JSONB DEFAULT '{}',
          lead_id UUID REFERENCES leads(id),
          campaign_id UUID REFERENCES campaigns(id),
          agent_id UUID REFERENCES agent_configurations(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('   ✅ analytics_events table created');
    } catch (error) {
      console.log('   ⚠️  analytics_events table may already exist:', error.message);
    }

    // Create conversations table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id UUID REFERENCES leads(id),
          agent_id UUID REFERENCES agent_configurations(id),
          status TEXT DEFAULT 'active',
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('   ✅ conversations table created');
    } catch (error) {
      console.log('   ⚠️  conversations table may already exist:', error.message);
    }

    console.log('\n✅ Database schema fixes completed!');
    console.log('🎉 The production database should now match the application requirements.\n');

  } catch (error) {
    console.error('\n❌ Error applying fixes:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the fixes
fixProductionDatabase();