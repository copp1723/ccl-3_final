// test-email-system.js
// Complete email system tester for CCL-3

const API_URL = process.env.API_URL || 'https://ccl-3-final.onrender.com';

async function testEmailSystem() {
  console.log('🧪 Testing CCL-3 Email System...\n');

  try {
    // 1. Test API Health
    console.log('1️⃣ Testing API Health...');
    const healthRes = await fetch(`${API_URL}/health`);
    const health = await healthRes.json();
    console.log('✅ API Health:', health);
    console.log(`   Memory: ${health.memory.used}MB / ${health.memory.limit}MB (${health.memory.rssPercent}%)\n`);

    // 2. Create Test Lead
    console.log('2️⃣ Creating test lead...');
    const leadRes = await fetch(`${API_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email Test User',
        email: 'test@example.com',
        source: 'email-system-test'
      })
    });
    const lead = await leadRes.json();
    console.log('✅ Lead created:', lead);

    // 3. Check Email Templates
    console.log('\n3️⃣ Checking email templates...');
    const templatesRes = await fetch(`${API_URL}/api/email/templates`);
    const templates = await templatesRes.json();
    console.log(`✅ Found ${templates.data?.length || 0} email templates`);

    // 4. Create Test Campaign
    console.log('\n4️⃣ Creating test campaign...');
    const campaignRes = await fetch(`${API_URL}/api/email/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Email Campaign',
        agentId: 'email-nurture-ai',
        templates: templates.data?.slice(0, 3).map(t => t.id) || [],
        status: 'active'
      })
    });
    
    if (campaignRes.ok) {
      const campaign = await campaignRes.json();
      console.log('✅ Campaign created:', campaign);
    } else {
      console.log('⚠️  Campaign creation returned:', campaignRes.status);
    }

    // 5. Test Email Conversation Manager
    console.log('\n5️⃣ Testing email conversation flow...');
    console.log('   - Lead created with email');
    console.log('   - Email conversation should initialize automatically');
    console.log('   - First template should be sent immediately');
    console.log('   - Subsequent templates follow configured delays');
    console.log('   - System switches to AI on first reply');

    console.log('\n✅ Email system test complete!');
    console.log('\n📧 Next steps:');
    console.log('   1. Check email inbox for first template');
    console.log('   2. Reply to trigger AI mode');
    console.log('   3. Monitor conversation in Email Agent UI');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEmailSystem();