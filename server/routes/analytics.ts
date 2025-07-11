import { Router } from 'express';
import { AnalyticsRepository } from '../db';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import { validateQuery } from '../middleware/validation';
import { auditView } from '../middleware/audit';

const router = Router();

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

const analyticsQuerySchema = dateRangeSchema.extend({
  campaignId: z.string().optional(),
  source: z.string().optional(),
  channel: z.enum(['email', 'sms', 'chat']).optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional()
});

// Dashboard overview
router.get('/overview',
  authenticate,
  validateQuery(dateRangeSchema),
  auditView('analytics_dashboard'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const stats = await AnalyticsRepository.getDashboardStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json({ stats });
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
    }
  }
);

// Lead analytics
router.get('/leads',
  authenticate,
  validateQuery(analyticsQuerySchema),
  auditView('analytics_leads'),
  async (req, res) => {
    try {
      const { startDate, endDate, campaignId, source } = req.query;
      
      const analytics = await AnalyticsRepository.getLeadAnalytics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        campaignId: campaignId as string,
        source: source as string
      });
      
      res.json({ analytics });
    } catch (error) {
      console.error('Lead analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch lead analytics' });
    }
  }
);

// Campaign performance
router.get('/campaigns',
  authenticate,
  auditView('analytics_campaigns'),
  async (req, res) => {
    try {
      const { campaignId } = req.query;
      
      const performance = await AnalyticsRepository.getCampaignPerformance(
        campaignId as string
      );
      
      res.json({ performance });
    } catch (error) {
      console.error('Campaign analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch campaign analytics' });
    }
  }
);

// Agent performance
router.get('/agents',
  authenticate,
  authorize('admin', 'manager'),
  validateQuery(dateRangeSchema),
  auditView('analytics_agents'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const performance = await AnalyticsRepository.getAgentPerformance(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json({ performance });
    } catch (error) {
      console.error('Agent analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch agent analytics' });
    }
  }
);

// Communication analytics
router.get('/communications',
  authenticate,
  validateQuery(analyticsQuerySchema),
  auditView('analytics_communications'),
  async (req, res) => {
    try {
      const { startDate, endDate, channel } = req.query;
      
      const analytics = await AnalyticsRepository.getCommunicationAnalytics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        channel: channel as 'email' | 'sms' | 'chat'
      });
      
      res.json({ analytics });
    } catch (error) {
      console.error('Communication analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch communication analytics' });
    }
  }
);

// Funnel analysis
router.get('/funnel',
  authenticate,
  validateQuery(dateRangeSchema),
  auditView('analytics_funnel'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const funnel = await AnalyticsRepository.getFunnelAnalysis(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json({ funnel });
    } catch (error) {
      console.error('Funnel analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch funnel analytics' });
    }
  }
);

// Custom event metrics
router.get('/events/:eventType',
  authenticate,
  validateQuery(analyticsQuerySchema),
  auditView('analytics_events'),
  async (req, res) => {
    try {
      const { eventType } = req.params;
      const { startDate, endDate, groupBy } = req.query;
      
      const metrics = await AnalyticsRepository.getEventMetrics(
        eventType,
        {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          groupBy: groupBy as 'day' | 'week' | 'month'
        }
      );
      
      res.json({ metrics });
    } catch (error) {
      console.error('Event analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch event analytics' });
    }
  }
);

// Track custom event
router.post('/track',
  authenticate,
  async (req, res) => {
    try {
      const { eventType, leadId, campaignId, channel, value, metadata } = req.body;
      
      if (!eventType) {
        return res.status(400).json({ error: 'Event type is required' });
      }
      
      const event = await AnalyticsRepository.trackEvent({
        eventType,
        leadId,
        campaignId,
        userId: req.user!.id,
        channel,
        value,
        metadata
      });
      
      res.json({ 
        success: true,
        event
      });
    } catch (error) {
      console.error('Track event error:', error);
      res.status(500).json({ error: 'Failed to track event' });
    }
  }
);

// Real-time stats WebSocket endpoint would go here
// This would be implemented in the main WebSocket handler

export default router;