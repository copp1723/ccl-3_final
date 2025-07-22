import { Router } from 'express';

const router = Router();

// Redirect email routes to email-agents for backward compatibility
router.use('/agents', (req, res, next) => {
  req.url = req.url.replace('/agents', '');
  next();
});

router.use('/campaigns', (req, res, next) => {
  req.url = req.url.replace('/campaigns', '/campaigns');
  next();
});

router.use('/templates', (req, res, next) => {
  req.url = req.url.replace('/templates', '');
  next();
});

router.use('/schedules', (req, res, next) => {
  req.url = req.url.replace('/schedules', '');
  next();
});

// Import and use the actual email-agents router
import emailAgentsRouter from './email-agents';
import emailTemplatesRouter from './email-templates';
import emailSchedulingRouter from './email-scheduling';

// Mount the routers
router.use('/agents', emailAgentsRouter);
router.use('/campaigns', emailAgentsRouter);  // campaigns are handled by email-agents
router.use('/templates', emailTemplatesRouter);
router.use('/schedules', emailSchedulingRouter);

export default router; 