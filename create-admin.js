import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const connectionString = "postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3";

const sql = postgres(connectionString, {
  ssl: 'require'
});

async function createAdminUser() {
  try {
    console.log('👤 Creating admin user...');
    
    // Hash the password
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the admin user
    const [user] = await sql`
      INSERT INTO users (
        email, 
        username, 
        password_hash, 
        first_name, 
        last_name, 
        role, 
        active, 
        created_at, 
        updated_at
      ) VALUES (
        'admin@completecarloans.com',
        'admin',
        ${hashedPassword},
        'Admin',
        'User',
        'admin',
        true,
        NOW(),
        NOW()
      ) RETURNING email, username, role;
    `;
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@completecarloans.com');
    console.log('👤 Username: admin');
    console.log('🔑 Password: password123');
    console.log('');
    console.log('🎉 You can now log in to your application!');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
  } finally {
    await sql.end();
  }
}

createAdminUser();
