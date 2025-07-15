// OPTIMIZED SERVER FOR RENDER DEPLOYMENT
require('dotenv/config');
const express = require('express');
const { createServer } = require('http');
const path = require('path');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Minimal middleware
app.use(express.json({ limit: '100kb' }));

// Health check
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({ 
    status: 'ok',
    memory: {
      used: Math.round(mem.heapUsed / 1024 / 1024),
      total: Math.round(mem.heapTotal / 1024 / 1024)
    }
  });
});

// Minimal API endpoints for deployment testing
app.get('/api/leads', (req, res) => {
  res.json({ leads: [], message: 'Minimal deployment mode' });
});

app.post('/api/leads', (req, res) => {
  res.json({ success: true, message: 'Minimal deployment mode' });
});

// Serve static files
app.use(express.static(path.join(__dirname, './client')));

// React app fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, './client/index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Memory optimization
if (global.gc) {
  setInterval(() => {
    global.gc();
  }, 30000);
}

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 