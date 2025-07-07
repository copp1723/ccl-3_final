# 🚨 Troubleshooting: "This site can't be reached"

## Quick Fix Steps

### 1. First, test if Node.js is working:
```bash
cd /Users/copp1723/Desktop/CCL-3
node test-server.js
```
Then open http://localhost:3333 in your browser. If this works, Node.js is fine.

### 2. Install dependencies (if not done):
```bash
cd /Users/copp1723/Desktop/CCL-3
npm install
```
This will take 2-3 minutes. You should see a progress bar.

### 3. Start the servers manually:

**Terminal 1 - Backend:**
```bash
cd /Users/copp1723/Desktop/CCL-3
npm run dev:quick
```
You should see: `✅ Server running on http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd /Users/copp1723/Desktop/CCL-3
npm run dev
```
You should see Vite starting and showing `Local: http://localhost:5173`

### 4. If ports are in use:
Check what's using the ports:
```bash
# Mac/Linux:
lsof -i :5000
lsof -i :5173

# Windows:
netstat -ano | findstr :5000
netstat -ano | findstr :5173
```

### 5. Run the debug script:
```bash
npm run debug
```
This will check for common issues.

## Common Issues & Solutions

### ❌ "command not found: npm"
- Install Node.js from https://nodejs.org (LTS version)

### ❌ "Cannot find module"
- Run `npm install` first

### ❌ "Port already in use"
- Kill the process using the port or change the port in .env

### ❌ "ENOENT: no such file or directory"
- Make sure you're in the CCL-3 directory
- Run `pwd` to check your current directory

### ❌ Blank page or connection refused
- Make sure BOTH servers are running (backend on 5000, frontend on 5173)
- Check the terminal windows for error messages

## Still not working?

Try the minimal test:
1. `cd /Users/copp1723/Desktop/CCL-3`
2. `node test-server.js`
3. Open http://localhost:3333

If this works, the issue is with the app setup, not your system.
