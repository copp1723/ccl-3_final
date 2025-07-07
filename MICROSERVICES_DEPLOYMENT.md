# CCL-3 Microservices Deployment Guide

## Architecture Overview

Instead of one monolithic app using 500MB+, we now have:

1. **API Service** (100-150MB) - Handles HTTP requests
2. **Agent Service** (200-300MB) - AI processing 
3. **WebSocket Service** (50-100MB) - Real-time chat
4. **Serverless Functions** (0MB) - Heavy operations

Total: ~400MB spread across services vs 500MB+ monolith

## Deployment Options

### Option 1: Render Services (Recommended)
Deploy each service as a separate Render service:

```bash
# 1. API Service
- Name: ccl3-api
- Build: npm install && npm run build:api
- Start: node dist/services/api/index.js
- Plan: Starter ($7/mo)

# 2. Agent Service  
- Name: ccl3-agents
- Build: npm install && npm run build:agents
- Start: node dist/services/agents/index.js
- Plan: Starter ($7/mo)

# 3. WebSocket Service
- Name: ccl3-websocket
- Build: npm install && npm run build:websocket
- Start: node dist/services/websocket/index.js
- Plan: Starter ($7/mo)
```

Total: $21/month with better performance

### Option 2: Vercel + Render Hybrid
- Deploy serverless functions to Vercel (free)
- Deploy only WebSocket service to Render ($7/mo)
- Use Vercel for static files (free)

```bash
# Deploy to Vercel
vercel --prod

# Set environment variables
vercel env add OPENROUTER_API_KEY
vercel env add DATABASE_URL
```

### Option 3: Docker Swarm/Kubernetes
For larger scale:

```bash
# Build all services
docker-compose build

# Deploy to Docker Swarm
docker stack deploy -c docker-compose.yml ccl3

# Or deploy to Kubernetes
kubectl apply -f k8s/
```

## Migration Steps

### 1. Deploy Serverless Functions First
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Note the URLs for your functions
```

### 2. Update Environment Variables
```env
# Add to your .env
EMAIL_GEN_URL=https://your-app.vercel.app/api/functions/generate-email
LEAD_PROCESS_URL=https://your-app.vercel.app/api/functions/process-lead
AGENT_SERVICE_URL=https://ccl3-agents.onrender.com
WEBSOCKET_URL=wss://ccl3-websocket.onrender.com
```

### 3. Deploy Microservices
```bash
# Deploy each service to Render
# Use the Render dashboard or CLI
```

### 4. Update DNS/Proxy
Point your domain to the new services using Cloudflare or Nginx.

## Benefits

1. **Memory Efficiency**
   - Each service uses only what it needs
   - Can scale services independently
   - Failures isolated to single service

2. **Cost Optimization**
   - Run expensive AI operations on serverless (pay per use)
   - Keep lightweight services on cheap plans
   - Scale only what needs scaling

3. **Development Speed**
   - Faster deployments (smaller services)
   - Easier debugging (isolated concerns)
   - Team can work on different services

4. **Reliability**
   - If agents crash, API still works
   - If WebSocket fails, core features remain
   - Automatic restarts per service

## Monitoring

Each service exposes `/health`:
```bash
curl https://ccl3-api.onrender.com/health
curl https://ccl3-agents.onrender.com/health
curl https://ccl3-websocket.onrender.com/health
```

## Rollback Plan

If issues arise, the monolith is still available:
```bash
# Deploy original monolith
git checkout main
npm run build
# Deploy to Render as before
```