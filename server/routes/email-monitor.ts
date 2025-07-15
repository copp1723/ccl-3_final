import { Router } from 'express';
import { z } from 'zod';
import { emailMonitor } from '../services/email-monitor';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Email trigger rule schema
const triggerRuleSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  conditions: z.object({
    from: z.union([z.string(), z.array(z.string())]).optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    hasAttachment: z.boolean().optional()
  }),
  actions: z.object({
    createLead: z.boolean().default(true),
    assignCampaign: z.string().optional(),
    addTags: z.array(z.string()).optional(),
    setSource: z.string().optional(),
    setPriority: z.enum(['low', 'normal', 'high', 'urgent']).optional()
  })
});

// Get all trigger rules
router.get('/rules', authenticate, async (req, res) => {
  try {
    const rules = emailMonitor.getTriggerRules();
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    logger.error('Failed to get email trigger rules', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trigger rules'
    });
  }
});

// Create new trigger rule
router.post('/rules', authenticate, async (req, res) => {
  try {
    const data = triggerRuleSchema.parse(req.body);
    
    const rule = {
      id: crypto.randomUUID(),
      ...data,
      conditions: {
        ...data.conditions,
        // Convert string patterns to RegExp if needed
        subject: data.conditions.subject ? new RegExp(data.conditions.subject, 'i') : undefined,
        body: data.conditions.body ? new RegExp(data.conditions.body, 'i') : undefined
      }
    };
    
    await emailMonitor.addTriggerRule(rule);
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid rule data',
        details: error.errors
      });
    }
    
    logger.error('Failed to create email trigger rule', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to create trigger rule'
    });
  }
});

// Update trigger rule
router.put('/rules/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Convert string patterns to RegExp if needed
    if (updates.conditions?.subject && typeof updates.conditions.subject === 'string') {
      updates.conditions.subject = new RegExp(updates.conditions.subject, 'i');
    }
    if (updates.conditions?.body && typeof updates.conditions.body === 'string') {
      updates.conditions.body = new RegExp(updates.conditions.body, 'i');
    }
    
    await emailMonitor.updateTriggerRule(id, updates);
    
    res.json({
      success: true,
      message: 'Rule updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update email trigger rule', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trigger rule'
    });
  }
});

// Delete trigger rule
router.delete('/rules/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await emailMonitor.removeTriggerRule(id);
    
    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete email trigger rule', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trigger rule'
    });
  }
});

// Get monitor status
router.get('/status', authenticate, async (req, res) => {
  try {
    const isRunning = (emailMonitor as any).connection !== null;
    const rules = emailMonitor.getTriggerRules();
    
    res.json({
      success: true,
      data: {
        running: isRunning,
        totalRules: rules.length,
        activeRules: rules.filter(r => r.enabled).length,
        config: {
          host: process.env.IMAP_HOST,
          user: process.env.IMAP_USER,
          port: process.env.IMAP_PORT
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get email monitor status', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitor status'
    });
  }
});

// Start email monitor
router.post('/start', authenticate, async (req, res) => {
  try {
    // Check if already running
    if ((emailMonitor as any).connection !== null) {
      return res.json({
        success: true,
        message: 'Email monitor is already running'
      });
    }
    
    // Check configuration
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
      return res.status(400).json({
        success: false,
        error: 'Email monitor not configured. Please set IMAP_HOST, IMAP_USER, and IMAP_PASSWORD environment variables.'
      });
    }
    
    await emailMonitor.start();
    
    res.json({
      success: true,
      message: 'Email monitor started successfully'
    });
  } catch (error) {
    logger.error('Failed to start email monitor', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to start email monitor',
      details: (error as Error).message
    });
  }
});

// Stop email monitor
router.post('/stop', authenticate, async (req, res) => {
  try {
    await emailMonitor.stop();
    
    res.json({
      success: true,
      message: 'Email monitor stopped successfully'
    });
  } catch (error) {
    logger.error('Failed to stop email monitor', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop email monitor'
    });
  }
});

// Test email processing (for debugging)
router.post('/test', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.from || !email.subject) {
      return res.status(400).json({
        success: false,
        error: 'Invalid test email data'
      });
    }
    
    // Create a mock ParsedMail object
    const mockEmail = {
      from: {
        value: [{
          address: email.from,
          name: email.fromName || ''
        }]
      },
      subject: email.subject,
      text: email.body || '',
      html: email.html || '',
      attachments: email.attachments || [],
      date: new Date(),
      messageId: `test-${Date.now()}`
    };
    
    const result = await (emailMonitor as any).processEmail(mockEmail);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to test email processing', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to test email processing',
      details: (error as Error).message
    });
  }
});

export default router; 