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
        name: 'Welcome Email',
        subject: 'Welcome to {{companyName}}, {{firstName}}!',
        content: `Hi {{firstName}},

Welcome to {{companyName}}! We're excited to have you on board.

Here's what you can expect:
- Personalized service from our team
- Regular updates on your {{vehicleInterest}} search
- Exclusive deals and financing options

If you have any questions, feel free to reach out to us at any time.

Best regards,
The {{companyName}} Team`,
        category: 'welcome',
        variables: ['firstName', 'companyName', 'vehicleInterest'],
        isActive: true,
        createdAt: new Date('2024-01-01').toISOString()
      },
      {
        id: 'template-2',
        name: 'Follow-up Email',
        subject: 'Still looking for your {{vehicleInterest}}, {{firstName}}?',
        content: `Hi {{firstName}},

I wanted to follow up on your interest in {{vehicleInterest}}.

We have some great new options that might be perfect for you:
- Competitive financing rates starting at {{interestRate}}%
- Extended warranty options
- Trade-in evaluations

Would you like to schedule a quick call to discuss your options?

Best regards,
{{agentName}}
{{companyName}}`,
        category: 'followup',
        variables: ['firstName', 'vehicleInterest', 'interestRate', 'agentName', 'companyName'],
        isActive: true,
        createdAt: new Date('2024-01-05').toISOString()
      },
      {
        id: 'template-3',
        name: 'Special Offer',
        subject: 'Exclusive offer for {{firstName}} - Limited time!',
        content: `Hi {{firstName}},

We have an exclusive offer just for you on {{vehicleInterest}}:

🎉 Special Financing: {{specialRate}}% APR
🎉 No payments for 90 days
🎉 Extended warranty included

This offer expires on {{expirationDate}}, so don't wait!

Click here to claim your offer: {{offerLink}}

Best regards,
{{agentName}}
{{companyName}}`,
        category: 'promotion',
        variables: ['firstName', 'vehicleInterest', 'specialRate', 'expirationDate', 'offerLink', 'agentName', 'companyName'],
        isActive: true,
        createdAt: new Date('2024-01-10').toISOString()
      }
    ]
  });
});

export default router;