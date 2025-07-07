-- Create user role enum
CREATE TYPE "user_role" AS ENUM ('admin', 'manager', 'agent', 'viewer');

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "username" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "first_name" text,
  "last_name" text,
  "role" "user_role" DEFAULT 'agent' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "last_login" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "refresh_token" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "action" text NOT NULL,
  "resource" text NOT NULL,
  "resource_id" text,
  "changes" jsonb DEFAULT '{}'::jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- Create analytics events table
CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" text PRIMARY KEY NOT NULL,
  "event_type" text NOT NULL,
  "lead_id" text,
  "campaign_id" text,
  "user_id" text,
  "channel" "channel",
  "value" integer DEFAULT 1,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "analytics_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "analytics_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- Create indexes
CREATE INDEX "users_email_idx" ON "users" ("email");
CREATE INDEX "users_role_idx" ON "users" ("role");
CREATE INDEX "users_active_idx" ON "users" ("active");
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions" ("expires_at");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" ("resource");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events" ("event_type");
CREATE INDEX "analytics_events_lead_id_idx" ON "analytics_events" ("lead_id");
CREATE INDEX "analytics_events_campaign_id_idx" ON "analytics_events" ("campaign_id");
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" ("created_at");

-- Add user_id to existing tables for tracking
ALTER TABLE "leads" ADD COLUMN "created_by" text REFERENCES "users"("id");
ALTER TABLE "campaigns" ADD COLUMN "created_by" text REFERENCES "users"("id");
ALTER TABLE "email_templates" ADD COLUMN "created_by" text REFERENCES "users"("id");
ALTER TABLE "agent_configurations" ADD COLUMN "created_by" text REFERENCES "users"("id");