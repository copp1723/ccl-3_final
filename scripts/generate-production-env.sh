#!/bin/bash

# Generate Production Environment Variables
# Run this script to generate all required secrets for production deployment

echo "🔐 Generating Production Environment Variables..."
echo ""
echo "Copy these to your production deployment platform (Render.com):"
echo "=================================================================="
echo ""

echo "# 🔒 Security Keys (REQUIRED)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"
echo ""

echo "# 🌐 URLs and CORS (UPDATE WITH YOUR DOMAINS)"
echo "API_BASE_URL=https://your-app-name.onrender.com"
echo "CLIENT_URL=https://your-frontend-domain.com"
echo "FRONTEND_URL=https://your-frontend-domain.com"
echo "ALLOWED_ORIGINS=https://your-frontend-domain.com"
echo ""

echo "# 📡 Database & Cache (UPDATE WITH YOUR VALUES)"
echo "DATABASE_URL=postgresql://username:password@host:port/database"
echo "REDIS_URL=redis://username:password@host:port"
echo ""

echo "# ⚙️ Application Settings"
echo "NODE_ENV=production"
echo "PORT=10000"
echo ""

echo "# 🛡️ Rate Limiting"
echo "RATE_LIMIT_WINDOW_MS=900000"
echo "RATE_LIMIT_MAX_REQUESTS=100"
echo ""

echo "# 📝 Logging"
echo "LOG_LEVEL=info"
echo "ENABLE_REQUEST_LOGGING=false"
echo ""

echo "# 🎛️ Feature Flags"
echo "ENABLE_CREDIT_CHECK=false"
echo "ENABLE_EMAIL_CAMPAIGNS=false"
echo "ENABLE_REAL_TIME_CHAT=false"
echo ""

echo "=================================================================="
echo ""
echo "📋 NEXT STEPS:"
echo "1. Copy the variables above"
echo "2. Set them in your Render.com environment settings"
echo "3. Update the URLs with your actual domains"
echo "4. Update database and Redis URLs with real credentials"
echo "5. Deploy your application"
echo ""
echo "⚠️  IMPORTANT: Keep these secrets secure and never commit them to code!"