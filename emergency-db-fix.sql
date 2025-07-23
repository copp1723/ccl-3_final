-- Emergency Production Database Fix
-- Run this directly on the production database to fix schema issues

-- 1. Fix users table password column
-- First check what columns exist and rename if needed
DO $$
BEGIN
    -- If passwordHash exists, rename it to password_hash
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'passwordHash') THEN
        ALTER TABLE users RENAME COLUMN "passwordHash" TO password_hash;
        RAISE NOTICE 'Renamed passwordHash to password_hash';
    -- If neither exists, add password_hash
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash TEXT;
        RAISE NOTICE 'Added password_hash column';
    END IF;
END $$;

-- 2. Add missing columns to agent_configurations
ALTER TABLE agent_configurations 
ADD COLUMN IF NOT EXISTS system_prompt TEXT,
ADD COLUMN IF NOT EXISTS temperature NUMERIC(3, 2) DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS response_style TEXT DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS personality JSONB DEFAULT '{"tone": "professional", "style": "balanced", "traits": []}';

-- 3. Add missing columns to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS assigned_channel TEXT,
ADD COLUMN IF NOT EXISTS boberdoo_id TEXT,
ADD COLUMN IF NOT EXISTS campaign_id UUID;

-- 4. Create clients table if missing
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand_config JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create analytics_events table if missing
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    lead_id UUID,
    campaign_id UUID,
    agent_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create conversations table if missing
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID,
    agent_id UUID,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_lead_id ON analytics_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_campaign_id ON analytics_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);

-- 8. Add foreign key constraints (only if tables exist)
DO $$
BEGIN
    -- Add foreign key for leads.campaign_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'leads_campaign_id_fkey'
    ) THEN
        ALTER TABLE leads ADD CONSTRAINT leads_campaign_id_fkey 
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Show final status
SELECT 'Database schema fixes applied successfully!' as status;