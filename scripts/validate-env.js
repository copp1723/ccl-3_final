#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required environment variables
const REQUIRED_VARS = [
  'DATABASE_URL',
  'PORT',
  'NODE_ENV',
  'SESSION_SECRET',
  'OPENROUTER_API_KEY',
  'SIMPLE_MODEL',
  'MEDIUM_MODEL',
  'COMPLEX_MODEL',
  'FALLBACK_MODEL'
];

// Optional but recommended vars
const OPTIONAL_VARS = [
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'MAILGUN_API_KEY',
  'MAILGUN_DOMAIN',
  'MAILGUN_FROM_EMAIL',
  'VALID_API_KEYS',
  'SUPERMEMORY_API_KEY'
];

function validateEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.log('Please create a .env file based on .env.example');
    process.exit(1);
  }

  // Load .env file
  require('dotenv').config({ path: envPath });

  let hasErrors = false;
  const missing = [];
  const warnings = [];

  // Check required variables
  REQUIRED_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
      hasErrors = true;
    }
  });

  // Check optional variables
  OPTIONAL_VARS.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  });

  // Report results
  console.log('\n🔍 Environment Variable Validation\n');

  if (missing.length > 0) {
    console.error('❌ Missing required variables:');
    missing.forEach(v => console.error(`   - ${v}`));
  } else {
    console.log('✅ All required variables are set');
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Missing optional variables:');
    warnings.forEach(v => console.log(`   - ${v}`));
  }

  // Validate specific values
  console.log('\n📋 Configuration Summary:');
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Port: ${process.env.PORT}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`   Redis: ${process.env.REDIS_HOST || process.env.REDIS_URL ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`   Email: ${process.env.MAILGUN_API_KEY ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`   SMS: ${process.env.TWILIO_ACCOUNT_SID ? '✓ Configured' : '✗ Not configured'}`);

  if (hasErrors) {
    console.error('\n❌ Environment validation failed!');
    process.exit(1);
  } else {
    console.log('\n✅ Environment validation passed!');
  }
}

validateEnv();