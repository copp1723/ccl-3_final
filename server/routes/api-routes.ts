import { Router } from 'express';
import { createSuccessResponse, createErrorResponse } from '../api/unified-handlers';
import { defaultEmailTemplates } from '../../shared/templates/email-templates';
import { getStaticBrandings } from '../../shared/config/branding-config';

const router = Router();

// Stats endpoint
router.get('/leads/stats/summary', async (req, res) => {
  res.json(createSuccessResponse({
    total: 0,
    new: 0,
    qualified: 0,
    converted: 0
  }));
});

// Agents endpoint
router.get('/agents', async (req, res) => {
  res.json(createSuccessResponse([
    {
      id: 'email-nurture-ai',
      name: 'Email Nurture AI',
      type: 'email',
      endGoal: 'Convert leads through personalized email conversations'
    }
  ]));
});

// Email routes
router.get('/email/agents', async (req, res) => {
  res.json(createSuccessResponse([
    {
      id: 'email-nurture-ai',
      name: 'Email Nurture AI',
      type: 'email'
    }
  ]));
});

router.get('/email/campaigns', async (req, res) => {
  res.json(createSuccessResponse([]));
});

router.get('/email/schedules', async (req, res) => {
  res.json(createSuccessResponse([
    {
      id: 'standard',
      name: 'Standard Follow-up',
      type: 'fixed'
    }
  ]));
});

// Use unified email templates
router.get('/email/templates', async (req, res) => {
  res.json(createSuccessResponse(defaultEmailTemplates));
});

// Branding endpoint
router.get('/branding', async (req, res) => {
  try {
    const staticBrandings = getStaticBrandings();
    res.json({
      success: true,
      brandings: staticBrandings
    });
  } catch (error) {
    console.error('Error fetching brandings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch branding configurations'
    });
  }
});

export default router;