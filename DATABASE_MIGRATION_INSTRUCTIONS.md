# Database Migration Instructions for CCL-3

## Issue Description
The deployed database schema does not match the expected schema from `migrations/0000_large_carnage.sql`. Specifically, the database is missing:
- The `channel` enum type (`email`, `sms`, `chat`)
- The `assigned_channel` column in the `leads` table
- Potentially other schema elements

## Solution
I've created comprehensive migration scripts to fix the database schema on your Render deployment.

## Files Created
1. `scripts/database/apply-production-migration.sql` - Safe SQL migration script
2. `scripts/database/apply-migration.js` - Node.js script to apply the migration
3. `scripts/run-production-migration.sh` - Shell script wrapper
4. Added npm scripts: `db:apply-migration` and `db:migrate-production`

## How to Apply the Migration

### Option 1: Using Render Shell (Recommended)
1. Go to your Render dashboard
2. Open your CCL-3 service
3. Go to the "Shell" tab
4. Run one of these commands:

```bash
# Using npm script
npm run db:apply-migration

# Or using the shell script
./scripts/run-production-migration.sh

# Or directly with node
node scripts/database/apply-migration.js
```

### Option 2: Manual SQL Execution
If you prefer to run the SQL directly:

1. Connect to your Render PostgreSQL database using their console or a tool like pgAdmin
2. Copy and paste the contents of `scripts/database/apply-production-migration.sql`
3. Execute the SQL statements

### Option 3: Local Testing First
Test the migration locally first:

```bash
# Set your local database URL
export DATABASE_URL="your_local_database_url"

# Run the migration
npm run db:apply-migration
```

## What the Migration Does

### Safe Operations
- ✅ Creates enum types only if they don't exist
- ✅ Creates tables only if they don't exist  
- ✅ Adds columns only if they don't exist
- ✅ Adds foreign key constraints only if they don't exist
- ✅ Provides detailed logging of all operations
- ✅ Verifies the schema after migration

### Schema Changes Applied
1. **Enum Types:**
   - `agent_type` ENUM: 'overlord', 'email', 'sms', 'chat'
   - `channel` ENUM: 'email', 'sms', 'chat'  
   - `lead_status` ENUM: 'new', 'contacted', 'qualified', 'sent_to_boberdoo', 'rejected', 'archived'

2. **Tables Created/Updated:**
   - `leads` table with `assigned_channel` column
   - `agent_decisions` table
   - `campaigns` table
   - `communications` table
   - `conversations` table

3. **Foreign Key Constraints:**
   - All proper relationships between tables

## Expected Output
When the migration runs successfully, you should see:
```
🚀 Starting database migration...
✅ Connected to database
📄 Loaded migration SQL file
🔄 Executing X migration statements...
✅ Migration completed successfully

🔍 Verifying database schema...
   Channel enum exists: ✅
   assigned_channel column exists: ✅
   Total tables: 5
   Tables: agent_decisions, campaigns, communications, conversations, leads

🎉 Database migration verification complete!
```

## Troubleshooting

### If you get permission errors:
Make sure your DATABASE_URL has the correct permissions for DDL operations.

### If you get "already exists" warnings:
This is normal and safe - the script skips existing objects.

### If the script fails:
1. Check that your DATABASE_URL is correctly set
2. Ensure the database is accessible
3. Check the error message for specific issues

## After Migration
Once the migration is complete:
1. Your CCL-3 application should work without schema errors
2. The email agent clicking should work properly
3. All database operations should function correctly

## Verification
You can verify the migration worked by checking:
1. No more database schema errors in your application logs
2. The email agent interface loads and is clickable
3. Lead creation and management works properly

---

**Important:** This migration is designed to be safe and idempotent - you can run it multiple times without causing issues.