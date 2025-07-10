-- Multi-Agent Campaign Support Migration
-- Adds support for multiple agents working together on campaigns

-- Add new columns for multi-agent support
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS assigned_agents JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS coordination_strategy TEXT DEFAULT 'channel_specific',
ADD COLUMN IF NOT EXISTS message_coordination JSONB DEFAULT '{
  "allowMultipleAgents": true,
  "messageGap": 30,
  "handoffEnabled": true,
  "syncSchedules": true
}'::jsonb;

-- Create index for better performance on agent queries
CREATE INDEX IF NOT EXISTS idx_campaigns_assigned_agents ON campaigns USING GIN (assigned_agents);
CREATE INDEX IF NOT EXISTS idx_campaigns_coordination_strategy ON campaigns (coordination_strategy);

-- Add check constraint for coordination strategy
ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_coordination_strategy_check 
CHECK (coordination_strategy IN ('round_robin', 'priority_based', 'channel_specific'));

-- Update existing campaigns to have basic agent assignment if they have agentId
UPDATE campaigns 
SET assigned_agents = jsonb_build_array(
  jsonb_build_object(
    'agentId', agent_id,
    'channels', '["email"]'::jsonb,
    'role', 'primary',
    'capabilities', jsonb_build_object(
      'email', true,
      'sms', false,
      'chat', false
    )
  )
)
WHERE agent_id IS NOT NULL AND assigned_agents = '[]'::jsonb;

-- Create agent coordination tracking table
CREATE TABLE IF NOT EXISTS agent_coordination (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'chat')),
  scheduled_time TIMESTAMP,
  executed_time TIMESTAMP,
  priority INTEGER DEFAULT 1,
  message_template TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
  coordination_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for agent coordination
CREATE INDEX IF NOT EXISTS idx_agent_coordination_campaign_id ON agent_coordination (campaign_id);
CREATE INDEX IF NOT EXISTS idx_agent_coordination_lead_id ON agent_coordination (lead_id);
CREATE INDEX IF NOT EXISTS idx_agent_coordination_agent_id ON agent_coordination (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_coordination_channel ON agent_coordination (channel);
CREATE INDEX IF NOT EXISTS idx_agent_coordination_scheduled_time ON agent_coordination (scheduled_time);
CREATE INDEX IF NOT EXISTS idx_agent_coordination_status ON agent_coordination (status);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_agent_coordination_campaign_lead ON agent_coordination (campaign_id, lead_id);

-- Add trigger to update timestamp
CREATE OR REPLACE FUNCTION update_agent_coordination_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_coordination_update_timestamp
  BEFORE UPDATE ON agent_coordination
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_coordination_timestamp();

-- Create view for agent coordination summary
CREATE OR REPLACE VIEW agent_coordination_summary AS
SELECT 
  ac.campaign_id,
  c.name as campaign_name,
  ac.agent_id,
  ac.channel,
  COUNT(*) as total_coordinations,
  COUNT(CASE WHEN ac.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN ac.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN ac.status = 'failed' THEN 1 END) as failed,
  AVG(EXTRACT(EPOCH FROM (ac.executed_time - ac.scheduled_time))/60) as avg_delay_minutes
FROM agent_coordination ac
JOIN campaigns c ON ac.campaign_id = c.id
GROUP BY ac.campaign_id, c.name, ac.agent_id, ac.channel;

-- Add comments for documentation
COMMENT ON TABLE agent_coordination IS 'Tracks coordination between multiple agents on campaigns';
COMMENT ON COLUMN campaigns.assigned_agents IS 'Array of agents assigned to this campaign with their capabilities and roles';
COMMENT ON COLUMN campaigns.coordination_strategy IS 'Strategy for coordinating multiple agents: round_robin, priority_based, or channel_specific';
COMMENT ON COLUMN campaigns.message_coordination IS 'Settings for coordinating messages between multiple agents';