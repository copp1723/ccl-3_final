# Render Deployment Guide for CCL-3

## Current Status
Your app is deployed but running with memory optimization to work within Render's free tier limits.

## Memory Optimization Settings
The application runs with:
- **256MB memory limit** to prevent crashes
- **Redis disabled** by default (to save memory)
- **Monitoring disabled** (health checks, metrics, performance monitoring)
- **Queue system disabled**

## To Enable Redis
If you need Redis functionality:

1. Add this environment variable in Render:
   ```
   ENABLE_REDIS=true
   ```

2. Make sure your Redis URL is correct. The internal URL format should be:
   ```
   redis://red-d1lvtlqdbo4c73aeem10:6379
   ```

3. Note: Enabling Redis will increase memory usage and might cause issues on the free tier.

## Environment Variables Checklist
✅ DATABASE_URL
✅ JWT_SECRET
✅ JWT_REFRESH_SECRET  
✅ SESSION_SECRET
✅ OPENROUTER_API_KEY
✅ MAILGUN_API_KEY
✅ MAILGUN_DOMAIN
✅ MAIL_FROM (should be MAILGUN_FROM_EMAIL)
✅ TWILIO_ACCOUNT_SID
✅ TWILIO_AUTH_TOKEN
✅ NODE_ENV=production
✅ REDIS_URL

## Missing Environment Variables
Add these for full functionality:
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `MAILGUN_FROM_EMAIL` - Same as MAIL_FROM
- `VALID_API_KEYS` - For API authentication
- `BOBERDOO_API_KEY` - If using Boberdoo integration

## Upgrading for Full Features
To run all features (Redis, monitoring, queue system), you'll need to:

1. Upgrade to a paid Render plan with more memory
2. Set these environment variables:
   ```
   ENABLE_REDIS=true
   ENABLE_QUEUE=true
   ENABLE_HEALTH_CHECKS=true
   ENABLE_METRICS=true
   ```
3. Use the full startup command:
   ```
   npm run start:full
   ```

## Monitoring Your Deployment
- Check logs: Render Dashboard → Your Service → Logs
- Monitor memory usage in the Metrics tab
- If you see memory errors, disable more features or upgrade your plan

## Troubleshooting
1. **High memory usage**: Disable Redis and other features
2. **Redis connection errors**: Check the Redis URL and ensure Redis service is running
3. **API errors**: Verify all required environment variables are set