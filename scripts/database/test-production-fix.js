// test-production-fix.js
// Test production fixes for CCL-3

const API_URL = process.env.API_URL || 'https://ccl-3-final.onrender.com';

async function testProductionFix() {
  console.log('🔧 Testing CCL-3 Production Fixes...\n');

  const tests = [
    {
      name: 'API Health Check',
      endpoint: '/health',
      method: 'GET'
    },
    {
      name: 'Leads List',
      endpoint: '/api/leads',
      method: 'GET'
    },
    {
      name: 'Lead Stats',
      endpoint: '/api/leads/stats/summary',
      method: 'GET'
    },
    {
      name: 'Agents List',
      endpoint: '/api/agents',
      method: 'GET'
    },
    {
      name: 'Email Templates',
      endpoint: '/api/email/templates',
      method: 'GET'
    },
    {
      name: 'Email Campaigns',
      endpoint: '/api/email/campaigns',
      method: 'GET'
    }
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const res = await fetch(`${API_URL}${test.endpoint}`, {
        method: test.method,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        console.log(`✅ ${test.name}: Success`);
        console.log(`   Response:`, JSON.stringify(data, null, 2).slice(0, 200) + '...\n');
      } else {
        console.log(`❌ ${test.name}: Failed (${res.status})`);
        console.log(`   Error:`, data, '\n');
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Network Error`);
      console.log(`   Error:`, error.message, '\n');
    }
  }

  console.log('✅ Production fix tests complete!');
}

// Run the test
testProductionFix();