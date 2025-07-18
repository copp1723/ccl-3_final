# CCL-3 Deployment Guide

## Pre-Deployment Checklist

Run the pre-deployment check script:
```bash
./scripts/pre-deploy-check.sh
```

## Environment Setup

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `SESSION_SECRET` - Session encryption key
- `OPENROUTER_API_KEY` - OpenRouter API key for AI agents
- Model configurations (SIMPLE_MODEL, MEDIUM_MODEL, COMPLEX_MODEL, FALLBACK_MODEL)

### Optional Services
- Redis (for caching and job queues)
- Twilio (for SMS)
- Mailgun (for email)
- Boberdoo (for lead management)
- SuperMemory (for agent memory)

## Build Process

### Local Build
```bash
# Install dependencies
npm install

# Build client and server
npm run build

# Start production server
npm start
```

### Docker Build
```bash
# Build Docker image
docker build -t ccl3-swarm .

# Run with env file
docker run --env-file .env -p 5000:5000 ccl3-swarm
```

## Deployment Platforms

### Render
1. Connect GitHub repository
2. Set environment variables in Render dashboard
3. Deploy with:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

### Heroku
```bash
# Create app
heroku create ccl3-swarm

# Set buildpacks
heroku buildpacks:set heroku/nodejs

# Deploy
git push heroku main
```

### Manual Server
1. Clone repository
2. Copy `.env.production` to `.env`
3. Run database migrations
4. Build and start:
```bash
npm install
npm run build
pm2 start ecosystem.config.js
```

## Database Migrations

Run migrations before starting the application:
```bash
cd server
npm run db:migrate
```

## Monitoring

- Health check endpoint: `/health`
- Metrics endpoint: `/api/system/metrics`
- Logs: Check `logs/` directory or cloud provider logs

## Troubleshooting

### Common Issues

1. **TypeScript Build Errors**
   - Run `npm run type-check` to identify issues
   - Check for missing type definitions

2. **Missing Dependencies**
   - Ensure all packages are installed
   - Check for version conflicts

3. **Database Connection**
   - Verify DATABASE_URL is correct
   - Check network/firewall settings

4. **API Keys**
   - Ensure all required API keys are set
   - Verify keys are valid and have correct permissions

## Security Checklist

- [ ] All API keys are set as environment variables
- [ ] Database uses SSL in production
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation is in place
- [ ] Authentication is required for protected routes

## Performance Optimization

- Enable Redis for caching
- Use CDN for static assets
- Enable gzip compression
- Optimize database queries with indexes
- Monitor memory usage

## Rollback Plan

1. Keep previous version tagged
2. Database backups before migration
3. Feature flags for new functionality
4. Quick rollback command:
```bash
git checkout v1.0.0
npm install
npm run build
pm2 restart all
```