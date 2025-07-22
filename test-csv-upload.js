const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';

async function testCSVUpload() {
  console.log('🧪 Testing CSV Upload Functionality...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing health endpoint...');
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/api/health`);
      console.log('✅ Health check passed:', healthResponse.data);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }

    // Test 2: Leads Endpoint
    console.log('\n2️⃣ Testing leads endpoint...');
    try {
      const leadsResponse = await axios.get(`${API_BASE_URL}/api/leads`);
      console.log('✅ Leads endpoint working:', {
        success: leadsResponse.data.success,
        count: leadsResponse.data.leads?.length || 0
      });
    } catch (error) {
      console.log('❌ Leads endpoint failed:', error.response?.status, error.response?.data || error.message);
    }

    // Test 3: CSV Analysis
    console.log('\n3️⃣ Testing CSV analysis endpoint...');
    const form = new FormData();
    const csvContent = fs.readFileSync('./sample-leads.csv');
    form.append('file', csvContent, 'sample-leads.csv');

    try {
      const analyzeResponse = await axios.post(
        `${API_BASE_URL}/api/import/analyze`,
        form,
        {
          headers: form.getHeaders()
        }
      );
      console.log('✅ CSV analysis working:', {
        headers: analyzeResponse.data.headers,
        totalRows: analyzeResponse.data.totalRows
      });
    } catch (error) {
      console.log('❌ CSV analysis failed:', error.response?.status, error.response?.data || error.message);
    }

    // Test 4: CSV Import
    console.log('\n4️⃣ Testing CSV import endpoint...');
    const importForm = new FormData();
    importForm.append('file', csvContent, 'sample-leads.csv');
    importForm.append('mappings', JSON.stringify([
      { csvColumn: 'name', leadField: 'name' },
      { csvColumn: 'email', leadField: 'email' },
      { csvColumn: 'phone', leadField: 'phone' },
      { csvColumn: 'source', leadField: 'source' },
      { csvColumn: 'notes', leadField: 'metadata' }
    ]));

    try {
      const importResponse = await axios.post(
        `${API_BASE_URL}/api/import/leads`,
        importForm,
        {
          headers: importForm.getHeaders()
        }
      );
      console.log('✅ CSV import working:', importResponse.data);
    } catch (error) {
      console.log('❌ CSV import failed:', error.response?.status, error.response?.data || error.message);
    }

    // Test 5: Verify leads were imported
    console.log('\n5️⃣ Verifying imported leads...');
    try {
      const verifyResponse = await axios.get(`${API_BASE_URL}/api/leads`);
      console.log('✅ Leads after import:', {
        success: verifyResponse.data.success,
        count: verifyResponse.data.leads?.length || 0,
        firstLead: verifyResponse.data.leads?.[0]
      });
    } catch (error) {
      console.log('❌ Verification failed:', error.response?.status, error.response?.data || error.message);
    }

  } catch (error) {
    console.error('🚨 Unexpected error:', error);
  }
}

// Test against production if specified
if (process.argv[2] === 'production') {
  process.env.API_URL = 'https://ccl-3-final.onrender.com';
  console.log('🌐 Testing against production:', process.env.API_URL);
}

testCSVUpload();