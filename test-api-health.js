#!/usr/bin/env node

import 'dotenv/config';
import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

const endpoints = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/branding' },
  { method: 'GET', path: '/api/agent-configurations' },
  { method: 'GET', path: '/api/conversations' },
  { method: 'GET', path: '/api/campaigns' },
  { method: 'GET', path: '/api/leads' },
  { method: 'POST', path: '/api/import/analyze', body: { test: true } }
];

console.log(`\n🔍 Testing API endpoints at ${BASE_URL}\n`);

async function testEndpoint(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  console.log(`Testing ${method} ${path}...`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const status = response.status;
    
    let data = '';
    try {
      data = await response.text();
      if (data) {
        data = JSON.parse(data);
      }
    } catch (e) {
      // Not JSON response
    }
    
    if (status >= 200 && status < 300) {
      console.log(`✅ ${method} ${path} - Status: ${status}`);
    } else {
      console.log(`❌ ${method} ${path} - Status: ${status}`);
      if (data) {
        console.log(`   Error: ${JSON.stringify(data).substring(0, 100)}...`);
      }
    }
  } catch (error) {
    console.log(`❌ ${method} ${path} - Error: ${error.message}`);
  }
  
  console.log('');
}

async function runTests() {
  // Test if server is running
  try {
    await fetch(`${BASE_URL}/health`);
  } catch (error) {
    console.error('❌ Server is not running at', BASE_URL);
    console.error('\nPlease start the server first:');
    console.error('  npm run dev');
    process.exit(1);
  }
  
  // Test all endpoints
  for (const { method, path, body } of endpoints) {
    await testEndpoint(method, path, body);
  }
  
  console.log('\n📊 Test Summary:');
  console.log('If you see 404 errors, the routes are not properly registered.');
  console.log('If you see 500 errors, there may be database or configuration issues.\n');
}

runTests();
