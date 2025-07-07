#!/usr/bin/env tsx
// scripts/quick-setup.ts
// Run with: npx tsx scripts/quick-setup.ts

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

console.log('🚀 CCL Quick Setup for Local Development\n');

// 1. Check if .env exists and update with local defaults
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  fs.copyFileSync(envExamplePath, envPath);
}

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf-8');

// Generate secure keys
const encryptionKey = crypto.randomBytes(32).toString('base64');
const jwtSecret = crypto.randomBytes(32).toString('base64');
const apiKey = `ccl-${crypto.randomBytes(16).toString('hex')}`;

// Update .env with local development values
const updates = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ccl',
  ENCRYPTION_KEY: encryptionKey,
  API_KEY: apiKey,
  CCL_API_KEY: apiKey,
  INTERNAL_API_KEY: apiKey,
  JWT_SECRET: jwtSecret,
  SESSION_SECRET: jwtSecret,
  // Set some defaults to prevent errors
  MAILGUN_API_KEY: 'mg-test-key',
  MAILGUN_DOMAIN: 'sandbox.mailgun.org',
  OPENROUTER_API_KEY: 'test-key',
};

console.log('🔐 Generating secure keys...');
for (const [key, value] of Object.entries(updates)) {
  const regex = new RegExp(`^${key}=.*$`, 'gm');
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
}

fs.writeFileSync(envPath, envContent);
console.log('✅ Updated .env with local development values\n');

// 2. Start PostgreSQL with Docker if not running
console.log('🐘 Starting PostgreSQL with Docker...');
try {
  // Check if postgres is already running
  execSync('docker ps | grep postgres', { stdio: 'ignore' });
  console.log('✅ PostgreSQL is already running');
} catch {
  try {
    // Start postgres
    execSync('docker run -d --name ccl-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ccl postgres:15', { stdio: 'inherit' });
    console.log('✅ PostgreSQL started');
    
    // Wait for postgres to be ready
    console.log('⏳ Waiting for PostgreSQL to be ready...');
    setTimeout(() => {}, 3000);
  } catch (error) {
    console.log('⚠️  Could not start PostgreSQL. Please ensure Docker is installed or PostgreSQL is running on port 5432');
  }
}

// 3. Create a simple database initialization script
const dbInitScript = `
-- migrations/001_init.sql
-- Initial database setup for CCL

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS visitors (
  id SERIAL PRIMARY KEY,
  visitor_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  visitor_id VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  status VARCHAR(50) DEFAULT 'new',
  source VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  visitor_id VARCHAR(255),
  lead_id INTEGER REFERENCES leads(id),
  content TEXT,
  is_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_visitor_id ON leads(visitor_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_messages_visitor_id ON messages(visitor_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);

-- Insert some test data
INSERT INTO leads (visitor_id, email, phone, first_name, last_name, status, source) 
VALUES 
  ('test-001', 'john.doe@example.com', '+1234567890', 'John', 'Doe', 'new', 'website'),
  ('test-002', 'jane.smith@example.com', '+0987654321', 'Jane', 'Smith', 'contacted', 'campaign')
ON CONFLICT DO NOTHING;
`;

const migrationsDir = path.join(process.cwd(), 'migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir);
}
fs.writeFileSync(path.join(migrationsDir, '001_init.sql'), dbInitScript);
console.log('✅ Created initial migration file\n');

// 4. Create a simple server fix to handle missing routes
const serverFixScript = `
// server/routes/leads.ts
import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// Simple in-memory storage for quick testing
const leads: any[] = [
  { id: 1, visitor_id: 'test-001', email: 'john.doe@example.com', phone: '+1234567890', first_name: 'John', last_name: 'Doe', status: 'new', source: 'website', created_at: new Date() },
  { id: 2, visitor_id: 'test-002', email: 'jane.smith@example.com', phone: '+0987654321', first_name: 'Jane', last_name: 'Smith', status: 'contacted', source: 'campaign', created_at: new Date() }
];

// GET /api/leads
router.get('/', (req: Request, res: Response) => {
  res.json({ leads, total: leads.length });
});

// GET /api/leads/:id
router.get('/:id', (req: Request, res: Response) => {
  const lead = leads.find(l => l.id === parseInt(req.params.id));
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  res.json(lead);
});

// POST /api/leads
router.post('/', (req: Request, res: Response) => {
  const newLead = {
    id: leads.length + 1,
    ...req.body,
    created_at: new Date(),
    status: req.body.status || 'new'
  };
  leads.push(newLead);
  res.status(201).json(newLead);
});

// PUT /api/leads/:id
router.put('/:id', (req: Request, res: Response) => {
  const index = leads.findIndex(l => l.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  leads[index] = { ...leads[index], ...req.body };
  res.json(leads[index]);
});

export default router;
`;

const routesDir = path.join(process.cwd(), 'server', 'routes');
if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir, { recursive: true });
}
fs.writeFileSync(path.join(routesDir, 'leads.ts'), serverFixScript);
console.log('✅ Created leads API routes\n');

// 5. Create activities route
const activitiesRoute = `
// server/routes/activities.ts
import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// Mock activities data
const activities = [
  { id: 1, type: 'lead_created', description: 'New lead: John Doe', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
  { id: 2, type: 'email_sent', description: 'Campaign email sent to 25 leads', timestamp: new Date(Date.now() - 1000 * 60 * 60) },
  { id: 3, type: 'lead_updated', description: 'Lead status updated: Jane Smith', timestamp: new Date(Date.now() - 1000 * 60 * 90) },
];

router.get('/', (req: Request, res: Response) => {
  res.json(activities);
});

export default router;
`;

fs.writeFileSync(path.join(routesDir, 'activities.ts'), activitiesRoute);
console.log('✅ Created activities API routes\n');

// 6. Create a minimal server index that works
const minimalServer = `
// server/index-minimal.ts
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import leadsRouter from './routes/leads';
import activitiesRouter from './routes/activities';

config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// API routes
app.use('/api/leads', leadsRouter);
app.use('/api/activities', activitiesRouter);

// Campaigns endpoint
app.get('/api/campaigns', (req, res) => {
  res.json({
    campaigns: [
      { id: 1, name: 'Summer Sale', type: 'email', status: 'active', sent: 150, opened: 45 },
      { id: 2, name: 'New Customer Welcome', type: 'sms', status: 'draft', sent: 0, opened: 0 }
    ]
  });
});

// System stats endpoint
app.get('/api/system/stats', (req, res) => {
  res.json({
    totalLeads: 2,
    activeVisitors: 5,
    emailsSent: 150,
    conversionRate: 0.15
  });
});

// Chat endpoint (simple echo for now)
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  res.json({
    response: \`I received your message: "\${message}". This is a test response from the CCL system.\`,
    timestamp: new Date()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(\`✅ Server running on http://localhost:\${PORT}\`);
  console.log(\`📊 Dashboard: http://localhost:5173\`);
  console.log(\`🏥 Health check: http://localhost:\${PORT}/health\`);
});
`;

fs.writeFileSync(path.join(process.cwd(), 'server', 'index-minimal.ts'), minimalServer);
console.log('✅ Created minimal working server\n');

// 7. Update package.json to add quick start script
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

packageJson.scripts['dev:quick'] = 'cross-env NODE_ENV=development tsx server/index-minimal.ts';
packageJson.scripts['setup:quick'] = 'tsx scripts/quick-setup.ts';

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json with quick start script\n');

console.log('🎉 Setup complete! Now you can run:\n');
console.log('  1. npm run dev:quick    # Start the minimal server');
console.log('  2. npm run dev          # In another terminal, start the frontend');
console.log('\nThen open http://localhost:5173 to see your app!\n');
console.log('💡 The server is using in-memory data for quick testing.');
console.log('   To connect to a real database, update the database configuration in server/db.ts\n');
