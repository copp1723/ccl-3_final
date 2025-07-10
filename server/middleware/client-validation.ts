import { Request, Response, NextFunction } from 'express'
import { clientsRepository } from '../db/clients-repository'
import { logger } from '../utils/logger'

export interface ClientRequest extends Request {
  clientId?: string
  clientData?: {
    id: string
    name: string
    domain?: string
    settings?: any
    active?: boolean
  }
}

/**
 * Middleware to detect and validate client context from domain or headers
 */
export async function clientValidation(req: ClientRequest, res: Response, next: NextFunction) {
  try {
    let clientId: string | null = null
    
    // 1. Check for explicit client ID in headers (for API calls)
    if (req.headers['x-client-id']) {
      clientId = req.headers['x-client-id'] as string
    }
    
    // 2. Check for subdomain-based client detection
    if (!clientId && req.hostname) {
      const subdomain = req.hostname.split('.')[0]
      if (subdomain && subdomain !== 'www' && subdomain !== req.hostname) {
        clientId = subdomain
      }
    }
    
    // 3. Check for domain-based client detection
    if (!clientId && req.hostname) {
      const client = await clientsRepository.findByDomain(req.hostname)
      if (client) {
        clientId = client.id
      }
    }
    
    // 4. Validate client exists and is active
    if (clientId) {
      const client = await clientsRepository.findById(clientId)
      if (client && client.active) {
        req.clientId = clientId
        req.clientData = client
      } else {
        logger.warn(`Invalid or inactive client: ${clientId}`, { hostname: req.hostname })
      }
    }
    
    next()
  } catch (error) {
    logger.error('Client validation error:', error)
    next() // Continue without client context rather than failing
  }
}

/**
 * Middleware to require valid client context
 */
export function requireClient(req: ClientRequest, res: Response, next: NextFunction) {
  if (!req.clientId || !req.clientData) {
    return res.status(400).json({
      success: false,
      error: 'Valid client context required'
    })
  }
  next()
}

/**
 * Middleware to add client_id to database queries
 */
export function addClientFilter(req: ClientRequest, res: Response, next: NextFunction) {
  if (req.clientId) {
    // Add client filter to query parameters
    req.query.client_id = req.clientId
  }
  next()
}

/**
 * Utility to get client ID from request
 */
export function getClientId(req: ClientRequest): string | null {
  return req.clientId || null
}

/**
 * Utility to ensure client isolation in database operations
 */
export function ensureClientIsolation(data: any, clientId: string | null): any {
  if (clientId && typeof data === 'object' && data !== null) {
    return { ...data, client_id: clientId }
  }
  return data
}