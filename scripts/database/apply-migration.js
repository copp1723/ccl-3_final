#!/usr/bin/env node

/**
 * Production Database Migration Script
 * This script applies the database schema migration to ensure the production database
 * has the correct structure including the channel enum and assigned_channel column.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🚀 Starting database migration...');

async function applyMigration() {
  let sql;
  
  try {
    // Connect to database
    sql = postgres(DATABASE_URL, {
      max: 1, // Single connection for migration
      ssl: DATABASE_URL.includes('localhost') ? false : 'require'
    });

    console.log('✅ Connected to database');

    // Read migration SQL file
    const migrationPath = join(__dirname, 'apply-production-migration.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Loaded migration SQL file');

    // Clean and split SQL into individual statements
    const statements = migrationSQL
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.startsWith('--') && 
               !trimmed.startsWith('/*') &&
               !trimmed.includes('statement-breakpoint');
      })
      .join('\n')
      .split(';')
      .filter(stmt => {
        const trimmed = stmt.trim();
        return trimmed && 
               !trimmed.startsWith('--') && 
               !trimmed.startsWith('/*');
      })
      .map(stmt => stmt.trim());

    console.log(`🔄 Executing ${statements.length} migration statements...`);

    // Execute migration in a transaction
    await sql.begin(async sql => {
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement) {
          try {
            console.log(`   ${i + 1}/${statements.length}: Executing statement...`);
            console.log(`   Statement preview: ${statement.substring(0, 50)}...`);
            await sql.unsafe(statement);
          } catch (error) {
            if (error.message.includes('already exists') || 
                error.message.includes('does not exist') ||
                error.message.includes('duplicate key')) {
              console.log(`   ⚠️  Skipped (already exists): ${error.message.split('\n')[0]}`);
            } else {
              console.error(`   ❌ Error in statement ${i + 1}:`, error.message);
              console.error(`   Statement was: ${statement}`);
              throw error;
            }
          }
        }
      }
    });

    console.log('✅ Migration completed successfully');

    // Verify the schema
    console.log('\n🔍 Verifying database schema...');
    
    // Check for channel enum
    const channelEnum = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'channel'
      ) as exists
    `;
    console.log(`   Channel enum exists: ${channelEnum[0].exists ? '✅' : '❌'}`);

    // Check for assigned_channel column in leads table
    const assignedChannelColumn = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'assigned_channel'
      ) as exists
    `;
    console.log(`   assigned_channel column exists: ${assignedChannelColumn[0].exists ? '✅' : '❌'}`);

    // Check table count
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log(`   Total tables: ${tables.length}`);
    console.log(`   Tables: ${tables.map(t => t.table_name).join(', ')}`);

    // Check leads table structure
    const leadsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'leads'
      ORDER BY ordinal_position
    `;
    
    console.log('\n📋 Leads table structure:');
    leadsColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

    console.log('\n🎉 Database migration verification complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run migration
applyMigration()
  .then(() => {
    console.log('\n✨ All done! Your database should now have the correct schema.');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });