// server/routes/api-routes.ts
import { Router } from 'express';

const router = Router();

// Stats endpoint
router.get('/leads/stats/summary', async (req, res) => {
  res.json({
    total: 0,
    new: 0,
    qualified: 0,
    converted: 0
  });
});

// Agents endpoint
router.get('/agents', async (req, res) => {
  res.json({
    data: [
      {
        id: 'email-nurture-ai',
        name: 'Email Nurture AI',
        type: 'email',
        endGoal: 'Convert leads through personalized email conversations'
      }
    ]
  });
});

// Email routes
router.get('/email/agents', async (req, res) => {
  res.json({
    data: [
      {
        id: 'email-nurture-ai',
        name: 'Email Nurture AI',
        type: 'email'
      }
    ]
  });
});

router.get('/email/campaigns', async (req, res) => {
  res.json({ data: [] });
});

router.get('/email/schedules', async (req, res) => {
  res.json({
    data: [
      {
        id: 'standard',
        name: 'Standard Follow-up',
        type: 'fixed'
      }
    ]
  });
});

router.get('/email/templates', async (req, res) => {
  res.json({
    data: [
      {
        id: 'template-1',
        name: 'Welcome Template',
        subject: 'Welcome! Quick question about your needs',
        category: 'welcome'
      },
      {
        id: 'template-2',
        name: 'Follow-up 1',
        subject: 'Did you find what you were looking for?',
        category: 'follow-up'
      }
    ]
  });
});

export default router;