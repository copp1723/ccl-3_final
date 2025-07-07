// Quick test to create a lead and watch it get processed
// Run from browser console when on the CCL-3 SWARM app

async function testLeadProcessing() {
  console.log('🧪 Testing lead processing flow...');
  
  // Create a test lead
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Lead ' + Date.now(),
      email: 'test' + Date.now() + '@example.com',
      phone: '+1' + Math.floor(Math.random() * 9000000000 + 1000000000),
      source: 'browser-test',
      campaign: 'test-campaign',
      metadata: {
        test: true,
        createdFrom: 'browser-console'
      }
    })
  });
  
  const result = await response.json();
  console.log('✅ Lead created:', result);
  
  if (result.leadId) {
    console.log('📊 Watch for WebSocket updates in the Network tab');
    console.log('🔍 Check lead details at: /api/leads/' + result.leadId);
    
    // Fetch lead details after a short delay
    setTimeout(async () => {
      const detailsResponse = await fetch('/api/leads/' + result.leadId);
      const details = await detailsResponse.json();
      console.log('📋 Lead details after processing:', details);
    }, 3000);
  }
}

// Run the test
testLeadProcessing();
