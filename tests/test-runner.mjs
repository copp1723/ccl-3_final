import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-secret';
process.env.API_KEY = 'test-api-key';

// Run vitest with better error handling
const child = spawn('npx', ['vitest', 'run', '--no-coverage'], {
  cwd: __dirname,
  stdio: 'pipe',
  env: process.env
});

let output = '';

child.stdout.on('data', (data) => {
  const str = data.toString();
  output += str;
  process.stdout.write(str);
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  output += str;
  process.stderr.write(str);
});

child.on('error', (error) => {
  console.error('Failed to start test runner:', error);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error('\nTest runner exited with code:', code);
    // Save output to file for analysis
    require('fs').writeFileSync('test-error-output.log', output);
  }
  process.exit(code);
});