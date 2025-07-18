import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const ClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  industry: z.string().optional(),
  brand_config: z.any().optional(),
});

const ClientUpdateSchema = ClientSchema.partial();

export default async function (fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Get all clients
  fastify.get('/', async (request, reply) => {
    // In a real multi-agency setup, you'd filter by agency_id
    const clients = await db.any('SELECT * FROM clients ORDER BY name ASC');
    reply.send({ success: true, data: clients });
  });

  // Get a single client
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await db.oneOrNone('SELECT * FROM clients WHERE id = $1', [id]);
    if (client) {
      reply.send({ success: true, data: client });
    } else {
      reply.status(404).send({ success: false, message: 'Client not found' });
    }
  });

  // Create a new client
  fastify.post('/', async (request, reply) => {
    try {
      const newClientData = ClientSchema.parse(request.body);
      const newClient = await db.one(
        'INSERT INTO clients (name, industry, brand_config) VALUES ($1, $2, $3) RETURNING *',
        [newClientData.name, newClientData.industry, newClientData.brand_config || {}]
      );
      reply.status(201).send({ success: true, data: newClient });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ success: false, message: 'Invalid client data', errors: error.errors });
      } else {
        reply.status(500).send({ success: false, message: 'Internal Server Error' });
      }
    }
  });

  // Update a client
  fastify.put('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updates = ClientUpdateSchema.parse(request.body);

      const updatedClient = await db.oneOrNone(
        'UPDATE clients SET name = COALESCE($1, name), industry = COALESCE($2, industry), brand_config = COALESCE($3, brand_config) WHERE id = $4 RETURNING *',
        [updates.name, updates.industry, updates.brand_config, id]
      );

      if (updatedClient) {
        reply.send({ success: true, data: updatedClient });
      } else {
        reply.status(404).send({ success: false, message: 'Client not found' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ success: false, message: 'Invalid update data', errors: error.errors });
      } else {
        reply.status(500).send({ success: false, message: 'Internal Server Error' });
      }
    }
  });

  // Delete a client
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await db.result('DELETE FROM clients WHERE id = $1', [id]);
    if (result.rowCount > 0) {
      reply.send({ success: true, message: 'Client deleted successfully' });
    } else {
      reply.status(404).send({ success: false, message: 'Client not found' });
    }
  });
}