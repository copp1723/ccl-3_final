# Understanding VALID_API_KEYS

## What is VALID_API_KEYS?

`VALID_API_KEYS` is a security feature that protects your API endpoints from unauthorized access. It's a comma-separated list of secret keys that external services must provide to access your API.

## Where it's used

Currently, it's used to secure:
1. **Boberdoo lead posting endpoint** (`/api/v1/boberdoo/leads`)
2. **Lead status endpoint** (`/api/leadStatus/:leadId`)

## How it works

When external services call your API, they must include an API key in either:
- Header: `X-API-Key: your-secret-key`
- Query parameter: `?api_key=your-secret-key`

## Setting up VALID_API_KEYS

### Option 1: Generate your own keys (Recommended)
Create strong, random API keys. Here are some examples:

```
VALID_API_KEYS=ccl3-prod-2024-a1b2c3d4e5f6,ccl3-prod-2024-z9y8x7w6v5u4
```

### Option 2: Use a key generator
```bash
# Generate a random API key using Node.js
node -e "console.log('ccl3-prod-' + require('crypto').randomBytes(16).toString('hex'))"
```

### Option 3: Simple keys for testing
```
VALID_API_KEYS=test-key-123,prod-key-456
```

## Example environment variable

Add this to your Render environment variables:
```
VALID_API_KEYS=ccl3-prod-2024-a1b2c3d4e5f6,partner-api-key-xyz789
```

## Who needs these keys?

1. **Boberdoo** - If they're posting leads to your system
2. **Any external partners** sending data to your API
3. **Your own services** if they need to call these endpoints

## Security notes

- Keep these keys secret
- Use different keys for different partners
- Rotate keys periodically
- Never commit keys to your repository

## If you're not using Boberdoo

If you're not currently integrating with Boberdoo or don't have external services calling your API, you can:

1. Set a placeholder value:
   ```
   VALID_API_KEYS=not-in-use-yet
   ```

2. Or leave it empty (the API will work without authentication in development mode)