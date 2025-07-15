# Render Database Setup Instructions

## Your PostgreSQL Database Details

You have a PostgreSQL database service named `ccl-3` in Render.

### Connection String
```
postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a/ccl_3
```

## Setup Instructions

### 1. Add DATABASE_URL to Render Environment Variables

1. Go to your Render dashboard
2. Click on your `ccl-3-final` web service
3. Go to "Environment" tab
4. Add the following environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3`

**Important**: Notice I added `.oregon-postgres.render.com` to the hostname. This is required for external connections.

### 2. Internal vs External Database URLs

- **Internal URL** (for services in same Render region): 
  ```
  postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a/ccl_3
  ```

- **External URL** (for connections from outside Render):
  ```
  postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3
  ```

### 3. Database Connection Fix

The `query.getSQL is not a function` error has been fixed in the code. The issue was with the SQL import in the connection manager.

### 4. Run Database Migrations

After setting up the DATABASE_URL, you may need to run migrations:

1. In Render dashboard, go to "Shell" tab
2. Run: `npm run db:push` or `npm run db:migrate`

### 5. Verify Connection

Once deployed with the DATABASE_URL, the logs should show:
- "Database connection successful" instead of connection errors
- No more "using mock data only" messages

## Security Note

The database password shown here should be kept secure. Consider rotating it periodically through the Render dashboard.