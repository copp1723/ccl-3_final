#!/usr/bin/env node

/**
 * CCL-3 API Fix Script
 * Addresses the root causes of API endpoint failures
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 CCL-3 API Fix Script');
console.log('======================\n');

// Step 1: Update server index to use fallback repositories
console.log('1. Updating server to use fallback repositories when DB unavailable...');

const serverIndexOptimizedPath = path.join(__dirname, 'server/index-optimized.ts');
const serverIndexOptimizedContent = fs.readFileSync(serverIndexOptimizedPath, 'utf8');

// Replace db import with fallback version
const updatedServerContent = serverIndexOptimizedContent.replace(
  "db: () => import('./db')",
  "db: () => import('./db/index-with-fallback')"
);

if (updatedServerContent !== serverIndexOptimizedContent) {
  fs.writeFileSync(serverIndexOptimizedPath, updatedServerContent);
  console.log('✅ Updated server/index-optimized.ts to use fallback repositories');
} else {
  console.log('⚠️  Server already configured for fallback repositories');
}

// Step 2: Fix route registration in agent-configurations
console.log('\n2. Checking agent-configurations route...');

const agentConfigPath = path.join(__dirname, 'server/routes/agent-configurations.ts');
if (fs.existsSync(agentConfigPath)) {
  console.log('✅ agent-configurations.ts exists');
} else {
  console.log('❌ agent-configurations.ts missing - creating...');
  
  const agentConfigContent = `import { Router } from 'express';
import { AgentConfigurationsRepository } from '../db/index-with-fallback';

const router = Router();

// Get all agent configurations
router.get('/', async (req, res) => {
  try {
    const { type, active } = req.query;
    const filters: any = {};
    
    if (type) filters.type = type;
    if (active !== undefined) filters.active = active === 'true';
    
    const agents = await AgentConfigurationsRepository.findAll(filters);
    res.json({ agents });
  } catch (error) {
    console.error('Error fetching agent configurations:', error);
    res.status(500).json({ error: 'Failed to fetch agent configurations' });
  }
});

// Get agent by ID
router.get('/:id', async (req, res) => {
  try {
    const agent = await AgentConfigurationsRepository.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Create agent configuration
router.post('/', async (req, res) => {
  try {
    const agent = await AgentConfigurationsRepository.create(req.body);
    res.json({ agent });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Update agent configuration
router.put('/:id', async (req, res) => {
  try {
    const agent = await AgentConfigurationsRepository.update(req.params.id, req.body);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

export default router;
`;
  
  fs.writeFileSync(agentConfigPath, agentConfigContent);
  console.log('✅ Created agent-configurations.ts');
}

// Step 3: Fix conversations route
console.log('\n3. Checking conversations route...');

const conversationsPath = path.join(__dirname, 'server/routes/conversations.ts');
if (fs.existsSync(conversationsPath)) {
  console.log('✅ conversations.ts exists');
} else {
  console.log('❌ conversations.ts missing - creating...');
  
  const conversationsContent = `import { Router } from 'express';
import { ConversationsRepository } from '../db/index-with-fallback';

const router = Router();

// Get all conversations
router.get('/', async (req, res) => {
  try {
    const conversations = await ConversationsRepository.findAll();
    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

export default router;
`;
  
  fs.writeFileSync(conversationsPath, conversationsContent);
  console.log('✅ Created conversations.ts');
}

// Step 4: Fix campaigns route
console.log('\n4. Checking campaigns route...');

const campaignsPath = path.join(__dirname, 'server/routes/campaigns.ts');
if (fs.existsSync(campaignsPath)) {
  console.log('✅ campaigns.ts exists');
} else {
  console.log('❌ campaigns.ts missing - creating...');
  
  const campaignsContent = `import { Router } from 'express';
import { CampaignsRepository } from '../db/index-with-fallback';

const router = Router();

// Get all campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await CampaignsRepository.findAll();
    res.json({ campaigns });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Create campaign
router.post('/', async (req, res) => {
  try {
    const campaign = await CampaignsRepository.create(req.body);
    res.json({ campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

export default router;
`;
  
  fs.writeFileSync(campaignsPath, campaignsContent);
  console.log('✅ Created campaigns.ts');
}

// Step 5: Fix import route for analyze endpoint
console.log('\n5. Checking import route for analyze endpoint...');

const importPath = path.join(__dirname, 'server/routes/import.ts');
const importContent = fs.readFileSync(importPath, 'utf8');

if (!importContent.includes('/analyze')) {
  console.log('⚠️  /analyze endpoint missing - adding...');
  
  const analyzeEndpoint = `
// Analyze CSV file structure
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Read CSV headers
    const fileContent = req.file.buffer.toString('utf8');
    const lines = fileContent.split('\\n');
    const headers = lines[0]?.split(',').map(h => h.trim()) || [];
    
    res.json({
      headers,
      rowCount: lines.length - 1,
      fileName: req.file.originalname
    });
  } catch (error) {
    console.error('Error analyzing CSV:', error);
    res.status(500).json({ error: 'Failed to analyze CSV file' });
  }
});

export default router;`;
  
  const updatedImportContent = importContent.replace('export default router;', analyzeEndpoint);
  fs.writeFileSync(importPath, updatedImportContent);
  console.log('✅ Added /analyze endpoint to import.ts');
} else {
  console.log('✅ /analyze endpoint already exists');
}

// Step 6: Create .env if missing
console.log('\n6. Checking environment configuration...');

const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env missing - creating...');
  
  const envContent = `# CCL-3 Environment Configuration
NODE_ENV=development
PORT=5000

# Database (leave empty to use mock data)
DATABASE_URL=

# Feature flags
ENABLE_AGENTS=true
ENABLE_WEBSOCKET=true
ENABLE_REDIS=false
ENABLE_MONITORING=false

# Memory limit (MB)
MEMORY_LIMIT=512

# Email configuration (optional)
EMAIL_TEMPLATES_ENABLED=false
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAILGUN_FROM_EMAIL=noreply@example.com

# Twilio configuration (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# JWT secrets (will be auto-generated if not set)
JWT_SECRET=
JWT_REFRESH_SECRET=
SESSION_SECRET=
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file');
} else {
  console.log('✅ .env file exists');
}

console.log('\n✅ All fixes applied!');
console.log('\n📋 Next Steps:');
console.log('1. Run: chmod +x setup-diagnostic.sh');
console.log('2. Run: ./setup-diagnostic.sh');
console.log('3. Start the server: npm run dev');
console.log('4. In another terminal, start the client: cd client && npm run dev');
console.log('5. Test the API: node test-api-health.js');
console.log('\n💡 To deploy to Render:');
console.log('1. Commit all changes: git add -A && git commit -m "Fix API endpoints"');
console.log('2. Push to GitHub: git push origin main');
console.log('3. Render will auto-deploy with the corrected service name (ccl-3-final)');
