-- Migration to sync database with current schema
-- Run this against your production database

BEGIN;

-- Add missing columns to audit_logs table
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT '{}';

-- Create analytics_events table if not exists
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    lead_id UUID REFERENCES leads(id),
    campaign_id UUID REFERENCES campaigns(id),
    user_id UUID REFERENCES users(id),
    channel channel,
    value INTEGER DEFAULT 1 NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for analytics_events
CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS analytics_events_lead_id_idx ON analytics_events(lead_id);
CREATE INDEX IF NOT EXISTS analytics_events_campaign_id_idx ON analytics_events(campaign_id);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);

-- Create conversations table if not exists
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id),
    channel channel NOT NULL,
    agent_type agent_type,
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

-- Create clients table if not exists
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Add missing columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_channel channel;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS boberdoo_id VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);

-- Create indexes for new leads columns
CREATE INDEX IF NOT EXISTS leads_assigned_channel_idx ON leads(assigned_channel);
CREATE INDEX IF NOT EXISTS leads_boberdoo_id_idx ON leads(boberdoo_id);
CREATE INDEX IF NOT EXISTS leads_campaign_id_idx ON leads(campaign_id);

COMMIT;

-- Success message
SELECT 'Database schema migration completed successfully!' as result;
