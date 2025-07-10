import { Router } from 'express';
import { superMemory } from '../services/supermemory';

const router = Router();

// Add memory endpoint
router.post('/api/supermemory/memories', async (req, res) => {
  try {
    const { content, metadata, spaces } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const memoryId = await superMemory.addMemory({
      content,
      metadata,
      spaces
    });
    
    if (memoryId) {
      res.json({ success: true, memoryId });
    } else {
      res.status(500).json({ error: 'Failed to add memory' });
    }
  } catch (error) {
    console.error('Error adding memory:', error);
    res.status(500).json({ error: 'Failed to add memory' });
  }
});

// Search memories endpoint
router.post('/api/supermemory/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await superMemory.searchMemories(query, limit);
    res.json({ results });
  } catch (error) {
    console.error('Error searching memories:', error);
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

// Delete memory endpoint
router.delete('/api/supermemory/memories/:id', async (req, res) => {
  try {
    const success = await superMemory.deleteMemory(req.params.id);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Memory not found or failed to delete' });
    }
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

export default router;