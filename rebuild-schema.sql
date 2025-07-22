-- rebuild-schema.sql
-- Idempotent full schema rebuild for CCL-3
-- Run with: psql -h <host> -U <user> -d <db> -f rebuild-schema.sql

-- 1. ENUMS
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='agent_type') THEN CREATE TYPE public.agent_type AS ENUM('overlord','email','sms','chat'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='channel') THEN CREATE TYPE public.channel AS ENUM('email','sms','chat'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='lead_status') THEN CREATE TYPE public.lead_status AS ENUM('new','contacted','qualified','sent_to_boberdoo','rejected','archived'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='user_role') THEN CREATE TYPE public.user_role AS ENUM('admin','manager','agent','viewer'); END IF; END $$;

-- 2. TABLES
CREATE TABLE IF NOT EXISTS public.leads (id text PRIMARY KEY, name text NOT NULL, email text, phone text, source text NOT NULL, campaign text, status public.lead_status DEFAULT 'new', assigned_channel public.channel, qualification_score integer DEFAULT 0, metadata jsonb DEFAULT '{}', boberdoo_id text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), created_by text, campaign_id text, client_id uuid);
CREATE TABLE IF NOT EXISTS public.campaigns (id text PRIMARY KEY, name text NOT NULL, goals jsonb DEFAULT '[]', qualification_criteria jsonb NOT NULL, channel_preferences jsonb NOT NULL, active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), created_by text, handover_criteria jsonb, selected_leads jsonb, client_id uuid);
CREATE TABLE IF NOT EXISTS public.agent_decisions (id text PRIMARY KEY, lead_id text NOT NULL REFERENCES public.leads(id), agent_type public.agent_type NOT NULL, decision text NOT NULL, reasoning text, context jsonb DEFAULT '{}', created_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS public.communications (id text PRIMARY KEY, lead_id text NOT NULL REFERENCES public.leads(id), channel public.channel NOT NULL, direction text NOT NULL, content text NOT NULL, status text DEFAULT 'pending', external_id text, metadata jsonb DEFAULT '{}', created_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS public.conversations (id text PRIMARY KEY, lead_id text NOT NULL REFERENCES public.leads(id), channel public.channel NOT NULL, agent_type public.agent_type NOT NULL, messages jsonb DEFAULT '[]', status text DEFAULT 'active', started_at timestamp DEFAULT now(), ended_at timestamp);
CREATE TABLE IF NOT EXISTS public.clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(255) NOT NULL, domain varchar(255), settings jsonb, active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS public.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) UNIQUE NOT NULL, username varchar(255) UNIQUE NOT NULL, password_hash varchar(255) NOT NULL, first_name varchar(255), last_name varchar(255), role public.user_role DEFAULT 'agent', active boolean DEFAULT true, last_login timestamp, metadata jsonb DEFAULT '{}', client_id uuid REFERENCES public.clients(id), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS public.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, refresh_token varchar(255) UNIQUE NOT NULL, expires_at timestamp NOT NULL, ip_address varchar(45), user_agent text, created_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS public.audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.users(id) ON DELETE SET NULL, action varchar(100) NOT NULL, resource varchar(100) NOT NULL, resource_id varchar(255), details jsonb DEFAULT '{}', ip_address varchar(45), user_agent text, created_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agent_configurations (id text PRIMARY KEY, name text NOT NULL, type public.agent_type NOT NULL, role text NOT NULL, end_goal text NOT NULL, instructions jsonb NOT NULL, domain_expertise jsonb DEFAULT '[]', personality text NOT NULL, tone text NOT NULL, response_length text DEFAULT 'medium', api_model text, temperature integer DEFAULT 70, max_tokens integer DEFAULT 500, active boolean DEFAULT true, performance jsonb DEFAULT '{"conversations":0,"successfulOutcomes":0,"averageResponseTime":0}', metadata jsonb DEFAULT '{}', created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), created_by text, client_id uuid REFERENCES public.clients(id));

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON public.campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_lead_id ON public.agent_decisions(lead_id);
CREATE INDEX IF NOT EXISTS idx_communications_lead_id ON public.communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON public.conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_configurations_type ON public.agent_configurations(type);
CREATE INDEX IF NOT EXISTS idx_agent_configurations_active ON public.agent_configurations(active);

-- 4. AUTO-UPDATE updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DO $$ DECLARE t text; BEGIN FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('leads','campaigns','agent_configurations','clients','users') LOOP EXECUTE format('CREATE OR REPLACE TRIGGER trg_%I_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t); END LOOP; END $$;

-- 5. DONE
SELECT 'Schema rebuilt successfully' AS status; 