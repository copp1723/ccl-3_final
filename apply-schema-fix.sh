#!/bin/bash
set -e

echo "🗄️  Applying database schema fix for production..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable not set"
    echo "Please set it and run again:"
    echo "export DATABASE_URL='your_database_url'"
    exit 1
fi

echo "📋 Applying schema migration..."

# Apply the SQL migration
if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -f production-schema-fix.sql
    echo "✅ Schema migration applied successfully via psql!"
else
    echo "📦 psql not found, trying with Node.js script..."
    
    # Create a temporary Node.js script to run the migration
    cat > temp-migrate.js << 'EOF'
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const sql = postgres(process.env.DATABASE_URL);

const migrationSQL = readFileSync('production-schema-fix.sql', 'utf8');

try {
  await sql.begin(async sql => {
    console.log('🚀 Running schema migration...');
    await sql.unsafe(migrationSQL);
    console.log('✅ Schema migration completed successfully!');
  });
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  await sql.end();
}
EOF

    node temp-migrate.js
    rm temp-migrate.js
fi

echo "🔄 Schema update complete! Your database should now match the application schema."
echo "💡 You may need to restart your Render service for all changes to take effect."
