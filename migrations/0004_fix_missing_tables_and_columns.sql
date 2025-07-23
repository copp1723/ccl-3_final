-- Migration to add missing tables and columns from schema.ts

-- Create clients table if it doesn't exist
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"settings" jsonb DEFAULT '{}'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_domain_unique" UNIQUE("domain")
);

-- Create indexes for clients table
CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "clients" USING btree ("name");
CREATE INDEX IF NOT EXISTS "clients_domain_idx" ON "clients" USING btree ("domain");
CREATE INDEX IF NOT EXISTS "clients_active_idx" ON "clients" USING btree ("active");

-- Create analytics_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"lead_id" uuid,
	"campaign_id" uuid,
	"user_id" uuid,
	"channel" "channel",
	"value" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for analytics_events table
CREATE INDEX IF NOT EXISTS "analytics_events_event_type_idx" ON "analytics_events" USING btree ("event_type");
CREATE INDEX IF NOT EXISTS "analytics_events_lead_id_idx" ON "analytics_events" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "analytics_events_campaign_id_idx" ON "analytics_events" USING btree ("campaign_id");
CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");

-- Create conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"channel" "channel" NOT NULL,
	"agent_type" "agent_type",
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"last_message_at" timestamp
);

-- Create indexes for conversations table
CREATE INDEX IF NOT EXISTS "conversations_lead_id_idx" ON "conversations" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "conversations_channel_idx" ON "conversations" USING btree ("channel");
CREATE INDEX IF NOT EXISTS "conversations_status_idx" ON "conversations" USING btree ("status");
CREATE INDEX IF NOT EXISTS "conversations_started_at_idx" ON "conversations" USING btree ("started_at");

-- Add missing columns to leads table if they don't exist
DO $$ 
BEGIN
    -- Add assigned_channel column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'assigned_channel'
    ) THEN
        ALTER TABLE leads ADD COLUMN assigned_channel "channel";
    END IF;
    
    -- Add campaign_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'campaign_id'
    ) THEN
        ALTER TABLE leads ADD COLUMN campaign_id uuid;
    END IF;
    
    -- Add boberdoo_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'boberdoo_id'
    ) THEN
        ALTER TABLE leads ADD COLUMN boberdoo_id varchar(255);
    END IF;
END $$;

-- Add missing indexes for leads table
CREATE INDEX IF NOT EXISTS "leads_assigned_channel_idx" ON "leads" USING btree ("assigned_channel");
CREATE INDEX IF NOT EXISTS "leads_campaign_id_idx" ON "leads" USING btree ("campaign_id");
CREATE INDEX IF NOT EXISTS "leads_boberdoo_id_idx" ON "leads" USING btree ("boberdoo_id");

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Add foreign key constraint for leads.campaign_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'leads_campaign_id_campaigns_id_fk'
    ) THEN
        ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" 
        FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Add foreign key constraints for analytics_events if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'analytics_events_lead_id_leads_id_fk'
    ) THEN
        ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_lead_id_leads_id_fk" 
        FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'analytics_events_campaign_id_campaigns_id_fk'
    ) THEN
        ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_campaign_id_campaigns_id_fk" 
        FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'analytics_events_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    -- Add foreign key constraint for conversations.lead_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversations_lead_id_leads_id_fk'
    ) THEN
        ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" 
        FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;