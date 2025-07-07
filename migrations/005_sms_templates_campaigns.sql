-- SMS Templates and Campaign Tables for Twilio Integration
-- Complete Car Leads - Sprint 3: Enhanced SMS Marketing

-- SMS Templates table for reusable message templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  message_template TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general', -- 'marketing', 'recovery', 'notification', 'general'
  variables JSONB DEFAULT '[]', -- Array of required variables like ['firstName', 'returnLink']
  
  -- Character and segment tracking
  character_count INTEGER GENERATED ALWAYS AS (LENGTH(message_template)) STORED,
  estimated_segments INTEGER DEFAULT 1,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  tags JSONB DEFAULT '[]', -- For categorization and filtering
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SMS Campaigns table for automated SMS sequences
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  campaign_type VARCHAR(50) NOT NULL DEFAULT 'drip', -- 'drip', 'recovery', 'promotional', 'transactional'
  
  -- Campaign settings
  is_active BOOLEAN DEFAULT true,
  is_paused BOOLEAN DEFAULT false,
  
  -- Targeting criteria
  target_criteria JSONB DEFAULT '{}', -- e.g., {"creditScore": {"min": 600}, "state": ["CA", "TX"]}
  
  -- Schedule settings
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  time_zone VARCHAR(50) DEFAULT 'America/New_York',
  allowed_hours JSONB DEFAULT '{"start": "09:00", "end": "20:00"}', -- Respect time zones
  allowed_days JSONB DEFAULT '["Mon", "Tue", "Wed", "Thu", "Fri"]', -- Days of week
  
  -- Performance metrics
  total_recipients INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  opt_outs INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  
  -- Cost tracking
  estimated_cost DECIMAL(10, 2) DEFAULT 0.00,
  actual_cost DECIMAL(10, 2) DEFAULT 0.00,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SMS Campaign Steps - Defines the sequence of messages in a campaign
CREATE TABLE IF NOT EXISTS sms_campaign_steps (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL REFERENCES sms_templates(id),
  sequence_order INTEGER NOT NULL,
  
  -- Timing configuration
  delay_minutes INTEGER DEFAULT 0, -- Delay from previous step (or campaign start)
  send_window JSONB DEFAULT '{}', -- Override campaign-level time windows
  
  -- Conditions for sending
  send_conditions JSONB DEFAULT '{}', -- e.g., {"previousStepClicked": true}
  
  -- A/B testing support
  variant_name VARCHAR(50) DEFAULT 'default',
  variant_weight DECIMAL(3, 2) DEFAULT 1.00, -- 0.00 to 1.00 for split testing
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(campaign_id, sequence_order, variant_name)
);

-- SMS Campaign Enrollments - Tracks which leads are in which campaigns
CREATE TABLE IF NOT EXISTS sms_campaign_enrollments (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL, -- References system_leads(id)
  
  -- Enrollment details
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enrolled_by VARCHAR(100) DEFAULT 'system', -- 'system', 'manual', 'api'
  
  -- Progress tracking
  current_step INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP,
  next_scheduled_at TIMESTAMP,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'completed', 'opted_out', 'failed'
  completed_at TIMESTAMP,
  opted_out_at TIMESTAMP,
  
  -- Engagement metrics
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_clicked INTEGER DEFAULT 0,
  
  -- Conversion tracking
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMP,
  conversion_value DECIMAL(10, 2),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(campaign_id, lead_id)
);

-- SMS Message Log - Detailed log of all SMS messages sent
CREATE TABLE IF NOT EXISTS sms_message_log (
  id SERIAL PRIMARY KEY,
  
  -- Message details
  template_id INTEGER REFERENCES sms_templates(id),
  campaign_id INTEGER REFERENCES sms_campaigns(id),
  enrollment_id INTEGER REFERENCES sms_campaign_enrollments(id),
  
  -- Recipient info
  lead_id TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL, -- Stored in E.164 format
  
  -- Message content
  message_body TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  segment_count INTEGER NOT NULL,
  
  -- Twilio tracking
  twilio_message_sid VARCHAR(255) UNIQUE,
  twilio_status VARCHAR(50), -- 'queued', 'sent', 'delivered', 'failed', 'undelivered'
  twilio_error_code VARCHAR(10),
  twilio_error_message TEXT,
  
  -- Timing
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  -- Cost
  cost DECIMAL(10, 4) DEFAULT 0.0000,
  
  -- Engagement tracking
  clicked BOOLEAN DEFAULT false,
  clicked_at TIMESTAMP,
  opted_out BOOLEAN DEFAULT false,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SMS Opt-outs - Track phone numbers that have opted out
CREATE TABLE IF NOT EXISTS sms_opt_outs (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  lead_id TEXT,
  
  opted_out_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opt_out_method VARCHAR(50) DEFAULT 'reply', -- 'reply', 'link', 'manual', 'complaint'
  opt_out_message TEXT,
  
  -- Re-opt-in tracking
  opted_in_again BOOLEAN DEFAULT false,
  opted_in_at TIMESTAMP,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SMS Quick Sends - For one-off SMS sends outside of campaigns
CREATE TABLE IF NOT EXISTS sms_quick_sends (
  id SERIAL PRIMARY KEY,
  
  -- Recipient selection
  recipient_type VARCHAR(50) NOT NULL, -- 'individual', 'segment', 'filter'
  recipient_criteria JSONB NOT NULL, -- Lead IDs or filter criteria
  
  -- Message
  template_id INTEGER REFERENCES sms_templates(id),
  custom_message TEXT,
  
  -- Scheduling
  send_immediately BOOLEAN DEFAULT true,
  scheduled_for TIMESTAMP,
  
  -- Tracking
  total_recipients INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  
  -- Cost
  estimated_cost DECIMAL(10, 2) DEFAULT 0.00,
  actual_cost DECIMAL(10, 2) DEFAULT 0.00,
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'completed', 'failed'
  sent_by VARCHAR(100) NOT NULL,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_sms_templates_category ON sms_templates(category) WHERE is_active = true;
CREATE INDEX idx_sms_templates_usage ON sms_templates(usage_count DESC);

CREATE INDEX idx_sms_campaigns_active ON sms_campaigns(is_active, is_paused);
CREATE INDEX idx_sms_campaigns_dates ON sms_campaigns(start_date, end_date);

CREATE INDEX idx_sms_campaign_steps_order ON sms_campaign_steps(campaign_id, sequence_order);

CREATE INDEX idx_sms_enrollments_status ON sms_campaign_enrollments(status, next_scheduled_at);
CREATE INDEX idx_sms_enrollments_lead ON sms_campaign_enrollments(lead_id);

CREATE INDEX idx_sms_message_log_lead ON sms_message_log(lead_id, sent_at DESC);
CREATE INDEX idx_sms_message_log_twilio ON sms_message_log(twilio_message_sid);
CREATE INDEX idx_sms_message_log_campaign ON sms_message_log(campaign_id, sent_at DESC);

CREATE INDEX idx_sms_opt_outs_phone ON sms_opt_outs(phone_number);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON sms_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_campaigns_updated_at BEFORE UPDATE ON sms_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_enrollments_updated_at BEFORE UPDATE ON sms_campaign_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample templates for quick start
INSERT INTO sms_templates (name, description, message_template, category, variables) VALUES
  ('recovery_step_1', 'First recovery message for abandoned visitors', 
   'Hi {{firstName}}! This is Cathy from Complete Car Loans. I noticed you were checking out auto financing options. I specialize in helping people get approved regardless of credit history. Would you like me to check your pre-approval status? It takes just 60 seconds and won''t affect your credit score.', 
   'recovery', '["firstName"]'::jsonb),
   
  ('recovery_step_2', 'Second recovery message for partially completed applications',
   'Hi {{firstName}}! It''s Cathy from Complete Car Loans. I see you started your application but got interrupted - that happens to all of us! The good news is I saved your progress. I can get you pre-approved in the next 2 minutes. Ready to finish up? {{returnLink}}',
   'recovery', '["firstName", "returnLink"]'::jsonb),
   
  ('welcome_approved', 'Welcome message for approved applicants',
   'Congratulations {{firstName}}! You''re PRE-APPROVED for up to ${{approvedAmount}} in auto financing! 🎉 Your dedicated specialist will call you within 30 minutes to discuss your options. Questions? Reply HELP.',
   'notification', '["firstName", "approvedAmount"]'::jsonb),
   
  ('appointment_reminder', 'Appointment reminder message',
   '{{firstName}}, this is a reminder about your appointment with Complete Car Loans today at {{appointmentTime}}. Your specialist {{specialistName}} is looking forward to helping you find the perfect vehicle! Reply YES to confirm or RESCHEDULE to pick a new time.',
   'notification', '["firstName", "appointmentTime", "specialistName"]'::jsonb);

-- Sample SMS recovery campaign
INSERT INTO sms_campaigns (name, description, campaign_type, target_criteria) VALUES
  ('Abandoned Application Recovery', 
   'Automated SMS sequence to recover abandoned loan applications',
   'recovery',
   '{"abandonmentDetected": true, "phoneNumber": {"exists": true}}'::jsonb);

-- Add campaign steps (using the template IDs from above - in production these would be dynamic)
INSERT INTO sms_campaign_steps (campaign_id, template_id, sequence_order, delay_minutes) VALUES
  (1, 1, 1, 15),  -- Send first recovery message 15 minutes after abandonment
  (1, 2, 2, 1440); -- Send second recovery message 24 hours later

-- Comments for documentation
COMMENT ON TABLE sms_templates IS 'Reusable SMS message templates with variable substitution support';
COMMENT ON TABLE sms_campaigns IS 'Automated SMS campaign definitions with scheduling and targeting';
COMMENT ON TABLE sms_campaign_enrollments IS 'Tracks individual lead progress through SMS campaigns';
COMMENT ON TABLE sms_message_log IS 'Detailed log of all SMS messages sent through the system';
COMMENT ON TABLE sms_opt_outs IS 'Compliance tracking for SMS opt-outs (TCPA/CTIA compliance)';