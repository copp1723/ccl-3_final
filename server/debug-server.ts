import express from 'express';
import { createServer } from 'http';

console.log('🔄 Starting server initialization...');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

console.log('✅ Express app created');

app.use(express.json());
console.log('✅ JSON middleware added');

// Test routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'CCL-3 SWARM Server is running!',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Routes configured');

// Try to import agents
try {
  console.log('🔄 Importing agents...');
  const { getOverlordAgent } = await import('./agents/index.js');
  console.log('✅ Agents imported successfully');
  
  // Test agent creation
  const overlord = getOverlordAgent();
  console.log('✅ Overlord agent created');
} catch (error) {
  console.error('❌ Agent import/creation failed:', error);
}

server.listen(PORT, () => {
  console.log(`🚀 Debug server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});