-- Migration 0010: Force schema update and ensure clients table compatibility
-- Date: 2025-01-19
-- Purpose: Fix production deployment database schema issues

-- Ensure clients table exists with correct schema
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  settings JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns if they don't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Insert default client if none exists
INSERT INTO clients (id, name, domain, settings, active, created_at, updated_at)
SELECT 'ccl-default', 'Complete Car Loans', 'completecarloans.com', 
       '{"branding": {"companyName": "Complete Car Loans", "primaryColor": "#1e40af", "secondaryColor": "#64748b"}}'::jsonb, 
       true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE id = 'ccl-default');

-- Update any existing records to ensure they have proper structure
UPDATE clients SET 
  settings = COALESCE(settings, '{}'::jsonb),
  active = COALESCE(active, true),
  created_at = COALESCE(created_at, NOW()),
  updated_at = NOW()
WHERE settings IS NULL OR active IS NULL OR created_at IS NULL; 