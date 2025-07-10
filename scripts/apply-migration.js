import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ccl3';
const sql = postgres(connectionString);

async function applyMigration() {
  try {
    console.log('🔄 Applying database migration...');

    // Read the migration file
    const migrationSQL = readFileSync('migrations/0005_fix_schema_mismatch.sql', 'utf8');
    
    // Handle DO blocks and regular statements differently
    const blocks = [];
    let currentBlock = '';
    let inDoBlock = false;
    
    const lines = migrationSQL.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('DO $$')) {
        inDoBlock = true;
        currentBlock = line + '\n';
      } else if (line.trim() === 'END $$;' && inDoBlock) {
        currentBlock += line + '\n';
        blocks.push(currentBlock.trim());
        currentBlock = '';
        inDoBlock = false;
      } else if (inDoBlock) {
        currentBlock += line + '\n';
      } else if (line.trim() && !line.trim().startsWith('--')) {
        // Regular SQL statement
        if (line.trim().endsWith(';')) {
          currentBlock += line;
          blocks.push(currentBlock.trim());
          currentBlock = '';
        } else {
          currentBlock += line + '\n';
        }
      }
    }
    
    // Add any remaining statement
    if (currentBlock.trim()) {
      blocks.push(currentBlock.trim());
    }

    for (const block of blocks) {
      if (block.trim()) {
        console.log(`Executing: ${block.substring(0, 50)}...`);
        await sql.unsafe(block);
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('   - Added campaign_id column to leads table');
    console.log('   - Added handover_criteria column to campaigns table');
    console.log('   - Created index on leads.campaign_id');
    console.log('   - Set default handover criteria for existing campaigns');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
  } finally {
    await sql.end();
  }
}

applyMigration();