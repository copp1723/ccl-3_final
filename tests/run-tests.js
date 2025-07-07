#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change to project directory
process.chdir(__dirname);

// Run vitest with proper configuration
const vitest = spawn('node', [
  join(__dirname, 'node_modules', 'vitest', 'vitest.mjs'),
  'run',
  '--no-coverage',
  '--reporter=verbose'
], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' }
});

vitest.on('close', (code) => {
  process.exit(code);
});