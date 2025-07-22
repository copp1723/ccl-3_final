import postgres from 'postgres';

const connectionString = "postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3";

const sql = postgres(connectionString, {
  ssl: 'require'
});

async function fixColumnNames() {
  try {
    console.log('🔧 Fixing column name mismatch...');
    
    // Rename password_hash to passwordHash to match the code
    await sql`ALTER TABLE users RENAME COLUMN password_hash TO "passwordHash";`;
    
    console.log('✅ Column renamed: password_hash → passwordHash');
    console.log('🎉 Login should now work!');
    
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.log('✅ Column already has correct name - no fix needed');
    } else {
      console.error('❌ Failed to fix column names:', error.message);
    }
  } finally {
    await sql.end();
  }
}

fixColumnNames();
