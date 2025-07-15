-- Migration for Email Scheduling and Handover System
-- Add tables for email campaign scheduling and handover tracking

-- Email Campaign Schedules
CREATE TABLE IF NOT EXISTS email_schedules (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  lead_id TEXT NOT NULL REFERENCES leads(id),
  template_id UUID NOT NULL REFERENCES email_templates(id),
  scheduled_for TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Handover Destinations
CREATE TABLE IF NOT EXISTS handover_destinations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('crm', 'boberdoo', 'webhook', 'email')),
  config JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Handover Executions
CREATE TABLE IF NOT EXISTS handover_executions (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  destination_id TEXT NOT NULL REFERENCES handover_destinations(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  reason TEXT NOT NULL,
  external_id TEXT,
  response_data JSONB,
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email Reply Tracking
CREATE TABLE IF NOT EXISTS email_replies (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  message_id TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  received_at TIMESTAMP NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_schedules_scheduled_for ON email_schedules(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_schedules_status ON email_schedules(status);
CREATE INDEX IF NOT EXISTS idx_email_schedules_lead_id ON email_schedules(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_schedules_campaign_id ON email_schedules(campaign_id);

CREATE INDEX IF NOT EXISTS idx_handover_executions_lead_id ON handover_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_handover_executions_campaign_id ON handover_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_handover_executions_status ON handover_executions(status);

CREATE INDEX IF NOT EXISTS idx_email_replies_lead_id ON email_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_from_email ON email_replies(from_email);
CREATE INDEX IF NOT EXISTS idx_email_replies_received_at ON email_replies(received_at);

-- Update campaigns table to include handover destinations
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_destinations JSONB DEFAULT '[]';

-- Add trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_schedules_updated_at BEFORE UPDATE ON email_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_handover_destinations_updated_at BEFORE UPDATE ON handover_destinations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();