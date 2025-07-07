-- Create email_templates table
CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "content" text NOT NULL,
  "plain_text" text,
  "category" text NOT NULL,
  "variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "campaign_id" text,
  "agent_id" text,
  "active" boolean DEFAULT true NOT NULL,
  "performance" jsonb DEFAULT '{"sent":0,"opened":0,"clicked":0,"replied":0}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
ALTER TABLE "email_templates" 
ADD CONSTRAINT "email_templates_campaign_id_campaigns_id_fk" 
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Create indexes
CREATE INDEX "email_templates_category_idx" ON "email_templates" ("category");
CREATE INDEX "email_templates_campaign_id_idx" ON "email_templates" ("campaign_id");
CREATE INDEX "email_templates_agent_id_idx" ON "email_templates" ("agent_id");
CREATE INDEX "email_templates_active_idx" ON "email_templates" ("active");
CREATE INDEX "email_templates_name_idx" ON "email_templates" ("name");