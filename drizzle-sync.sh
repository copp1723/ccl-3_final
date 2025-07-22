#!/bin/bash
set -e

echo "🗄️ Running database schema sync via Drizzle..."

# Set the database URL
export DATABASE_URL="postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3"

echo "📋 Using Drizzle to push schema changes..."

# Use Drizzle to push schema changes directly
npm run db:push

echo "✅ Database schema updated successfully!"
echo "🔄 Your application should now work properly."
