import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Create postgres connection
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/ccl3_swarm';
const sql = postgres(connectionString);

// Create drizzle instance with schema
export const db = drizzle(sql, { schema });

// Export for graceful shutdown
export const closeConnection = async () => {
  await sql.end();
};

// Helper type for database transactions
export type DbTransaction = typeof db;
