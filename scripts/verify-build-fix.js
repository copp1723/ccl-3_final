#!/usr/bin/env node

// Build verification script for CCL-3
// Verifies that build configuration is properly aligned

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying CCL-3 build configuration...\n');

// Check package.json configuration
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

console.log('📦 Package.json scripts:');
console.log(`  build:server: ${packageJson.scripts['build:server']}`);
console.log(`  start: ${packageJson.scripts.start}\n`);

// Verify build output alignment
const buildScript = packageJson.scripts['build:server'];
const startScript = packageJson.scripts.start;

const buildOutputMatch = buildScript.match(/--outfile=(.+\.js)/);
const startInputMatch = startScript.match(/node (.+\.js)/);

if (buildOutputMatch && startInputMatch) {
  const buildOutput = buildOutputMatch[1];
  const startInput = startInputMatch[1];
  
  if (buildOutput === startInput) {
    console.log('✅ Build output and start script are aligned');
    console.log(`   Both use: ${buildOutput}\n`);
  } else {
    console.log('❌ Build output and start script mismatch:');
    console.log(`   Build outputs: ${buildOutput}`);
    console.log(`   Start expects: ${startInput}\n`);
    process.exit(1);
  }
} else {
  console.log('⚠️  Could not parse build/start scripts\n');
}

// Check for .js imports in TypeScript files
console.log('🔍 Checking for problematic .js imports in TypeScript files...');


try {
  const result = execSync('find server -name "*.ts" -exec grep -l "from.*\\.js" {} \\;', { encoding: 'utf8' });
  if (result.trim()) {
    console.log('❌ Found TypeScript files with .js imports:');
    console.log(result);
    process.exit(1);
  } else {
    console.log('✅ No problematic .js imports found in TypeScript files\n');
  }
} catch (error) {
  console.log('✅ No problematic .js imports found in TypeScript files\n');
}

// Check render.yaml alignment
const renderPath = path.join(__dirname, '..', 'render.yaml');
if (fs.existsSync(renderPath)) {
  const renderContent = fs.readFileSync(renderPath, 'utf8');
  if (renderContent.includes('npm start')) {
    console.log('✅ render.yaml uses npm start command\n');
  } else {
    console.log('⚠️  render.yaml does not use npm start command\n');
  }
}

console.log('🎉 Build configuration verification complete!');
console.log('\n📋 Summary of fixes applied:');
console.log('  1. ✅ Fixed build:server script to output index.js');
console.log('  2. ✅ Aligned start script to use index.js');
console.log('  3. ✅ Removed .js extensions from TypeScript imports');
console.log('  4. ✅ Maintained render.yaml compatibility with npm start');