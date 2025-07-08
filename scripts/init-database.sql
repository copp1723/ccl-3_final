-- CCL-3 Database Initialization Script
-- Run this in your Render PostgreSQL database

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  source VARCHAR(100),
  status VARCHAR(50) DEFAULT 'new',
  qualification_score INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  -- Email conversation fields
  conversation_mode VARCHAR(20) DEFAULT 'template',
  template_stage INTEGER DEFAULT 0,
  template_current INTEGER DEFAULT 0,
  template_total INTEGER DEFAULT 0,
  ai_sentiment VARCHAR(20),
  mode_switched_at TIMESTAMP,
  last_template_sent_at TIMESTAMP,
  first_reply_at TIMESTAMP
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  agent_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Create agent_decisions table
CREATE TABLE IF NOT EXISTS agent_decisions (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  agent_type VARCHAR(50) NOT NULL,
  decision VARCHAR(100) NOT NULL,
  reason TEXT,
  confidence DECIMAL(3,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create communications table
CREATE TABLE IF NOT EXISTS communications (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  direction VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(50),
  external_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  agent_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'draft',
  schedule_type VARCHAR(20) DEFAULT 'template',
  conversation_mode VARCHAR(20) DEFAULT 'auto',
  template_count INTEGER DEFAULT 5,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create campaign_templates table
CREATE TABLE IF NOT EXISTS campaign_templates (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  template_content TEXT,
  subject VARCHAR(255),
  order_index INTEGER,
  delay_value INTEGER,
  delay_unit VARCHAR(10) DEFAULT 'days',
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50),
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  end_goal TEXT,
  personality VARCHAR(100),
  tone VARCHAR(50),
  domain_expertise JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'fixed',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_conversation_mode ON leads(conversation_mode);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_campaign_id ON campaign_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_communications_lead_id ON communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_lead_id ON agent_decisions(lead_id);

-- Insert default data
INSERT INTO agents (id, name, type, end_goal, personality, tone, domain_expertise, settings)
VALUES 
  ('email-nurture-ai', 'Email Nurture AI', 'email', 'Convert leads through personalized email conversations', 'helpful', 'professional', '["sales", "marketing"]', '{}'),
  ('qualifier-ai', 'Lead Qualifier AI', 'qualifier', 'Qualify leads based on engagement and fit', 'analytical', 'neutral', '["analysis", "scoring"]', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO email_templates (name, subject, body, category)
VALUES 
  ('Welcome Template', 'Welcome! Quick question about your needs', 'Hi {{name}},\n\nThanks for your interest! I wanted to reach out personally to understand what brought you here.\n\nBest regards,\nThe Team', 'welcome'),
  ('Follow-up 1', 'Did you find what you were looking for?', 'Hi {{name}},\n\nI noticed you were checking out our solutions. What specific challenge are you trying to solve?\n\nBest regards,\nThe Team', 'follow-up'),
  ('Follow-up 2', '🎯 Special offer inside', 'Hi {{name}},\n\nI wanted to check in and see if you had any questions I could help answer.\n\nBest regards,\nThe Team', 'follow-up')
ON CONFLICT DO NOTHING;

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;