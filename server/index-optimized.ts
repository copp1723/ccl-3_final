// OPTIMIZED SERVER FOR RENDER DEPLOYMENT
require('dotenv/config');
const express = require('express');
const { createServer } = require('http');
const { fileURLToPath } = require('url');
const { dirname, join } = require('path');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
app.use(express.static(join(__dirname, './client')));

// React app fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(__dirname, './client/index.html'));
});

// Start server
server.listen(PORT, () => {
  const mem = process.memoryUsage();
  console.log(`Optimized server started on port ${PORT}`);
  console.log(`Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server shutting down');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server shutting down');
    process.exit(0);
  });
});