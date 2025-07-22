# Authentication Setup Guide

## Overview
This guide helps you set up proper authentication for your CCL-3 application in production.

## What Changed
1. **Removed hardcoded credentials** from `/server/routes/auth.ts`
2. **Fixed authentication middleware** in `/server/middleware/auth.ts` to remove hardcoded token bypass
3. **Created admin user creation script** for production setup

## Setting Up Authentication in Production (Render)

### 1. Environment Variables in Render
Make sure these environment variables are set in your Render dashboard:

```
SKIP_AUTH=false
JWT_SECRET=<generate-secure-32-char-string>
JWT_REFRESH_SECRET=<generate-secure-32-char-string>
SESSION_SECRET=<generate-secure-32-char-string>
```

To generate secure secrets, use:
```bash
openssl rand -hex 32
```

### 2. Creating an Admin User

#### Option A: Using Environment Variables (Recommended)
1. In Render, add these environment variables:
   ```
   ADMIN_EMAIL=admin@completecarloans.com
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<your-secure-password>
   ```

2. Run the admin creation script:
   ```bash
   npm run create-admin
   ```

#### Option B: Using the API Endpoint (Development Only)
If you're in development, you can use:
```bash
curl -X POST http://localhost:5000/api/auth/create-default-admin
```

### 3. Logging In
Once your admin user is created, you can log in using:
- **Email/Username**: Either the email or username you set
- **Password**: The password you configured

### 4. Security Best Practices
- Never commit passwords to version control
- Use strong, unique passwords for production
- Rotate JWT secrets periodically
- Monitor failed login attempts in the audit logs
- Consider implementing 2FA for admin accounts

## Troubleshooting

### "Invalid credentials" error
- Verify the admin user was created successfully
- Check that you're using the correct email/username and password
- Ensure SKIP_AUTH is set to false

### "Authentication required" error
- Check that JWT_SECRET is properly set in environment variables
- Verify the token is being sent in the Authorization header as "Bearer <token>"

### Database connection issues
- Verify DATABASE_URL is correctly set in Render
- Check that the database is accessible from your Render service

## Next Steps
1. Create your admin user using the instructions above
2. Test the login flow
3. Create additional users through the admin panel
4. Review audit logs to monitor authentication activity