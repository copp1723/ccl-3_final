#!/bin/bash

echo "🔄 Rebuilding database schema..."

# Set the database URL
FULL_DB_URL="postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a:5432/ccl_3?sslmode=require"

echo "✅ Database URL configured"

# Run the bullet-proof schema rebuild
echo "🚀 Running schema rebuild..."
PGPASSWORD=P8LUqfkbIB4noaUDthVtZETTWZR668nI \
psql -h dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com \
     -U ccl_3_user ccl_3 \
     -f rebuild-schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema rebuild completed successfully!"
    
    # Verify the tables were created
    echo "🔍 Verifying tables..."
    PGPASSWORD=P8LUqfkbIB4noaUDthVtZETTWZR668nI \
    psql -h dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com \
         -U ccl_3_user ccl_3 \
         -c "\dt"
    
    echo "🎉 Database rebuild complete!"
else
    echo "❌ Schema rebuild failed!"
    exit 1
fi 