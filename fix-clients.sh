#!/bin/bash
set -e

echo "🔧 Fixing additional schema issue: clients table..."

# Add the changed schema file
git add server/db/schema.ts

# Create commit
git commit -m "Fix deployment: Add missing clients table to schema

- Added clients table for multi-tenant client management
- Added proper relations and TypeScript types
- Resolves: SyntaxError: The requested module './schema' does not provide an export named 'clients'"

# Push to trigger deployment
git push origin main

echo "✅ Changes pushed. Second deployment fix complete."
