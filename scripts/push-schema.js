import { execSync } from 'child_process';

// Set the database URL for test database
process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/ccl3_test';

console.log('🚀 Pushing schema to database...');

try {
  // Use yes command to automatically answer "Yes" to drizzle-kit push prompt
  execSync('yes | npx drizzle-kit push', {
    stdio: 'inherit',
    shell: true
  });
  
  console.log('✅ Schema pushed successfully!');
} catch (error) {
  console.error('❌ Error pushing schema:', error);
  process.exit(1);
}