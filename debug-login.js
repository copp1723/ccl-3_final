import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const connectionString = "postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3";

const sql = postgres(connectionString, {
  ssl: 'require'
});

async function debugLogin() {
  try {
    console.log('🔍 Debugging login issue...');
    
    // Check if the user exists
    const users = await sql`
      SELECT email, username, password_hash, role, active 
      FROM users 
      WHERE email = 'admin@completecarloans.com' OR username = 'admin';
    `;
    
    if (users.length === 0) {
      console.log('❌ User not found in database');
      return;
    }
    
    const user = users[0];
    console.log('✅ User found:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.active}`);
    console.log(`  Has password hash: ${user.password_hash ? 'Yes' : 'No'}`);
    
    // Test password verification
    const testPassword = 'password123';
    const isValidPassword = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`  Password test: ${isValidPassword ? '✅ Valid' : '❌ Invalid'}`);
    
    // Check users table structure
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📊 Users table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await sql.end();
  }
}

debugLogin();
