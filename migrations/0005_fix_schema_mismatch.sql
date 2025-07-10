-- Migration to fix schema mismatch between code and production database
-- Working with existing integer IDs and campaign column structure

-- Add handover_criteria column to campaigns table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='handover_criteria') THEN
        ALTER TABLE campaigns ADD COLUMN handover_criteria JSONB DEFAULT '{
          "qualificationScore": 7,
          "conversationLength": 5,
          "timeThreshold": 300,
          "keywordTriggers": [],
          "goalCompletionRequired": [],
          "handoverRecipients": []
        }'::jsonb;
        RAISE NOTICE 'Added handover_criteria column to campaigns table';
    ELSE
        RAISE NOTICE 'handover_criteria column already exists in campaigns table';
    END IF;
END $$;

-- Add goals column to campaigns table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='goals') THEN
        ALTER TABLE campaigns ADD COLUMN goals JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added goals column to campaigns table';
    ELSE
        RAISE NOTICE 'goals column already exists in campaigns table';
    END IF;
END $$;

-- Add qualification_criteria column to campaigns table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='qualification_criteria') THEN
        ALTER TABLE campaigns ADD COLUMN qualification_criteria JSONB DEFAULT '{
          "minScore": 7,
          "requiredFields": ["name", "email"],
          "requiredGoals": []
        }'::jsonb;
        RAISE NOTICE 'Added qualification_criteria column to campaigns table';
    ELSE
        RAISE NOTICE 'qualification_criteria column already exists in campaigns table';
    END IF;
END $$;

-- Add selected_leads column to campaigns table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='selected_leads') THEN
        ALTER TABLE campaigns ADD COLUMN selected_leads JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added selected_leads column to campaigns table';
    ELSE
        RAISE NOTICE 'selected_leads column already exists in campaigns table';
    END IF;
END $$;

-- Add channel_preferences column to campaigns table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='channel_preferences') THEN
        ALTER TABLE campaigns ADD COLUMN channel_preferences JSONB DEFAULT '{
          "primary": "email",
          "fallback": ["sms"]
        }'::jsonb;
        RAISE NOTICE 'Added channel_preferences column to campaigns table';
    ELSE
        RAISE NOTICE 'channel_preferences column already exists in campaigns table';
    END IF;
END $$;

-- Add active column to campaigns table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaigns' AND column_name='active') THEN
        ALTER TABLE campaigns ADD COLUMN active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added active column to campaigns table';
    ELSE
        RAISE NOTICE 'active column already exists in campaigns table';
    END IF;
END $$;

-- Rename 'campaign' column to 'campaign_id' in leads table if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='campaign') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='campaign_id') THEN
        ALTER TABLE leads RENAME COLUMN campaign TO campaign_id;
        RAISE NOTICE 'Renamed campaign column to campaign_id in leads table';
    ELSE
        RAISE NOTICE 'campaign_id column already exists or campaign column not found in leads table';
    END IF;
END $$;

-- Update existing campaigns with proper default values
UPDATE campaigns
SET 
    handover_criteria = COALESCE(handover_criteria, '{
      "qualificationScore": 7,
      "conversationLength": 5,
      "timeThreshold": 300,
      "keywordTriggers": [],
      "goalCompletionRequired": [],
      "handoverRecipients": []
    }'::jsonb),
    goals = COALESCE(goals, '[]'::jsonb),
    qualification_criteria = COALESCE(qualification_criteria, '{
      "minScore": 7,
      "requiredFields": ["name", "email"],
      "requiredGoals": []
    }'::jsonb),
    selected_leads = COALESCE(selected_leads, '[]'::jsonb),
    channel_preferences = COALESCE(channel_preferences, '{
      "primary": "email",
      "fallback": ["sms"]
    }'::jsonb),
    active = COALESCE(active, true)
WHERE 
    handover_criteria IS NULL 
    OR goals IS NULL 
    OR qualification_criteria IS NULL 
    OR selected_leads IS NULL 
    OR channel_preferences IS NULL 
    OR active IS NULL;