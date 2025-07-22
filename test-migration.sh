#!/bin/bash

echo "🔄 Testing migration with fixed enums..."

# Set the database URL
FULL_DB_URL="postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a:5432/ccl_3?sslmode=require"

echo "✅ Database URL configured"

# Run the migration
echo "🚀 Running migration..."
npx cross-env DATABASE_URL="$FULL_DB_URL" tsx server/db/migrate.ts --force

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    
    # Test the database connection and check the enum
    echo "🔍 Verifying agent_type enum exists..."
    PGPASSWORD=P8LUqfkbIB4noaUDthVtZETTWZR668nI psql -h dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com -U ccl_3_user ccl_3 -c "\dT+ agent_type"
    
    echo "🎉 Migration test complete!"
else
    echo "❌ Migration failed!"
    exit 1
fi 