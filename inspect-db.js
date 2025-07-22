import postgres from 'postgres';

const connectionString = "postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3";

const sql = postgres(connectionString, {
  ssl: 'require'
});

// First, let's check what the current database looks like
async function inspectDatabase() {
  console.log('🔍 Inspecting current database schema...');
  
  try {
    // Check existing tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('📋 Existing tables:');
    tables.forEach(table => console.log(`  - ${table.table_name}`));
    
    // Check leads table structure
    const leadsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'leads' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📊 Leads table structure:');
    leadsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check if audit_logs has changes column
    const auditColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📊 Audit logs table structure:');
    auditColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Inspection failed:', error);
  } finally {
    await sql.end();
  }
}

inspectDatabase();
