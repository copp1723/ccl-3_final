#!/usr/bin/env node

console.log('🔐 CCL-3 Security Fixes Validation');
console.log('=====================================\n');

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, condition, message) {
  const passed = condition;
  results.tests.push({ name, passed, message });
  if (passed) {
    console.log(`✅ ${name}`);
    results.passed++;
  } else {
    console.log(`❌ ${name}: ${message}`);
    results.failed++;
  }
}

// Read files for testing
const authRoute = fs.readFileSync(join(__dirname, 'server/routes/auth.ts'), 'utf8');
const authMiddleware = fs.readFileSync(join(__dirname, 'server/middleware/auth.ts'), 'utf8');
const serverIndex = fs.readFileSync(join(__dirname, 'server/index.ts'), 'utf8');
const envFile = fs.readFileSync(join(__dirname, '.env'), 'utf8');
const envExample = fs.readFileSync(join(__dirname, '.env.example'), 'utf8');

console.log('Running security checks...\n');

// Test 1: No hardcoded admin credentials
test(
  'Hardcoded admin credentials removed',
  !authRoute.includes('admin@completecarloans.com') && !authRoute.includes('password123'),
  'Found hardcoded admin credentials in auth route'
);

// Test 2: No hardcoded JWT tokens
test(
  'Hardcoded JWT tokens removed',
  !authMiddleware.includes('hardcoded-jwt-token-') && !authRoute.includes('hardcoded-jwt-token-'),
  'Found hardcoded JWT token acceptance logic'
);

// Test 3: SKIP_AUTH bypass removed
test(
  'SKIP_AUTH bypass mechanism removed',
  !authMiddleware.includes('SKIP_AUTH'),
  'Found SKIP_AUTH bypass in authentication middleware'
);

// Test 4: SKIP_AUTH removed from .env
test(
  'SKIP_AUTH removed from .env file',
  !envFile.includes('SKIP_AUTH=true'),
  'Found SKIP_AUTH=true in .env file'
);

// Test 5: Helmet security headers added
test(
  'Helmet security headers added',
  serverIndex.includes('import helmet from') && serverIndex.includes('app.use(helmet'),
  'Helmet security headers not properly configured'
);

// Test 6: CORS configuration added
test(
  'CORS configuration added',
  serverIndex.includes('import cors from') && serverIndex.includes('corsOptions') && serverIndex.includes('app.use(cors'),
  'CORS not properly configured'
);

// Test 7: Environment validation added
test(
  'Environment validation implemented',
  serverIndex.includes('validateEnvironment') && fs.existsSync(join(__dirname, 'server/utils/env-validation.ts')),
  'Environment validation not implemented'
);

// Test 8: Secure .env.example created
test(
  'Secure .env.example file created',
  fs.existsSync(join(__dirname, '.env.example')) && 
  envExample.includes('Generate strong, unique secrets') &&
  !envExample.includes('real-api-key') &&
  envExample.includes('SKIP_AUTH=true  # Never use this'),
  'Secure .env.example file not properly created'
);

// Test 9: Default admin endpoint removed
test(
  'Default admin endpoint removed',
  !authRoute.includes('/create-default-admin') || authRoute.includes('removed for security'),
  'Default admin endpoint still exposing credentials'
);

// Test 10: No weak default JWT secret
test(
  'No weak default JWT secret',
  !authMiddleware.includes('ccl3-jwt-secret-change-in-production'),
  'Found weak default JWT secret'
);

console.log('\n📊 Security Test Results');
console.log('=========================');
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📝 Total:  ${results.tests.length}`);

if (results.failed === 0) {
  console.log('\n🎉 All security fixes have been successfully implemented!');
  console.log('\n🔒 Additional Security Recommendations:');
  console.log('  • Ensure strong, unique secrets are set in production .env');
  console.log('  • Use HTTPS in production (update CORS origins)');
  console.log('  • Regularly rotate JWT secrets');
  console.log('  • Monitor authentication logs for suspicious activity');
  console.log('  • Consider implementing rate limiting on auth endpoints');
} else {
  console.log('\n⚠️  Some security issues still need attention. Please review the failed tests above.');
  process.exit(1);
}