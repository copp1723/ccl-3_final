const fetch = require('node-fetch');

async function testAuthFix() {
  console.log('🔐 Testing Authentication Fix...\n');

  try {
    // Test 1: Login with correct credentials
    console.log('1. Testing login with correct credentials...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin@completecarloans.com',
        password: 'password123'
      })
    });

    console.log('   Status:', loginResponse.status);
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('   ✅ Login successful!');
      console.log('   User:', loginData.user.email);
      console.log('   Token:', loginData.accessToken.substring(0, 20) + '...');
      
      // Test 2: Use token to access protected endpoint
      console.log('\n2. Testing protected endpoint with token...');
      const protectedResponse = await fetch('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${loginData.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('   Status:', protectedResponse.status);
      
      if (protectedResponse.ok) {
        const userData = await protectedResponse.json();
        console.log('   ✅ Protected endpoint accessible!');
        console.log('   User data:', userData.user.email);
      } else {
        console.log('   ❌ Protected endpoint failed');
      }
    } else {
      const errorData = await loginResponse.json();
      console.log('   ❌ Login failed:', errorData.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🎉 Authentication test completed!');
}

testAuthFix(); 