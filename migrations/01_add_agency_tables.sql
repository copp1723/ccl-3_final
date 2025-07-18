-- Migration: Add tables for Agency/Client White-Labeling
-- Date: 2025-07-17

-- Table for managing clients, representing the entities an agency works with.
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  brand_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Foreign key to an 'agencies' table if you add multi-agency support later
  agency_id UUID 
);

-- Junction table to associate campaigns with clients.
CREATE TABLE client_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, campaign_id)
);

-- Table for storing campaign templates, which can be global or client-specific.
CREATE TABLE campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  template_config JSONB,
  -- If client_id is NULL, it's a global/agency-level template.
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL, 
  created_by UUID, -- Reference to the user who created it.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a client_id to the existing templates table to make it multi-tenant.
ALTER TABLE templates
ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Add an index for faster lookups on client_id.
CREATE INDEX idx_templates_client_id ON templates(client_id);
CREATE INDEX idx_campaign_templates_client_id ON campaign_templates(client_id);
CREATE INDEX idx_clients_agency_id ON clients(agency_id);

-- Update the campaign table to be client-aware
ALTER TABLE campaigns
ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

CREATE INDEX idx_campaigns_client_id ON campaigns(client_id);