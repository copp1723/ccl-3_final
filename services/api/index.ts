// Lightweight API Service - handles HTTP requests only
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { LeadsRepository } from '../../server/db';
import { logger } from '../../server/utils/logger';

const app = express();
const PORT = process.env.PORT || 3001;

// Minimal middleware
app.use(cors());
app.use(express.json({ limit: '100kb' })); // Small limit

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api' });
});

// Lead creation endpoint - delegates to agent service
const createLeadSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
});

app.post('/api/leads', async (req, res) => {
  try {
    const data = createLeadSchema.parse(req.body);
    
    // Save to database
    const lead = await LeadsRepository.create({
      ...data,
      status: 'new',
      qualificationScore: 0,
      metadata: {},
    });
    
    // Async call to agent service (fire and forget)
    fetch(`${process.env.AGENT_SERVICE_URL}/process-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id })
    }).catch(err => logger.error('Failed to notify agent service', err));
    
    res.json({ success: true, leadId: lead.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get leads - simple database query
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await LeadsRepository.findAll({ limit: 50 });
    res.json({ leads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

app.listen(PORT, () => {
  console.log(`API Service running on port ${PORT}`);
  console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});