#!/bin/bash
set -e

echo "🔧 Deploying schema fixes for CCL-3..."

# Add the changed files
git add server/db/schema.ts
git add server/db/analytics-repository.ts

# Create commit with descriptive message
git commit -m "Fix deployment issue: Add missing analytics tables

- Added analyticsEvents table to schema.ts
- Added conversations table to schema.ts  
- Added missing fields to leads table (assignedChannel, boberdooId, campaignId)
- Fixed analytics-repository.ts import errors
- Updated relations and type exports
- Removed manual ID generation in favor of UUID defaults

This fixes the deployment error:
'The requested module './schema' does not provide an export named 'analyticsEvents'"

# Push to main branch to trigger deployment
git push origin main

echo "✅ Changes pushed to GitHub. Render deployment should start automatically."
echo "🔗 Check deployment status at: https://dashboard.render.com"
