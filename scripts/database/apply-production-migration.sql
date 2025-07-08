-- Production Database Migration Script
-- This script applies the schema from 0000_large_carnage.sql to ensure production database has correct structure

-- Check and create ENUM types if they don't exist
DO $$ 
BEGIN
    -- Create agent_type enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_type') THEN
        CREATE TYPE "public"."agent_type" AS ENUM('overlord', 'email', 'sms', 'chat');
        RAISE NOTICE 'Created agent_type enum';
    ELSE
        RAISE NOTICE 'agent_type enum already exists';
    END IF;

    -- Create channel enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel') THEN
        CREATE TYPE "public"."channel" AS ENUM('email', 'sms', 'chat');
        RAISE NOTICE 'Created channel enum';
    ELSE
        RAISE NOTICE 'channel enum already exists';
    END IF;

    -- Create lead_status enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'sent_to_boberdoo', 'rejected', 'archived');
        RAISE NOTICE 'Created lead_status enum';
    ELSE
        RAISE NOTICE 'lead_status enum already exists';
    END IF;
END $$;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS "agent_decisions" (
    "id" text PRIMARY KEY NOT NULL,
    "lead_id" text NOT NULL,
    "agent_type" "agent_type" NOT NULL,
    "decision" text NOT NULL,
    "reasoning" text,
    "context" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "campaigns" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "qualification_criteria" jsonb NOT NULL,
    "channel_preferences" jsonb NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "communications" (
    "id" text PRIMARY KEY NOT NULL,
    "lead_id" text NOT NULL,
    "channel" "channel" NOT NULL,
    "direction" text NOT NULL,
    "content" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "external_id" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversations" (
    "id" text PRIMARY KEY NOT NULL,
    "lead_id" text NOT NULL,
    "channel" "channel" NOT NULL,
    "agent_type" "agent_type" NOT NULL,
    "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "started_at" timestamp DEFAULT now() NOT NULL,
    "ended_at" timestamp
);

-- Handle leads table migration carefully
DO $$
BEGIN
    -- Create leads table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
        CREATE TABLE "leads" (
            "id" text PRIMARY KEY NOT NULL,
            "name" text NOT NULL,
            "email" text,
            "phone" text,
            "source" text NOT NULL,
            "campaign" text,
            "status" "lead_status" DEFAULT 'new' NOT NULL,
            "assigned_channel" "channel",
            "qualification_score" integer DEFAULT 0,
            "metadata" jsonb DEFAULT '{}'::jsonb,
            "boberdoo_id" text,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        );
        RAISE NOTICE 'Created leads table with all columns';
    ELSE
        -- Table exists, check if assigned_channel column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'leads' AND column_name = 'assigned_channel') THEN
            ALTER TABLE "leads" ADD COLUMN "assigned_channel" "channel";
            RAISE NOTICE 'Added assigned_channel column to existing leads table';
        ELSE
            RAISE NOTICE 'assigned_channel column already exists in leads table';
        END IF;

        -- Check if status column has correct type
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'leads' AND column_name = 'status' AND udt_name = 'lead_status') THEN
            -- This is more complex and might need data migration
            RAISE NOTICE 'Status column exists but may need type conversion';
        END IF;

        -- Ensure other columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'leads' AND column_name = 'qualification_score') THEN
            ALTER TABLE "leads" ADD COLUMN "qualification_score" integer DEFAULT 0;
            RAISE NOTICE 'Added qualification_score column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'leads' AND column_name = 'metadata') THEN
            ALTER TABLE "leads" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;
            RAISE NOTICE 'Added metadata column';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'leads' AND column_name = 'boberdoo_id') THEN
            ALTER TABLE "leads" ADD COLUMN "boberdoo_id" text;
            RAISE NOTICE 'Added boberdoo_id column';
        END IF;
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Check and add foreign key for agent_decisions
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'agent_decisions_lead_id_leads_id_fk') THEN
        ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_lead_id_leads_id_fk" 
        FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
        RAISE NOTICE 'Added foreign key constraint for agent_decisions';
    END IF;

    -- Check and add foreign key for communications
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'communications_lead_id_leads_id_fk') THEN
        ALTER TABLE "communications" ADD CONSTRAINT "communications_lead_id_leads_id_fk" 
        FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
        RAISE NOTICE 'Added foreign key constraint for communications';
    END IF;

    -- Check and add foreign key for conversations
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'conversations_lead_id_leads_id_fk') THEN
        ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" 
        FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
        RAISE NOTICE 'Added foreign key constraint for conversations';
    END IF;
END $$;

-- Final verification queries
SELECT 'Database Migration Complete' as status;

-- Show table structure for verification
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('leads', 'agent_decisions', 'campaigns', 'communications', 'conversations')
ORDER BY table_name, ordinal_position;