# API 404 Error Root Cause Analysis

## Summary
The 404 errors you're seeing are caused by a **fundamental mismatch** between:
1. The **minimal production server** (`index-optimized.js`) that only has 2 API endpoints
2. The **full-featured client** that expects dozens of API endpoints

## The Real Problem

### Production Server (index-optimized.js)
The optimized production server only implements:
```javascript
// Only 2 endpoints exist:
app.get('/api/leads', ...)     // Returns empty array
app.post('/api/leads', ...)    // Returns success message
```

### Client Expectations
The client is trying to call:
- `/api/branding/ccl-3-final` - **NOT IMPLEMENTED** in production server
- `/api/leads/stats/summary` - **NOT IMPLEMENTED** in production server

## Why This Happened

1. **Two Different Servers**:
   - `server/index.ts` - Full server with all routes (27+ endpoints)
   - `server/index-optimized.js` - Minimal server with only 2 endpoints

2. **Production Uses Wrong Server**:
   - The build script copies `index-optimized.js` to `dist/`
   - This minimal server was meant for testing deployment, not production use

3. **Client-Server Mismatch**:
   - Client was built expecting the full API
   - Production runs the minimal server without those APIs

## Additional Issue: Client ID Detection

The client also has a multi-tenancy feature that's misinterpreting the Render URL:
- URL: `ccl-3-final.onrender.com`
- Client extracts: `ccl-3-final` as a client ID
- Tries to call: `/api/branding/ccl-3-final` instead of `/api/branding`

## Solution

You need to use the **full server** in production, not the minimal one:

### Option 1: Quick Fix (Use Full Server)
Update `scripts/render-build-optimized.sh` to build the full server:
```bash
# Change line 36 from:
cp server/index-optimized.js dist/index-optimized.js

# To:
npx esbuild server/index.ts --bundle --platform=node --format=cjs --outfile=dist/index-optimized.js --external:pg-native
```

### Option 2: Update package.json start script
Change the start script to use the full server:
```json
"start": "NODE_ENV=production tsx server/index.ts"
```

### Option 3: Build a Proper Production Server
Create a production-ready server that includes all necessary routes but with optimizations.

## Verification Steps

1. The minimal server at line 40-41 returns 404 for any `/api/*` path not explicitly defined
2. The client needs routes like `/api/branding/:clientId` and `/api/leads/stats/summary`
3. These routes only exist in the full server (`index.ts`), not in `index-optimized.js`

## Immediate Action Required

The production deployment is using a skeleton server meant for testing. You need to deploy the full server to have a functional application.