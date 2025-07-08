#!/bin/bash

# Production Database Migration Runner
# This script runs the database migration to fix schema issues

echo "🚀 CCL-3 Production Database Migration"
echo "======================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set your Render database URL:"
    echo "export DATABASE_URL='your_database_url_here'"
    exit 1
fi

echo "✅ DATABASE_URL is set"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed"
    exit 1
fi

echo "✅ Node.js is available"

# Check if postgres package is installed
if ! node -e "require('postgres')" 2>/dev/null; then
    echo "⚠️  Installing postgres package..."
    npm install postgres
fi

echo "✅ Dependencies ready"

# Run the migration
echo "🔄 Running database migration..."
echo ""

node scripts/database/apply-migration.js

MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "🎉 Migration completed successfully!"
    echo "Your database now has the correct schema including:"
    echo "  - channel enum (email, sms, chat)"
    echo "  - assigned_channel column in leads table"
    echo "  - All required tables and constraints"
else
    echo ""
    echo "❌ Migration failed with exit code $MIGRATION_EXIT_CODE"
    echo "Please check the error messages above"
    exit $MIGRATION_EXIT_CODE
fi