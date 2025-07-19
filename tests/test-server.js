#!/usr/bin/env node
// test-server.js - Simple test to verify setup

const http = require('http');

console.log('🧪 Testing simple server setup...\n');

// Create a very simple test server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <body style="font-family: Arial; padding: 50px;">
        <h1>✅ CCL Test Server is Working!</h1>
        <p>If you can see this, your Node.js is working correctly.</p>
        <h2>Next Steps:</h2>
        <ol>
          <li>Open a terminal in the CCL-3 directory</li>
          <li>Run: <code>npm install</code> (this may take a few minutes)</li>
          <li>Run: <code>npm run dev:quick</code> (starts backend)</li>
          <li>In another terminal, run: <code>npm run dev</code> (starts frontend)</li>
          <li>Open: <a href="http://localhost:5173">http://localhost:5173</a></li>
        </ol>
      </body>
    </html>
  `);
});

server.listen(3333, () => {
  console.log('🌐 Test server running at: http://localhost:3333');
  console.log('👉 Open this URL in your browser\n');
  console.log('Press Ctrl+C to stop');
});
