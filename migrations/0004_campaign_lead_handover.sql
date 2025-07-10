-- Add campaign_id column to leads table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='campaign_id') THEN
        ALTER TABLE leads ADD COLUMN campaign_id TEXT REFERENCES campaigns(id);
        RAISE NOTICE 'Added campaign_id column to leads table';
    ELSE
        RAISE NOTICE 'campaign_id column already exists in leads table';
    END IF;
END $$;

-- Add handover_criteria column to campaigns table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='handover_criteria') THEN
        ALTER TABLE campaigns ADD COLUMN handover_criteria JSONB;
        RAISE NOTICE 'Added handover_criteria column to campaigns table';
    ELSE
        RAISE NOTICE 'handover_criteria column already exists in campaigns table';
    END IF;
END $$;

-- Create index for better performance on campaign_id lookups if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='leads' AND indexname='idx_leads_campaign_id') THEN
        CREATE INDEX idx_leads_campaign_id ON leads(campaign_id);
        RAISE NOTICE 'Created index idx_leads_campaign_id';
    ELSE
        RAISE NOTICE 'Index idx_leads_campaign_id already exists';
    END IF;
END $$;

-- Update existing campaigns with default handover criteria
UPDATE campaigns
SET handover_criteria = '{
  "qualificationScore": 7,
  "conversationLength": 5,
  "timeThreshold": 300,
  "keywordTriggers": [],
  "goalCompletionRequired": [],
  "handoverRecipients": []
}'::jsonb
WHERE handover_criteria IS NULL;