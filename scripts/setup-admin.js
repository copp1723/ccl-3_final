#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { users } = require('../server/db/schema');
const { eq } = require('drizzle-orm');

async function setupAdmin() {
  console.log('🔐 Setting up admin user...\n');

  try {
    // Connect to database
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3';
    const sql = postgres(connectionString);
    const db = drizzle(sql);

    // Check if admin already exists
    const existingAdmin = await db.select().from(users).where(eq(users.email, 'admin@completecarloans.com')).limit(1);
    
    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists!');
      console.log('📧 Email: admin@completecarloans.com');
      console.log('🔑 Password: password123');
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash('password123', 10);

    // Create admin user
    const [admin] = await db.insert(users).values({
      email: 'admin@completecarloans.com',
      username: 'admin',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      active: true
    }).returning();

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@completecarloans.com');
    console.log('🔑 Password: password123');
    console.log('🆔 User ID:', admin.id);
    console.log('');
    console.log('🎉 You can now log in with these credentials!');

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    console.log('');
    console.log('💡 The hardcoded credentials should still work:');
    console.log('   Email: admin@completecarloans.com');
    console.log('   Password: password123');
  }
}

setupAdmin(); 