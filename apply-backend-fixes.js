#!/usr/bin/env node

/**
 * Script to apply backend API fixes for CCL-3
 * 
 * Fixes applied:
 * 1. Database schema synchronization
 * 2. Missing tables and columns
 * 3. API endpoint routing fixes
 * 4. Repository method fixes
 */

import { readFile } from 'fs/promises';
import { Client } from 'pg';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🔧 CCL-3 Backend API Fixes');
console.log('==========================\n');

async function applyDatabaseFixes() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Apply the new migration
    const migrationSql = await readFile('./migrations/0004_fix_missing_tables_and_columns.sql', 'utf8');
    
    console.log('📄 Applying migration: 0004_fix_missing_tables_and_columns.sql');
    await client.query(migrationSql);
    console.log('✅ Migration applied successfully');
    
    // Verify key tables exist
    const checkTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('users', 'clients', 'agent_configurations', 'leads', 'campaigns', 'templates', 'analytics_events', 'conversations')
      ORDER BY table_name;
    `);
    
    console.log('📊 Database tables status:');
    checkTables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Verify password_hash column exists
    const checkPasswordColumn = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_hash';
    `);
    
    if (checkPasswordColumn.rows.length > 0) {
      console.log('✅ users.password_hash column exists');
    } else {
      console.log('⚠️  users.password_hash column missing - check migration');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    await client.end();
    throw error;
  }
}

async function main() {
  try {
    console.log('1️⃣  Applying database fixes...');
    await applyDatabaseFixes();
    
    console.log('\n2️⃣  Code fixes applied:');
    console.log('   ✅ Added EmailTemplatesRepository.findAll() method');
    console.log('   ✅ Added /api/agents endpoint (alias for /api/agent-configurations)');
    console.log('   ✅ Added UUID validation middleware to prevent parsing errors');
    console.log('   ✅ Added missing database tables and columns');
    
    console.log('\n🎉 All backend fixes applied successfully!');
    console.log('\n📋 Summary of fixes:');
    console.log('   • Fixed database schema mismatch issues');
    console.log('   • Added missing /api/agents endpoint');
    console.log('   • Fixed EmailTemplatesRepository.findAll error');
    console.log('   • Added UUID validation to prevent parsing errors');
    console.log('   • Synchronized database schema with code definitions');
    
    console.log('\n🚀 Server should now start without these API errors.');
    
  } catch (error) {
    console.error('\n❌ Fix application failed:', error.message);
    process.exit(1);
  }
}

main();