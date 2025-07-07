# Redis Setup on Render

## Important: Complete Redis URL Required

The Redis URL you provided (`redis://red-d1lvtlqdbo4c73aeem10:6379`) appears to be incomplete. 

Render typically provides two types of Redis URLs:

### 1. Internal Redis URL (for services within Render):
- Format: `redis://red-xxxxx:6379`
- Use this when connecting from other services hosted on Render
- Lower latency, no internet round-trip

### 2. External Redis URL (for external connections):
- Format: `rediss://red-xxxxx.render.com:6379` (note the 'rediss' with double 's' for TLS)
- Use this when connecting from your local machine or external services
- Requires TLS/SSL connection

## Getting the Complete URL from Render:

1. Go to your Render Dashboard
2. Click on your Redis service
3. Look for "Connect" or "Connection Info" section
4. You'll see both Internal and External connection strings

## For Local Development:
Use the **External Redis URL** which should look like:
```
rediss://red-d1lvtlqdbo4c73aeem10.render.com:6379
```

## For Production (services on Render):
Use the **Internal Redis URL** which should look like:
```
redis://red-d1lvtlqdbo4c73aeem10:6379
```

## Update your .env file:

For local development:
```bash
REDIS_URL=rediss://red-d1lvtlqdbo4c73aeem10.render.com:6379
```

For production on Render:
```bash
REDIS_URL=redis://red-d1lvtlqdbo4c73aeem10:6379
```

## Note on Authentication:
If your Redis instance requires authentication, the URL format would be:
```
redis://:password@hostname:port
```

Please check your Render dashboard for the complete connection details!