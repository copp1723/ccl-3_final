#!/usr/bin/env tsx
import { UsersRepository } from '../server/db/users-repository.js';

async function createAdminUser() {
  try {
    console.log('🔐 Creating admin user...');
    
    // Check if admin already exists
    const existingAdmin = await UsersRepository.findByEmail('admin@ccl3.com');
    if (existingAdmin) {
      console.log('❌ Admin user already exists with email: admin@ccl3.com');
      return;
    }
    
    // Create admin user
    const admin = await UsersRepository.create({
      email: 'admin@ccl3.com',
      username: 'admin',
      password: 'admin123!', // Change this!
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin'
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@ccl3.com');
    console.log('👤 Username: admin');
    console.log('🔑 Password: admin123!');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

createAdminUser(); 