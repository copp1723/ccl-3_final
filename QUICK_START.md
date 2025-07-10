# 🚀 SWARM Quick Start Guide

## Get Your App Running in 5 Minutes

### 1. First-Time Setup (Do This Once)
```bash
# Install dependencies
npm install

# Run the quick setup script (creates .env, starts postgres, etc.)
npm run setup:quick
```

### 2. Start the Application
Open two terminal windows:

**Terminal 1 - Backend:**
```bash
npm run dev:quick
```
This starts a minimal backend server with in-memory data on http://localhost:5000

**Terminal 2 - Frontend:**
```bash
npm run dev
```
This starts the React frontend on http://localhost:5173

### 3. Open Your Browser
Go to http://localhost:5173 and you should see your SWARM dashboard!

## What Works Right Now
- ✅ Dashboard with stats
- ✅ Lead management (create, view, edit)
- ✅ Activities feed
- ✅ Basic chat widget
- ✅ Campaign list view

## What's Using Mock Data
- 📦 All data is in-memory (not connected to real database yet)
- 📦 Chat responses are simple echoes
- 📦 Email/SMS sending is not connected
- 📦 External integrations (Mailgun, Twilio, etc.) are mocked

## Next Steps
1. **Connect Real Database**: Update `server/db.ts` with your PostgreSQL connection
2. **Add Real AI**: Configure OpenRouter API key in `.env`
3. **Enable Email**: Add Mailgun credentials in `.env`
4. **Enable SMS**: Add Twilio credentials in `.env`

## Troubleshooting
- **Port 5000 already in use?** Change the PORT in `.env`
- **Can't connect to database?** The quick setup uses in-memory data, no database needed
- **Frontend not loading?** Make sure both terminals are running (backend + frontend)

## Full Setup (When Ready for Real Data)
See the complete setup guide in `REAL_DATA_TESTING_GUIDE.md`
