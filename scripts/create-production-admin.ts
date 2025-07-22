import { config } from 'dotenv';
import { usersRepository } from '../server/db';
import bcrypt from 'bcryptjs';

// Load environment variables
config();

async function createProductionAdmin() {
  try {
    console.log('Creating production admin user...');
    
    // Get admin credentials from environment variables or use secure defaults
    const email = process.env.ADMIN_EMAIL || 'admin@completecarloans.com';
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD;
    
    if (!password) {
      console.error('Error: ADMIN_PASSWORD environment variable must be set');
      console.error('Please set a secure password in your environment variables');
      process.exit(1);
    }
    
    // Check if admin already exists
    const existingAdmin = await usersRepository.findByEmail(email);
    if (existingAdmin) {
      console.log('Admin user already exists with email:', email);
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create admin user
    const admin = await usersRepository.create({
      email,
      username,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      active: true
    });
    
    console.log('Admin user created successfully!');
    console.log('Email:', email);
    console.log('Username:', username);
    console.log('Role:', admin.role);
    console.log('\nIMPORTANT: Store your password securely and never commit it to version control');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createProductionAdmin();