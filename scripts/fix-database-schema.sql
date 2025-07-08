-- Comprehensive Database Schema Fix
-- This script will ensure all required columns exist and fix the schema sync issues

-- First, check if we're working with the right database
SELECT current_database(), current_user;

-- 1. Fix the leads table - ensure all columns exist
-- The 'campaign' column should exist but might be missing in actual database

-- Check existing columns in leads table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'leads' 
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
-- Campaign column (this is the one causing the error)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign TEXT;

-- Add email conversation tracking columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversation_mode VARCHAR(20) DEFAULT 'template';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS template_stage INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_reply_at TIMESTAMP;

-- 2. Ensure all other required columns exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_channel TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS boberdoo_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_conversation_mode ON leads(conversation_mode);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- 4. Update any NULL campaign values to empty string for consistency
UPDATE leads SET campaign = '' WHERE campaign IS NULL;

-- 5. Verify the fix by showing current schema
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'leads' 
    AND column_name IN ('campaign', 'conversation_mode', 'template_stage', 'first_reply_at', 'status', 'source')
ORDER BY 
    ordinal_position;

-- 6. Show sample data to verify everything works
SELECT 
    id, 
    name, 
    email, 
    campaign, 
    conversation_mode, 
    template_stage, 
    status,
    created_at
FROM leads 
LIMIT 5;