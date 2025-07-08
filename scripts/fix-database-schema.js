#!/usr/bin/env node
/**
 * Database Schema Fix Script
 * This script fixes the schema sync issues that are preventing email testing
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection from environment
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a/ccl_3';

async function fixDatabaseSchema() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read the SQL fix script
    const sqlScript = readFileSync(join(__dirname, 'fix-database-schema.sql'), 'utf8');
    
    console.log('🔧 Applying database schema fixes...');
    
    // Split the script into individual statements and execute them
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('select')) {
        console.log('📊 Checking database state...');
        const result = await client.query(statement);
        if (result.rows.length > 0) {
          console.table(result.rows);
        }
      } else {
        console.log('⚡ Executing:', statement.substring(0, 60) + '...');
        await client.query(statement);
      }
    }

    console.log('✅ Database schema fixes applied successfully!');
    
    // Test the leads query that was failing
    console.log('🧪 Testing the problematic query...');
    const testResult = await client.query(`
      SELECT id, name, email, campaign, conversation_mode, status 
      FROM leads 
      LIMIT 3
    `);
    
    console.log('✅ Query test successful! Sample data:');
    console.table(testResult.rows);
    
  } catch (error) {
    console.error('❌ Error fixing database schema:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the fix
if (import.meta.url === `file://${process.argv[1]}`) {
  fixDatabaseSchema()
    .then(() => {
      console.log('🎉 Database schema fix completed successfully!');
      console.log('🚀 You can now test email functionality');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to fix database schema:', error);
      process.exit(1);
    });
}

export { fixDatabaseSchema };