#!/usr/bin/env node

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

async function applyPasswordFix() {
  console.log('🔧 Applying password_hash column fix...\n');

  try {
    // Connect to database
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3';
    const sql = postgres(connectionString);
    const db = drizzle(sql);

    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../migrations/0003_fix_users_password_hash.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Applying migration...');
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the fix
    console.log('🔍 Verifying fix...');
    const result = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_hash'
    `;
    
    if (result.length > 0) {
      console.log('✅ password_hash column exists and is properly configured');
      console.log('   Column:', result[0].column_name);
      console.log('   Type:', result[0].data_type);
      console.log('   Nullable:', result[0].is_nullable);
    } else {
      console.log('❌ password_hash column still missing');
    }

    // Test creating an admin user
    console.log('\n🔐 Testing admin user creation...');
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('password123', 10);
    
    await sql`
      INSERT INTO users (id, email, username, password_hash, first_name, last_name, role, active)
      VALUES (
        gen_random_uuid(),
        'admin@completecarloans.com',
        'admin',
        ${passwordHash},
        'Admin',
        'User',
        'admin',
        true
      )
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
    `;
    
    console.log('✅ Admin user created/updated successfully!');
    console.log('📧 Email: admin@completecarloans.com');
    console.log('🔑 Password: password123');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyPasswordFix(); 