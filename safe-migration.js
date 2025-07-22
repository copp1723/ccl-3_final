import postgres from 'postgres';

const connectionString = "postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3";

const sql = postgres(connectionString, {
  ssl: 'require'
});

const safeMigrationSQL = `
-- Safe migration that handles type mismatches
BEGIN;

-- Add missing columns to audit_logs table (this should work)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT '{}';

-- Add missing columns to leads table first
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_channel VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS boberdoo_id VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_id TEXT;

-- Create analytics_events table WITHOUT foreign key constraints for now
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_type VARCHAR(100) NOT NULL,
    lead_id TEXT,  -- Match the leads.id type
    campaign_id TEXT,
    user_id TEXT,
    channel VARCHAR(50),
    value INTEGER DEFAULT 1 NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for analytics_events
CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS analytics_events_lead_id_idx ON analytics_events(lead_id);
CREATE INDEX IF NOT EXISTS analytics_events_campaign_id_idx ON analytics_events(campaign_id);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);

-- Create conversations table WITHOUT foreign key constraints for now
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    lead_id TEXT,  -- Match the leads.id type
    channel VARCHAR(50) NOT NULL,
    agent_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    messages JSONB DEFAULT '[]' NOT NULL,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMP,
    last_message_at TIMESTAMP
);

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS conversations_lead_id_idx ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS conversations_channel_idx ON conversations(channel);
CREATE INDEX IF NOT EXISTS conversations_status_idx ON conversations(status);
CREATE INDEX IF NOT EXISTS conversations_started_at_idx ON conversations(started_at);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    settings JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for clients
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients(name);
CREATE INDEX IF NOT EXISTS clients_domain_idx ON clients(domain);
CREATE INDEX IF NOT EXISTS clients_active_idx ON clients(active);

-- Create indexes for new leads columns
CREATE INDEX IF NOT EXISTS leads_assigned_channel_idx ON leads(assigned_channel);
CREATE INDEX IF NOT EXISTS leads_boberdoo_id_idx ON leads(boberdoo_id);
CREATE INDEX IF NOT EXISTS leads_campaign_id_idx ON leads(campaign_id);

COMMIT;
`;

try {
  console.log('🚀 Starting SAFE database schema migration...');
  console.log('📋 Connected to PostgreSQL database (Oregon region)');
  console.log('⚠️  Using TEXT types to match existing schema');
  
  await sql.begin(async sql => {
    await sql.unsafe(safeMigrationSQL);
  });
  
  console.log('✅ Safe schema migration completed successfully!');
  console.log('🔄 Database is now synced with application schema');
  console.log('');
  console.log('Changes applied:');
  console.log('- ✅ Added missing columns to audit_logs table');
  console.log('- ✅ Created analytics_events table (with TEXT IDs)'); 
  console.log('- ✅ Created conversations table (with TEXT IDs)');
  console.log('- ✅ Created clients table (with TEXT IDs)');
  console.log('- ✅ Added missing columns to leads table');
  console.log('- ✅ Created all necessary indexes');
  console.log('');
  console.log('🎉 Your application should now work properly!');
  console.log('💡 Try logging in to your application now.');
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  console.error('Details:', error.message);
} finally {
  await sql.end();
  process.exit(0);
}
