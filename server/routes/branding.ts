import { Router } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { clientsRepository } from '../db/wrapped-repositories';
import { 
  CCLBrandingConfig, 
  CLIENT_BRANDINGS, 
  DEFAULT_BRANDING,
  getStaticBrandings,
  sanitizeCSS,
  brandingCache
} from '../../shared/config/branding-config';
import { clientValidation, ClientRequest } from '../middleware/client-validation';

const router = Router();

// Validation schema for branding configuration
const brandingConfigSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  logoUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Primary color must be a valid hex color'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Secondary color must be a valid hex color'),
  domain: z.string().optional().or(z.literal('')),
  emailFromName: z.string().min(1, 'Email from name is required'),
  supportEmail: z.string().email('Support email must be a valid email address'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  favicon: z.string().url().optional().or(z.literal('')),
  customCss: z.string().optional().or(z.literal(''))
});

const clientCreateSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  domain: z.string().optional().or(z.literal('')),
  branding: brandingConfigSchema
});

// Apply client validation middleware
router.use(clientValidation);

// Get all client brandings
router.get('/', async (req: ClientRequest, res) => {
  try {
    // Get static brandings
    const staticBrandings = getStaticBrandings();
    
    // Get database clients (filtered by client context if applicable)
    const clients = await clientsRepository.list();
    
    // Combine with proper caching
    const allBrandings = [
      ...staticBrandings,
      ...clients.map(client => ({
        id: client.id,
        name: client.name,
        domain: client.domain,
        branding: client.settings?.branding || DEFAULT_BRANDING,
        isStatic: false
      }))
    ];

    // Cache the results
    allBrandings.forEach(branding => {
      const cacheKey = `branding:${branding.id}`;
      brandingCache.set(cacheKey, branding);
    });

    res.json({
      success: true,
      brandings: allBrandings
    });
  } catch (error) {
    console.error('Error fetching brandings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch branding configurations'
    });
  }
});

// Get specific client branding
router.get('/:clientId', async (req: ClientRequest, res) => {
  try {
    const { clientId } = req.params;
    
    // Check cache first
    const cacheKey = `branding:${clientId}`;
    const cached = brandingCache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        branding: cached
      });
    }
    
    // Check if it's a static branding
    if (CLIENT_BRANDINGS[clientId]) {
      const staticBranding = {
        id: clientId,
        name: CLIENT_BRANDINGS[clientId].companyName,
        domain: CLIENT_BRANDINGS[clientId].domain,
        branding: CLIENT_BRANDINGS[clientId],
        isStatic: true
      };
      
      // Cache static branding
      brandingCache.set(cacheKey, staticBranding);
      
      return res.json({
        success: true,
        branding: staticBranding
      });
    }

    // Try to get from database
    const client = await clientsRepository.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    const brandingData = {
      id: client.id,
      name: client.name,
      domain: client.domain,
      branding: client.settings?.branding || DEFAULT_BRANDING,
      isStatic: false
    };
    
    // Cache database branding
    brandingCache.set(cacheKey, brandingData);

    res.json({
      success: true,
      branding: brandingData
    });
  } catch (error) {
    console.error('Error fetching client branding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client branding'
    });
  }
});

// Create new client with branding
router.post('/', async (req, res) => {
  try {
    const validationResult = clientCreateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationError.toString()
      });
    }

    const { name, domain, branding } = validationResult.data;
    
    // Sanitize custom CSS
    const sanitizedBranding = {
      ...branding,
      customCss: branding.customCss ? sanitizeCSS(branding.customCss) : undefined
    };

    // Check if domain is already in use
    if (domain) {
      const existingClient = await clientsRepository.findByDomain(domain);
      if (existingClient) {
        return res.status(409).json({
          success: false,
          error: 'Domain is already in use by another client'
        });
      }
    }

    const client = await clientsRepository.create({
      name,
      domain: domain || undefined,
      settings: { branding: sanitizedBranding }
    });
    
    // Clear cache for this client
    brandingCache.clear();

    res.status(201).json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        domain: client.domain,
        branding: client.settings?.branding,
        isStatic: false
      }
    });
  } catch (error) {
    console.error('Error creating client branding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create client branding'
    });
  }
});

// Update client branding
router.put('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Don't allow updating static brandings
    if (CLIENT_BRANDINGS[clientId]) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update static branding configurations'
      });
    }

    const validationResult = brandingConfigSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationError.toString()
      });
    }

    const branding = validationResult.data;
    
    // Sanitize custom CSS
    const sanitizedBranding = {
      ...branding,
      customCss: branding.customCss ? sanitizeCSS(branding.customCss) : undefined
    };
    
    const updatedClient = await clientsRepository.updateBranding(clientId, sanitizedBranding);
    
    // Clear cache for this client
    const cacheKey = `branding:${clientId}`;
    brandingCache.clear();

    if (!updatedClient) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    res.json({
      success: true,
      client: {
        id: updatedClient.id,
        name: updatedClient.name,
        domain: updatedClient.domain,
        branding: updatedClient.settings?.branding,
        isStatic: false
      }
    });
  } catch (error) {
    console.error('Error updating client branding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client branding'
    });
  }
});

// Delete client (only database clients, not static ones)
router.delete('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Don't allow deleting static brandings
    if (CLIENT_BRANDINGS[clientId]) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete static branding configurations'
      });
    }

    const client = await clientsRepository.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    // For now, we'll just mark as inactive instead of hard delete
    // This preserves data integrity
    await clientsRepository.updateBranding(clientId, { ...client.settings?.branding, active: false });

    res.json({
      success: true,
      message: 'Client branding deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting client branding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete client branding'
    });
  }
});

export default router;
