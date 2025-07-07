import postgres from 'postgres';

async function checkDatabase() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/ccl3_swarm';
  const sql = postgres(connectionString);

  try {
    console.log('🔍 Checking database connection...');
    
    // Test connection
    const version = await sql`SELECT version()`;
    console.log('✅ Connected to database');
    console.log('📊 PostgreSQL version:', version[0].version);
    
    // Check if tables exist
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    
    console.log('\n📋 Existing tables:');
    tables.forEach(table => console.log(`  - ${table.tablename}`));
    
    // Check if leads table has data
    const leadCount = await sql`SELECT COUNT(*) as count FROM leads`;
    console.log(`\n📈 Lead count: ${leadCount[0].count}`);
    
    // Check enum types
    const enumTypes = await sql`
      SELECT typname 
      FROM pg_type 
      WHERE typcategory = 'E'
      ORDER BY typname
    `;
    
    console.log('\n🏷️  Existing enum types:');
    enumTypes.forEach(type => console.log(`  - ${type.typname}`));
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await sql.end();
  }
}

checkDatabase();