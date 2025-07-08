#!/usr/bin/env node
/**
 * IMMEDIATE DATABASE FIX
 * Run this to fix the schema issues and enable email testing
 */

import { sql as pgSql } from 'drizzle-orm';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a/ccl_3';

async function emergencyFix() {
  const sql = postgres(connectionString, { ssl: { rejectUnauthorized: false } });
  
  console.log('🚨 EMERGENCY DATABASE FIX STARTING...');
  
  try {
    // Check current state
    console.log('1. Checking current table structure...');
    const columns = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'leads'
    `;
    const columnNames = columns.map(c => c.column_name);
    console.log('Current columns:', columnNames);
    
    // Add missing columns
    console.log('2. Adding missing columns...');
    
    if (!columnNames.includes('campaign')) {
      await sql`ALTER TABLE leads ADD COLUMN campaign TEXT`;
      console.log('✅ Added campaign column');
    }
    
    if (!columnNames.includes('conversation_mode')) {
      await sql`ALTER TABLE leads ADD COLUMN conversation_mode VARCHAR(20) DEFAULT 'template'`;
      console.log('✅ Added conversation_mode column');
    }
    
    if (!columnNames.includes('template_stage')) {
      await sql`ALTER TABLE leads ADD COLUMN template_stage INTEGER DEFAULT 0`;
      console.log('✅ Added template_stage column');
    }
    
    if (!columnNames.includes('first_reply_at')) {
      await sql`ALTER TABLE leads ADD COLUMN first_reply_at TIMESTAMP`;
      console.log('✅ Added first_reply_at column');
    }
    
    // Test the query that was failing
    console.log('3. Testing problematic query...');
    const testResult = await sql`SELECT campaign, conversation_mode FROM leads LIMIT 1`;
    console.log('✅ Query test passed!');
    
    console.log('🎉 EMERGENCY FIX COMPLETE!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await sql.end();
  }
}

emergencyFix();