import { Router } from 'express';
import { EmailTemplatesRepository } from '../db';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const router = Router();

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  content: z.string().min(1),
  plainText: z.string().optional(),
  category: z.enum(['initial_contact', 'follow_up', 'nurture', 'custom']),
  variables: z.array(z.string()).optional(),
  campaignId: z.string().optional(),
  agentId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
  active: z.boolean().optional()
});

const replaceVariablesSchema = z.object({
  templateId: z.string(),
  variables: z.record(z.string())
});

// Get all templates
router.get('/api/email-templates', async (req, res) => {
  try {
    const { category, campaignId, agentId, active, search, limit, offset } = req.query;
    
    const templates = await EmailTemplatesRepository.findAll({
      category: category as string,
      campaignId: campaignId as string,
      agentId: agentId as string,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      search: search as string
    });
    
    // Apply pagination if requested
    let paginatedTemplates = templates;
    if (limit || offset) {
      const start = parseInt(offset as string) || 0;
      const end = start + (parseInt(limit as string) || templates.length);
      paginatedTemplates = templates.slice(start, end);
    }
    
    res.json({ 
      templates: paginatedTemplates,
      total: templates.length,
      offset: parseInt(offset as string) || 0,
      limit: parseInt(limit as string) || templates.length
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Get single template
router.get('/api/email-templates/:id', async (req, res) => {
  try {
    const template = await EmailTemplatesRepository.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create template
router.post('/api/email-templates', async (req, res) => {
  try {
    // Validate request body
    const validationResult = createTemplateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationError.toString() 
      });
    }
    
    const data = validationResult.data;
    
    // Check for duplicate name
    const existing = await EmailTemplatesRepository.findByName(data.name);
    if (existing) {
      return res.status(409).json({ error: 'Template with this name already exists' });
    }
    
    // Extract variables from content if not provided
    const extractedVars = EmailTemplatesRepository.extractVariables(data.content);
    if (!data.variables || data.variables.length === 0) {
      data.variables = extractedVars;
    }
    
    const template = await EmailTemplatesRepository.create({
      ...data,
      active: true,
      performance: { sent: 0, opened: 0, clicked: 0, replied: 0 },
      metadata: data.metadata || {}
    });
    
    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/api/email-templates/:id', async (req, res) => {
  try {
    // Validate request body
    const validationResult = updateTemplateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationError.toString() 
      });
    }
    
    // Check if template exists
    const existing = await EmailTemplatesRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const data = validationResult.data;
    
    // Check for duplicate name if name is being changed
    if (data.name && data.name !== existing.name) {
      const duplicate = await EmailTemplatesRepository.findByName(data.name);
      if (duplicate) {
        return res.status(409).json({ error: 'Template with this name already exists' });
      }
    }
    
    // Re-extract variables if content changed
    if (data.content) {
      const extractedVars = EmailTemplatesRepository.extractVariables(data.content);
      data.variables = extractedVars;
    }
    
    const template = await EmailTemplatesRepository.update(req.params.id, data);
    
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Toggle template active status
router.patch('/api/email-templates/:id/toggle', async (req, res) => {
  try {
    const template = await EmailTemplatesRepository.toggleActive(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ 
      success: true, 
      template,
      message: `Template ${template.active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling template:', error);
    res.status(500).json({ error: 'Failed to toggle template status' });
  }
});

// Delete template
router.delete('/api/email-templates/:id', async (req, res) => {
  try {
    const template = await EmailTemplatesRepository.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if template has been used
    if (template.performance.sent > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete template that has been used',
        details: `This template has been sent ${template.performance.sent} times`
      });
    }
    
    const deleted = await EmailTemplatesRepository.delete(req.params.id);
    
    res.json({ 
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Clone template
router.post('/api/email-templates/:id/clone', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'New template name is required' });
    }
    
    // Check for duplicate name
    const existing = await EmailTemplatesRepository.findByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Template with this name already exists' });
    }
    
    const cloned = await EmailTemplatesRepository.clone(req.params.id, name);
    
    if (!cloned) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.status(201).json({ 
      success: true, 
      template: cloned,
      message: 'Template cloned successfully'
    });
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({ error: 'Failed to clone template' });
  }
});

// Preview template with variables
router.post('/api/email-templates/preview', async (req, res) => {
  try {
    const validationResult = replaceVariablesSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationError.toString() 
      });
    }
    
    const { templateId, variables } = validationResult.data;
    
    const template = await EmailTemplatesRepository.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const preview = {
      subject: EmailTemplatesRepository.replaceVariables(template.subject, variables),
      content: EmailTemplatesRepository.replaceVariables(template.content, variables),
      plainText: template.plainText 
        ? EmailTemplatesRepository.replaceVariables(template.plainText, variables)
        : null
    };
    
    res.json({ preview });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

// Get template performance stats
router.get('/api/email-templates/:id/performance', async (req, res) => {
  try {
    const template = await EmailTemplatesRepository.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ 
      performance: template.performance,
      templateId: template.id,
      templateName: template.name
    });
  } catch (error) {
    console.error('Error fetching template performance:', error);
    res.status(500).json({ error: 'Failed to fetch template performance' });
  }
});

// Get top performing templates
router.get('/api/email-templates/top-performing', async (req, res) => {
  try {
    const { metric, limit } = req.query;
    const validMetrics = ['openRate', 'clickRate', 'replyRate'];
    
    const selectedMetric = validMetrics.includes(metric as string) 
      ? (metric as 'openRate' | 'clickRate' | 'replyRate')
      : 'openRate';
    
    const templates = await EmailTemplatesRepository.getTopPerforming(
      selectedMetric,
      limit ? parseInt(limit as string) : 10
    );
    
    res.json({ 
      templates,
      metric: selectedMetric
    });
  } catch (error) {
    console.error('Error fetching top performing templates:', error);
    res.status(500).json({ error: 'Failed to fetch top performing templates' });
  }
});

// Create default templates
router.post('/api/email-templates/create-defaults', async (req, res) => {
  try {
    await EmailTemplatesRepository.createDefaultTemplates();
    
    res.json({ 
      success: true,
      message: 'Default templates created successfully'
    });
  } catch (error) {
    console.error('Error creating default templates:', error);
    res.status(500).json({ error: 'Failed to create default templates' });
  }
});

// Update template performance (webhook endpoint)
router.post('/api/email-templates/:id/track', async (req, res) => {
  try {
    const { metric } = req.body;
    const validMetrics = ['sent', 'opened', 'clicked', 'replied'];
    
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({ error: 'Invalid metric' });
    }
    
    const template = await EmailTemplatesRepository.updatePerformance(
      req.params.id,
      metric as 'sent' | 'opened' | 'clicked' | 'replied'
    );
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ 
      success: true,
      performance: template.performance
    });
  } catch (error) {
    console.error('Error tracking template performance:', error);
    res.status(500).json({ error: 'Failed to track template performance' });
  }
});

export default router;