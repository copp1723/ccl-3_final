import postgres from 'postgres';

const connectionString = "postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3";

const sql = postgres(connectionString, {
  ssl: 'require'
});

async function checkUsers() {
  try {
    console.log('👥 Checking users table...');
    
    const users = await sql`SELECT email, username, role FROM users;`;
    
    if (users.length === 0) {
      console.log('❌ No users found in the database');
      console.log('💡 You need to create an admin user first');
    } else {
      console.log(`✅ Found ${users.length} user(s):`);
      users.forEach(user => {
        console.log(`  - ${user.email} (username: ${user.username}, role: ${user.role})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to check users:', error.message);
  } finally {
    await sql.end();
  }
}

checkUsers();
