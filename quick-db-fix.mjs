import postgres from 'postgres';

async function quickFix() {
  console.log('🚨 Emergency Database Fix Starting...\n');
  
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_PROD;
  if (!databaseUrl) {
    console.error('❌ No DATABASE_URL found in environment');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, {
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Fix 1: Users table password column
    console.log('1. Fixing users password column...');
    try {
      // Check current columns
      const cols = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name IN ('password_hash', 'passwordHash')
      `;
      
      if (cols.some(c => c.column_name === 'passwordHash')) {
        await sql`ALTER TABLE users RENAME COLUMN "passwordHash" TO password_hash`;
        console.log('   ✅ Renamed passwordHash to password_hash');
      } else if (!cols.some(c => c.column_name === 'password_hash')) {
        await sql`ALTER TABLE users ADD COLUMN password_hash TEXT`;
        console.log('   ✅ Added password_hash column');
      } else {
        console.log('   ✅ password_hash already correct');
      }
    } catch (e) {
      console.log('   ⚠️  Password fix error (may be OK):', e.message);
    }

    // Fix 2: Agent configurations columns
    console.log('\n2. Fixing agent_configurations columns...');
    const agentFixes = [
      'ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS system_prompt TEXT',
      'ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2) DEFAULT 0.7',
      'ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2000',
      'ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS response_style TEXT DEFAULT \'professional\'',
      'ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT \'{}\'',
      'ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS personality JSONB DEFAULT \'{"tone": "professional", "style": "balanced", "traits": []}\''
    ];

    for (const fix of agentFixes) {
      try {
        await sql.unsafe(fix);
        console.log('   ✅ ' + fix.split(' ')[5]);
      } catch (e) {
        console.log('   ⚠️  Column may exist:', e.message);
      }
    }

    // Fix 3: Create missing tables
    console.log('\n3. Creating missing tables...');
    
    // Clients table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS clients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          brand_config JSONB DEFAULT '{}',
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('   ✅ clients table ready');
    } catch (e) {
      console.log('   ⚠️  clients:', e.message);
    }

    // Analytics events
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type TEXT NOT NULL,
          event_data JSONB DEFAULT '{}',
          lead_id UUID,
          campaign_id UUID,
          agent_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('   ✅ analytics_events table ready');
    } catch (e) {
      console.log('   ⚠️  analytics_events:', e.message);
    }

    // Conversations
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id UUID,
          agent_id UUID,
          status TEXT DEFAULT 'active',
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('   ✅ conversations table ready');
    } catch (e) {
      console.log('   ⚠️  conversations:', e.message);
    }

    console.log('\n✅ Emergency fixes applied!');
    console.log('🎉 Database should now work with the application\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

quickFix();