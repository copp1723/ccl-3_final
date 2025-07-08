#!/usr/bin/env node

/**
 * Fixed Production Database Migration Script
 * This script applies the database schema migration with proper SQL parsing
 */

import postgres from 'postgres';

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🚀 Starting database migration...');

async function applyMigration() {
  let sql;
  
  try {
    // Connect to database
    sql = postgres(DATABASE_URL, {
      max: 1, // Single connection for migration
      ssl: DATABASE_URL.includes('localhost') ? false : 'require'
    });

    console.log('✅ Connected to database');

    // Execute migration step by step with proper error handling
    console.log('🔄 Applying database schema migration...');

    // Step 1: Create enum types
    console.log('   Creating enum types...');
    
    try {
      await sql`CREATE TYPE "public"."agent_type" AS ENUM('overlord', 'email', 'sms', 'chat')`;
      console.log('   ✅ Created agent_type enum');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  agent_type enum already exists');
      } else {
        throw error;
      }
    }

    try {
      await sql`CREATE TYPE "public"."channel" AS ENUM('email', 'sms', 'chat')`;
      console.log('   ✅ Created channel enum');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  channel enum already exists');
      } else {
        throw error;
      }
    }

    try {
      await sql`CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'sent_to_boberdoo', 'rejected', 'archived')`;
      console.log('   ✅ Created lead_status enum');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  lead_status enum already exists');
      } else {
        throw error;
      }
    }

    // Step 2: Create tables
    console.log('   Creating tables...');

    try {
      await sql`
        CREATE TABLE "agent_decisions" (
          "id" text PRIMARY KEY NOT NULL,
          "lead_id" text NOT NULL,
          "agent_type" "agent_type" NOT NULL,
          "decision" text NOT NULL,
          "reasoning" text,
          "context" jsonb DEFAULT '{}'::jsonb,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `;
      console.log('   ✅ Created agent_decisions table');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  agent_decisions table already exists');
      } else {
        throw error;
      }
    }

    try {
      await sql`
        CREATE TABLE "campaigns" (
          "id" text PRIMARY KEY NOT NULL,
          "name" text NOT NULL,
          "goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
          "qualification_criteria" jsonb NOT NULL,
          "channel_preferences" jsonb NOT NULL,
          "active" boolean DEFAULT true NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `;
      console.log('   ✅ Created campaigns table');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  campaigns table already exists');
      } else {
        throw error;
      }
    }

    try {
      await sql`
        CREATE TABLE "communications" (
          "id" text PRIMARY KEY NOT NULL,
          "lead_id" text NOT NULL,
          "channel" "channel" NOT NULL,
          "direction" text NOT NULL,
          "content" text NOT NULL,
          "status" text DEFAULT 'pending' NOT NULL,
          "external_id" text,
          "metadata" jsonb DEFAULT '{}'::jsonb,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `;
      console.log('   ✅ Created communications table');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  communications table already exists');
      } else {
        throw error;
      }
    }

    try {
      await sql`
        CREATE TABLE "conversations" (
          "id" text PRIMARY KEY NOT NULL,
          "lead_id" text NOT NULL,
          "channel" "channel" NOT NULL,
          "agent_type" "agent_type" NOT NULL,
          "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
          "status" text DEFAULT 'active' NOT NULL,
          "started_at" timestamp DEFAULT now() NOT NULL,
          "ended_at" timestamp
        )
      `;
      console.log('   ✅ Created conversations table');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  conversations table already exists');
      } else {
        throw error;
      }
    }

    // Step 3: Handle leads table (most complex)
    console.log('   Handling leads table...');
    
    try {
      await sql`
        CREATE TABLE "leads" (
          "id" text PRIMARY KEY NOT NULL,
          "name" text NOT NULL,
          "email" text,
          "phone" text,
          "source" text NOT NULL,
          "campaign" text,
          "status" "lead_status" DEFAULT 'new' NOT NULL,
          "assigned_channel" "channel",
          "qualification_score" integer DEFAULT 0,
          "metadata" jsonb DEFAULT '{}'::jsonb,
          "boberdoo_id" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `;
      console.log('   ✅ Created leads table with all columns');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  leads table already exists, checking columns...');
        
        // Check and add missing columns
        try {
          await sql`ALTER TABLE "leads" ADD COLUMN "assigned_channel" "channel"`;
          console.log('   ✅ Added assigned_channel column');
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log('   ⚠️  assigned_channel column already exists');
          } else {
            console.log('   ⚠️  Could not add assigned_channel:', err.message);
          }
        }

        try {
          await sql`ALTER TABLE "leads" ADD COLUMN "qualification_score" integer DEFAULT 0`;
          console.log('   ✅ Added qualification_score column');
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log('   ⚠️  qualification_score column already exists');
          }
        }

        try {
          await sql`ALTER TABLE "leads" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb`;
          console.log('   ✅ Added metadata column');
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log('   ⚠️  metadata column already exists');
          }
        }

        try {
          await sql`ALTER TABLE "leads" ADD COLUMN "boberdoo_id" text`;
          console.log('   ✅ Added boberdoo_id column');
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log('   ⚠️  boberdoo_id column already exists');
          }
        }
      } else {
        throw error;
      }
    }

    // Step 4: Add foreign key constraints
    console.log('   Adding foreign key constraints...');

    try {
      await sql`ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action`;
      console.log('   ✅ Added agent_decisions foreign key');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  agent_decisions foreign key already exists');
      } else {
        console.log('   ⚠️  Could not add agent_decisions foreign key:', error.message);
      }
    }

    try {
      await sql`ALTER TABLE "communications" ADD CONSTRAINT "communications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action`;
      console.log('   ✅ Added communications foreign key');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  communications foreign key already exists');
      } else {
        console.log('   ⚠️  Could not add communications foreign key:', error.message);
      }
    }

    try {
      await sql`ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action`;
      console.log('   ✅ Added conversations foreign key');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ⚠️  conversations foreign key already exists');
      } else {
        console.log('   ⚠️  Could not add conversations foreign key:', error.message);
      }
    }

    console.log('✅ Migration completed successfully');

    // Verify the schema
    console.log('\n🔍 Verifying database schema...');
    
    // Check for channel enum
    const channelEnum = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'channel'
      ) as exists
    `;
    console.log(`   Channel enum exists: ${channelEnum[0].exists ? '✅' : '❌'}`);

    // Check for assigned_channel column in leads table
    const assignedChannelColumn = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'assigned_channel'
      ) as exists
    `;
    console.log(`   assigned_channel column exists: ${assignedChannelColumn[0].exists ? '✅' : '❌'}`);

    // Check table count
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log(`   Total tables: ${tables.length}`);
    console.log(`   Tables: ${tables.map(t => t.table_name).join(', ')}`);

    // Check leads table structure
    const leadsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'leads'
      ORDER BY ordinal_position
    `;
    
    console.log('\n📋 Leads table structure:');
    leadsColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

    console.log('\n🎉 Database migration verification complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run migration
applyMigration()
  .then(() => {
    console.log('\n✨ All done! Your database should now have the correct schema.');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });