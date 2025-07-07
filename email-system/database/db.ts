import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Create postgres connection
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/ccl3_swarm';

let sql: any;
let db: any;

try {
  sql = postgres(connectionString);
  db = drizzle(sql, { schema });
  console.log("✅ PostgreSQL database configuration successful");
} catch (error) {
  console.error("❌ PostgreSQL database configuration failed:", error);
  // Fallback to mock db for development
  db = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  };
}

export { db };
