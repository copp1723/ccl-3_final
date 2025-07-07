# Missing Environment Variables for Render

Add these to your Render environment variables:

## Required for SMS functionality:
```
TWILIO_PHONE_NUMBER=+1234567890
```
Replace with your actual Twilio phone number (format: +1XXXXXXXXXX)

## Required for email functionality:
```
MAILGUN_FROM_EMAIL=ccl@mg.watchdogai.us
```
(You already have MAIL_FROM, but some parts of the code look for MAILGUN_FROM_EMAIL)

## Required for API security:
```
VALID_API_KEYS=your-api-key-1,your-api-key-2
```
Add comma-separated API keys for external services to authenticate with your API

## Required for Boberdoo integration:
```
BOBERDOO_API_URL=https://api.boberdoo.com
BOBERDOO_API_KEY=your-boberdoo-api-key
```

## Optional performance tuning:
```
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

## To temporarily disable Redis (if having issues):
```
ENABLE_REDIS=false
```

## Complete list to add:
1. TWILIO_PHONE_NUMBER
2. MAILGUN_FROM_EMAIL  
3. VALID_API_KEYS
4. BOBERDOO_API_URL
5. BOBERDOO_API_KEY