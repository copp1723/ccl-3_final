-- Add email conversation tracking columns to leads table
-- Run this script in your PostgreSQL database

-- Add conversation mode column (template or ai)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS conversation_mode VARCHAR(20) DEFAULT 'template';

-- Add template stage tracking (0-5 for 6 templates)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS template_stage INTEGER DEFAULT 0;

-- Add timestamp for first reply (when switching to AI mode)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS first_reply_at TIMESTAMP;

-- Create index for faster queries on conversation mode
CREATE INDEX IF NOT EXISTS idx_leads_conversation_mode ON leads(conversation_mode);

-- Verify columns were added
SELECT 
    column_name, 
    data_type, 
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'leads' 
    AND column_name IN ('conversation_mode', 'template_stage', 'first_reply_at')
ORDER BY 
    ordinal_position;