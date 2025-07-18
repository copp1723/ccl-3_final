-- Migration to fix schema mismatches between repositories and database schema
-- Adding missing columns that the repository code expects

-- Fix users table - add missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Fix sessions table - add refresh token
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token VARCHAR(255) UNIQUE;

-- Fix analytics_events table - add missing columns
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS value INTEGER DEFAULT 1;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES leads(id);

-- Fix email_templates table - add missing columns
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS campaign_id TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS agent_id TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS plain_text TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS performance JSONB DEFAULT '{}';

-- Fix conversations table - add missing columns
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS cross_channel_context JSONB DEFAULT '{}';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS current_qualification_score INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS goal_progress JSONB DEFAULT '{}';

-- Fix audit_logs table - ensure created_at has default
ALTER TABLE audit_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_lead_id ON analytics_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_campaign_id ON email_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_agent_id ON email_templates(agent_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token); 