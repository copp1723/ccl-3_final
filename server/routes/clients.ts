import { Router } from 'express';
import { clientsRepository as ClientsRepository } from '../db';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = Router();

const ClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  industry: z.string().optional(),
  domain: z.string().optional(),
  settings: z.object({
    branding: z.any().optional()
  }).optional(),
  brand_config: z.any().optional(),
});

const ClientUpdateSchema = ClientSchema.partial();

// Apply authentication to all routes (skip in development for easier testing)
router.use(process.env.NODE_ENV === 'development' ? (_req: any, _res: any, next: any) => next() : authenticate);

// Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await ClientsRepository.list();
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
    const client = await ClientsRepository.findById(id);
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
    const clientData = {
      name: newClientData.name,
      domain: newClientData.domain,
      settings: newClientData.settings || { branding: newClientData.brand_config || {} },
      active: true
    };
    const newClient = await ClientsRepository.create(clientData);
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
    
    const updatedClient = await ClientsRepository.update(id, updates);
    
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
    const success = await ClientsRepository.delete(id);
    if (success) {
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