-- Add white-label client support to CCL-3

-- Create clients table
CREATE TABLE IF NOT EXISTS "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "domain" varchar(255),
  "settings" jsonb,
  "active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add client_id to existing tables
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "client_id" uuid REFERENCES "clients"("id");
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "client_id" uuid REFERENCES "clients"("id");
ALTER TABLE "agent_configurations" ADD COLUMN IF NOT EXISTS "client_id" uuid REFERENCES "clients"("id");
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "client_id" uuid REFERENCES "clients"("id");
ALTER TABLE "communications" ADD COLUMN IF NOT EXISTS "client_id" uuid REFERENCES "clients"("id");

-- Create default client
INSERT INTO "clients" ("id", "name", "domain", "settings", "active") 
VALUES (
  gen_random_uuid(),
  'CCL-3 SWARM',
  'localhost:5173',
  '{"branding":{"companyName":"CCL-3 SWARM","primaryColor":"#2563eb","secondaryColor":"#1d4ed8","emailFromName":"CCL-3 SWARM","supportEmail":"support@ccl3swarm.com"}}',
  true
) ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_users_client_id" ON "users"("client_id");
CREATE INDEX IF NOT EXISTS "idx_leads_client_id" ON "leads"("client_id");
CREATE INDEX IF NOT EXISTS "idx_agent_configurations_client_id" ON "agent_configurations"("client_id");
CREATE INDEX IF NOT EXISTS "idx_campaigns_client_id" ON "campaigns"("client_id");
CREATE INDEX IF NOT EXISTS "idx_communications_client_id" ON "communications"("client_id");
CREATE INDEX IF NOT EXISTS "idx_clients_domain" ON "clients"("domain");