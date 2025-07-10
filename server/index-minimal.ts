// ULTRA-MINIMAL SERVER FOR 512MB MEMORY LIMIT
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { LeadsRepository, AgentDecisionsRepository, closeConnection } from './db';
import { logger } from './utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Absolute minimal middleware
app.use(express.json({ limit: '100kb' }));

// Health check
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({ 
    status: 'ok',
    memory: {
      used: Math.round(mem.heapUsed / 1024 / 1024),
      total: Math.round(mem.heapTotal / 1024 / 1024),
      percent: Math.round((mem.heapUsed / mem.heapTotal) * 100)
    }
  });
});

// Core API endpoints only
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await LeadsRepository.findAll({ limit: 20 });
    res.json({ leads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const lead = await LeadsRepository.create({
      name: req.body.name || 'Unknown',
      email: req.body.email,
      phone: req.body.phone,
      source: req.body.source || 'api',
      status: 'new',
      qualificationScore: 0,
      metadata: {}
    });
    
    // Simple decision without loading agents
    await AgentDecisionsRepository.create(
      lead.id.toString(),
      'overlord',
      'lead_created',
      'Lead saved to database',
      { source: req.body.source }
    );
    
    res.json({ success: true, leadId: lead.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Serve static files
app.use(express.static(join(__dirname, './client')));

// Catch-all for React
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(__dirname, './client/index.html'));
});

// Start server
server.listen(PORT, () => {
  const mem = process.memoryUsage();
  console.log(`Minimal server on port ${PORT}`);
  console.log(`Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  server.close(async () => {
    await closeConnection();
    process.exit(0);
  });
});