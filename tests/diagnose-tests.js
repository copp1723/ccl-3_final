const fs = require('fs');
const path = require('path');

console.log('Diagnosing test setup...');
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());

// Check if vitest exists
const vitestPath = path.join(__dirname, 'node_modules', '.bin', 'vitest');
console.log('Vitest exists:', fs.existsSync(vitestPath));

// Check environment
console.log('\nEnvironment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PATH includes node_modules/.bin:', process.env.PATH?.includes('node_modules/.bin'));

// Check if directory name with space is causing issues
console.log('\nDirectory name contains space:', __dirname.includes(' '));

// List test files
console.log('\nTest files found:');
const testDir = path.join(__dirname, 'tests', 'unit');
function listTestFiles(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      listTestFiles(fullPath);
    } else if (file.endsWith('.test.ts')) {
      console.log('-', fullPath.replace(__dirname, '.'));
    }
  });
}
listTestFiles(testDir);

console.log('\nRecommendation: The space in "CCL 3" directory name might be causing issues with vitest.');
console.log('Consider renaming the directory or using a symlink without spaces.');