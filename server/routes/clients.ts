import { Router } from 'express';
import { db } from '../db';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = Router();

const ClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  industry: z.string().optional(),
  brand_config: z.any().optional(),
});

const ClientUpdateSchema = ClientSchema.partial();

// Apply authentication to all routes
router.use(authenticate);

// Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await db.any('SELECT * FROM clients ORDER BY name ASC');
    res.json({ success: true, data: clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Get a single client
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await db.oneOrNone('SELECT * FROM clients WHERE id = $1', [id]);
    if (client) {
      res.json({ success: true, data: client });
    } else {
      res.status(404).json({ success: false, message: 'Client not found' });
    }
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Create a new client
router.post('/', async (req, res) => {
  try {
    const newClientData = ClientSchema.parse(req.body);
    const newClient = await db.one(
      'INSERT INTO clients (name, industry, brand_config) VALUES ($1, $2, $3) RETURNING *',
      [newClientData.name, newClientData.industry, newClientData.brand_config || {}]
    );
    res.status(201).json({ success: true, data: newClient });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Invalid client data', errors: error.errors });
    } else {
      console.error('Error creating client:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
});

// Update a client
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = ClientUpdateSchema.parse(req.body);

    const updatedClient = await db.oneOrNone(
      'UPDATE clients SET name = COALESCE($1, name), industry = COALESCE($2, industry), brand_config = COALESCE($3, brand_config) WHERE id = $4 RETURNING *',
      [updates.name, updates.industry, updates.brand_config, id]
    );

    if (updatedClient) {
      res.json({ success: true, data: updatedClient });
    } else {
      res.status(404).json({ success: false, message: 'Client not found' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Invalid update data', errors: error.errors });
    } else {
      console.error('Error updating client:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
});

// Delete a client
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.result('DELETE FROM clients WHERE id = $1', [id]);
    if (result.rowCount > 0) {
      res.json({ success: true, message: 'Client deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Client not found' });
    }
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

export default router;