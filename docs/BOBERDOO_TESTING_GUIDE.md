# Boberdoo Integration Testing Guide

## Overview
CCL-3 SWARM now includes full Boberdoo integration with proper test lead handling according to Boberdoo's industry standards.

## Testing Endpoints

### 1. Lead Posting Endpoint
```
POST /api/postLead
Content-Type: application/x-www-form-urlencoded
```

### 2. Ping Test
```
GET /api/ping
```

### 3. Lead Status Check
```
GET /api/leadStatus/{leadId}
X-API-Key: your-api-key
```

## Test Lead Configuration

### Method 1: Using Test_Lead Parameter
Include `Test_Lead=1` in your POST data:
```bash
curl -X POST http://localhost:5000/api/postLead \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Test_Lead=1&src=test&name=John+Doe&email=john@example.com&phone=555-1234&zip=12345"
```

### Method 2: Using Test Zip Code
Use `zip=99999` to trigger test mode:
```bash
curl -X POST http://localhost:5000/api/postLead \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "src=test&name=Jane+Doe&email=jane@example.com&phone=555-5678&zip=99999"
```

## API Key Authentication

For production mode (`mode=full`), include your API key:
```bash
curl -X POST http://localhost:5000/api/postLead?mode=full \
  -H "X-API-Key: test-key-123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "src=prod&name=Real+Lead&email=real@example.com&phone=555-9999&zip=90210"
```

## Response Format

All responses are in XML format per Boberdoo standards:

### Successful Match
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <status>matched</status>
  <lead_id>abc123</lead_id>
  <buyer_id>buyer456</buyer_id>
  <price>25.00</price>
  <message>Test lead matched successfully</message>
</response>
```

### No Match
```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <status>unmatched</status>
  <lead_id>abc123</lead_id>
  <buyer_id></buyer_id>
  <price>0</price>
  <message>No buyer found for test lead</message>
</response>
```

## Test Buyer Setup

Per Boberdoo documentation, create a test buyer that ONLY accepts:
- `zip=99999`

This ensures test leads never match real buyers.

## Important Testing Notes

1. **Test leads are NOT saved to database** - They process through the system but aren't stored
2. **Buyer filters are still checked** - Even test leads go through matching logic
3. **Use low fund amounts** for test buyers
4. **Set daily lead limits** on test buyers
5. **DISABLE test buyers after testing**

## Testing Workflow

1. Start with ping test to verify API is running
2. Send test lead with `Test_Lead=1`
3. Verify XML response format
4. Test with `zip=99999` 
5. Test API key validation with `mode=full`
6. Check lead status endpoint
7. Remove `Test_Lead=1` for production

## Debugging

Enable debug logging by setting:
```bash
DEBUG=ccl3:boberdoo npm run dev
```

Monitor console for:
- "Received TEST lead" vs "Received LIVE lead"
- Boberdoo submission attempts
- Match/unmatch decisions
- Test lead indicators

## Production Checklist

Before going live:
- [ ] Remove `Test_Lead=1` from vendor submissions
- [ ] Ensure real zip codes are used
- [ ] Disable test buyers
- [ ] Verify API keys are set
- [ ] Confirm Boberdoo credentials in .env
- [ ] Test with real buyer filters