#!/usr/bin/env node
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load test environment
dotenv.config({ path: '.env.test' });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3_test';
const DATABASE_NAME = 'ccl3_test';

async function createTestDatabase() {
  console.log('🗄️  Setting up test database...\n');

  // Parse connection string to get base URL without database
  const urlParts = DATABASE_URL.split('/');
  const baseUrl = urlParts.slice(0, -1).join('/');
  const defaultDb = `${baseUrl}/postgres`;

  try {
    // Connect to postgres database to create test database
    const adminSql = postgres(defaultDb);
    
    console.log(`📦 Creating database "${DATABASE_NAME}"...`);
    
    // Drop existing test database if it exists
    await adminSql`DROP DATABASE IF EXISTS ${adminSql(DATABASE_NAME)}`;
    
    // Create fresh test database
    await adminSql`CREATE DATABASE ${adminSql(DATABASE_NAME)}`;
    
    console.log('✅ Test database created\n');
    
    await adminSql.end();
  } catch (error) {
    console.error('❌ Error creating test database:', error);
    throw error;
  }
}

async function runMigrations() {
  console.log('🔄 Running migrations...\n');
  
  try {
    // Run all migrations in order
    const migrations = [
      '0001_fresh_start.sql',
      '0002_add_agent_configurations.sql'
    ];
    
    for (const migration of migrations) {
      console.log(`  Running ${migration}...`);
      execSync(`psql ${DATABASE_URL} -f ${path.join(__dirname, '../migrations', migration)}`, {
        stdio: 'inherit'
      });
    }
    
    console.log('✅ All migrations completed\n');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

async function seedTestData() {
  console.log('🌱 Seeding test data...\n');
  
  try {
    // Run the fresh seed script that matches new schema
    execSync('tsx scripts/seed-fresh-data.ts', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  }
}

async function verifySetup() {
  console.log('🔍 Verifying database setup...\n');
  
  const sql = postgres(DATABASE_URL);
  const db = drizzle(sql);

  try {
    // Check if tables exist
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    
    console.log(`📊 Found ${tables.length} tables:`);
    tables.forEach(t => console.log(`  - ${t.tablename}`));
    
    // Count records in key tables
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM agent_configurations) as agent_configs,
        (SELECT COUNT(*) FROM leads) as leads,
        (SELECT COUNT(*) FROM templates) as templates,
        (SELECT COUNT(*) FROM campaigns) as campaigns,
        (SELECT COUNT(*) FROM campaign_steps) as campaign_steps,
        (SELECT COUNT(*) FROM communications) as communications,
        (SELECT COUNT(*) FROM sessions) as sessions,
        (SELECT COUNT(*) FROM audit_logs) as audit_logs
    `;
    
    console.log('\n📈 Record counts:');
    console.log(`  - Users: ${counts[0].users}`);
    console.log(`  - Agent Configurations: ${counts[0].agent_configs}`);
    console.log(`  - Leads: ${counts[0].leads}`);
    console.log(`  - Templates: ${counts[0].templates}`);
    console.log(`  - Campaigns: ${counts[0].campaigns}`);
    console.log(`  - Campaign Steps: ${counts[0].campaign_steps}`);
    console.log(`  - Communications: ${counts[0].communications}`);
    console.log(`  - Sessions: ${counts[0].sessions}`);
    console.log(`  - Audit Logs: ${counts[0].audit_logs}`);
    
    await sql.end();
    
    console.log('\n✅ Database setup verified successfully!');
  } catch (error) {
    console.error('❌ Verification error:', error);
    await sql.end();
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting test database setup...\n');
  console.log(`📍 Database URL: ${DATABASE_URL}\n`);

  try {
    // Step 1: Create test database
    await createTestDatabase();
    
    // Step 2: Run migrations
    await runMigrations();
    
    // Step 3: Seed test data
    await seedTestData();
    
    // Step 4: Verify setup
    await verifySetup();
    
    console.log('\n🎉 Test database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Run tests: npm test');
    console.log('  2. Run specific test: npm test -- tests/your-test.spec.ts');
    console.log('  3. Reset database: npm run test:db:reset\n');
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createTestDatabase, runMigrations, seedTestData, verifySetup };