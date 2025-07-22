#!/bin/bash
set -e

echo "🔧 Fixing third schema issue: emailTemplates alias..."

# Add the changed schema file
git add server/db/schema.ts

# Create commit
git commit -m "Fix deployment: Add emailTemplates alias for templates table

- Added export alias emailTemplates = templates
- Resolves: SyntaxError: The requested module '../db/schema' does not provide an export named 'emailTemplates'
- Maintains backward compatibility"

# Push to trigger deployment
git push origin main

echo "✅ Changes pushed. Third deployment fix complete."
