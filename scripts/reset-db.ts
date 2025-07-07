import postgres from 'postgres';

async function resetDatabase() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/ccl3_swarm';
  const sql = postgres(connectionString);

  try {
    console.log('🔄 Resetting database schema...');
    
    // Drop all tables and types in correct order
    console.log('📉 Dropping existing tables...');
    await sql`DROP TABLE IF EXISTS agent_decisions CASCADE`;
    await sql`DROP TABLE IF EXISTS communications CASCADE`;
    await sql`DROP TABLE IF EXISTS conversations CASCADE`;
    await sql`DROP TABLE IF EXISTS campaigns CASCADE`;
    await sql`DROP TABLE IF EXISTS leads CASCADE`;
    await sql`DROP TABLE IF EXISTS messages CASCADE`;
    await sql`DROP TABLE IF EXISTS visitors CASCADE`;
    await sql`DROP TABLE IF EXISTS drizzle.__drizzle_migrations CASCADE`;
    
    console.log('🏷️  Dropping enum types...');
    await sql`DROP TYPE IF EXISTS agent_type CASCADE`;
    await sql`DROP TYPE IF EXISTS channel CASCADE`;
    await sql`DROP TYPE IF EXISTS lead_status CASCADE`;
    
    console.log('✅ Database reset complete');
    console.log('ℹ️  Run "npm run db:migrate" to recreate the schema');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
  } finally {
    await sql.end();
  }
}

resetDatabase();