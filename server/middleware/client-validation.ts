import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { dbConnectionManager } from '../db/connection-manager';
import { mockClients } from '../db/mock-data';

export interface ClientRequest extends Request {
  clientId?: string;
  clientData?: {
    id: string;
    name: string;
    domain?: string;
    settings?: any;
    active: boolean;
  };
}

/**
 * Improved middleware to detect and validate client context
 * Works with or without database connection
 */
export async function clientValidation(req: ClientRequest, res: Response, next: NextFunction) {
  try {
    let clientId: string | undefined;
    
    // 1. Check for client ID in headers
    const headerClientId = req.headers['x-client-id'] || req.headers['client-id'];
    if (headerClientId && typeof headerClientId === 'string') {
      clientId = headerClientId;
    }
    
    // 2. Check for client ID in query params
    if (!clientId && req.query.clientId) {
      clientId = req.query.clientId as string;
    }
    
    // 3. Domain-based detection or default
    if (!clientId) {
      // Try to find by domain if database is connected
      const client = await dbConnectionManager.executeWithFallback(
        async () => {
          const { clientsRepository } = await import('../db/clients-repository');
          return req.hostname ? await clientsRepository.findByDomain(req.hostname) : null;
        },
        () => {
          // Fallback: check mock data
          return req.hostname ? mockClients.findByDomain(req.hostname) : null;
        }
      );
      
      if (client) {
        clientId = client.id;
      }
    }
    
    // 4. Default to 'ccl-default' if no client found
    if (!clientId) {
      clientId = 'ccl-default';
    }
    
    // 5. Validate and fetch client data
    const clientData = await dbConnectionManager.executeWithFallback(
      async () => {
        const { clientsRepository } = await import('../db/clients-repository');
        return await clientsRepository.findById(clientId!);
      },
      () => {
        // Fallback: use mock data
        return mockClients.findById(clientId!);
      }
    );
    
    if (clientData && clientData.active) {
      req.clientId = clientId;
      req.clientData = clientData;
      logger.debug('Client context set', { clientId, source: dbConnectionManager.isConnected() ? 'database' : 'fallback' });
    } else {
      logger.warn(`Invalid or inactive client: ${clientId}`);
      // Still set default client to allow request to proceed
      req.clientId = 'ccl-default';
      req.clientData = mockClients.findById('ccl-default')!;
    }
    
    next();
  } catch (error) {
    logger.error('Client validation error:', error);
    // Set default client on any error
    req.clientId = 'ccl-default';
    req.clientData = mockClients.findById('ccl-default')!;
    next();
  }
}