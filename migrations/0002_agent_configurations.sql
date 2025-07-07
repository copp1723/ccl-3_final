-- Create agent_configurations table
CREATE TABLE IF NOT EXISTS "agent_configurations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "type" "agent_type" NOT NULL,
  "role" text NOT NULL,
  "end_goal" text NOT NULL,
  "instructions" jsonb NOT NULL,
  "domain_expertise" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "personality" text NOT NULL,
  "tone" text NOT NULL,
  "response_length" text DEFAULT 'medium',
  "api_model" text,
  "temperature" integer DEFAULT 70,
  "max_tokens" integer DEFAULT 500,
  "active" boolean DEFAULT true NOT NULL,
  "performance" jsonb DEFAULT '{"conversations":0,"successfulOutcomes":0,"averageResponseTime":0}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX "agent_configurations_type_idx" ON "agent_configurations" ("type");
CREATE INDEX "agent_configurations_active_idx" ON "agent_configurations" ("active");
CREATE INDEX "agent_configurations_name_idx" ON "agent_configurations" ("name");
CREATE UNIQUE INDEX "agent_configurations_name_unique" ON "agent_configurations" ("name");

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_configurations_updated_at 
BEFORE UPDATE ON "agent_configurations" 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();