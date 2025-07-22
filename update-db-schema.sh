#!/bin/bash
set -e

echo "🔧 Generating database migration for schema updates..."

# Generate migration for current schema changes
npm run db:generate

echo "📋 Generated migration files. Check the migrations directory."

# Option to push the schema directly (for development/staging)
read -p "Do you want to push schema changes directly? (y/n): " push_schema
if [ "$push_schema" = "y" ]; then
  echo "🚀 Pushing schema changes to database..."
  npm run db:push
  echo "✅ Database schema updated successfully!"
else
  echo "💡 To apply changes manually, run: npm run db:push"
fi

echo "🔄 Schema update complete!"
