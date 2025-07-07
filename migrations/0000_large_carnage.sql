CREATE TYPE "public"."agent_type" AS ENUM('overlord', 'email', 'sms', 'chat');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email', 'sms', 'chat');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'sent_to_boberdoo', 'rejected', 'archived');--> statement-breakpoint
CREATE TABLE "agent_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"decision" text NOT NULL,
	"reasoning" text,
	"context" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qualification_criteria" jsonb NOT NULL,
	"channel_preferences" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications" (
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
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;