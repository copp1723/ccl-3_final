import type { Config } from 'drizzle-kit';

export default {
  schema: './server/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/ccl3_swarm'
  }
} satisfies Config;