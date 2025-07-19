import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

// Create minimal test server
const app = express();
app.use(express.json());

// Test the specific failing routes
console.log('🧪 Testing specific failing routes...\n');

// 1. Test /api/branding/ccl-3-final
app.get('/api/branding/:clientId', (req, res) => {
  console.log(`Branding route called for: ${req.params.clientId}`);
  
  // Static branding data that should exist
  const brandings = {
    'ccl-3-final': {
      id: 'ccl-3-final',
      name: 'CCL-3 SWARM',
      branding: {
        companyName: 'CCL-3 SWARM',
        primaryColor: '#2563eb',
        secondaryColor: '#1d4ed8',
        emailFromName: 'CCL-3 SWARM',
        supportEmail: 'support@ccl3swarm.com'
      },
      isStatic: true
    }
  };
  
  const branding = brandings[req.params.clientId];
  if (branding) {
    res.json({ success: true, branding });
  } else {
    res.status(404).json({ success: false, error: 'Branding not found' });
  }
});

// 2. Test /api/agent-configurations
app.get('/api/agent-configurations', (req, res) => {
  console.log('Agent configurations route called');
  
  // Mock response
  res.json({
    agents: [],
    total: 0,
    offset: 0,
    limit: 50
  });
});

// 3. Test /api/leads
app.get('/api/leads', (req, res) => {
  console.log('Leads route called');
  
  // Mock response to test if route works
  res.json({
    success: true,
    leads: [],
    pagination: {
      total: 0,
      limit: 50,
      offset: 0,
      pages: 0
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server running' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error', message: error.message });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

const port = 5002;
const server = app.listen(port, () => {
  console.log(`🚀 Test server running on http://localhost:${port}\n`);
  
  // Test the failing endpoints
  setTimeout(async () => {
    const endpoints = [
      '/api/branding/ccl-3-final',
      '/api/agent-configurations',
      '/api/leads',
      '/health'
    ];
    
    console.log('Testing endpoints...\n');
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        const data = await response.text();
        console.log(`✅ ${endpoint}: ${response.status} ${response.statusText}`);
        if (response.status !== 200) {
          console.log(`   Response: ${data}\n`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.message}\n`);
      }
    }
    
    console.log('🎯 Test complete! These routes should work.\n');
    console.log('If they work here but not in your main app, the issue is likely:');
    console.log('1. Database connection problems');
    console.log('2. Middleware blocking requests');
    console.log('3. Route registration order');
    console.log('4. Authentication/authorization issues\n');
    
    server.close();
  }, 1000);
});
