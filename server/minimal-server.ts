import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'CCL-3 SWARM Server is running!',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`🚀 Minimal CCL-3 SWARM server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});