import { Express } from 'express';
import boberdooRoutes from './boberdoo';
import campaignsRoutes from './campaigns';
import communicationsRoutes from './communications';
import agentDecisionsRoutes from './agent-decisions';
import importRoutes from './import';
import emailAgentsRoutes from './email-agents';
import emailTemplatesRoutes from './email-templates';
import agentConfigurationsRoutes from './agent-configurations';
import notificationsRoutes from './notifications';
import authRoutes from './auth';
import usersRoutes from './users';
import analyticsRoutes from './analytics';
import leadDetailsRoutes from './lead-details';
import exportRoutes from './export';
import systemHealthRoutes from './system-health';
import queueMonitoringRoutes from './queue-monitoring';
import monitoringRoutes from './monitoring';
import { cclApiRateLimit } from '../middleware/rate-limit.js';

/**
 * Register all application routes
 */
export function registerRoutes(app: Express) {
  // Auth routes (before session middleware)
  app.use(authRoutes);

  // Boberdoo routes (before session middleware for API endpoints)
  app.use(cclApiRateLimit, boberdooRoutes);

  // Public API routes (before session middleware)
  app.use('/api/webhooks', cclApiRateLimit, communicationsRoutes); // Webhooks don't need auth

  // Protected API routes (will add auth middleware)
  app.use(cclApiRateLimit, campaignsRoutes);
  app.use(cclApiRateLimit, communicationsRoutes);
  app.use(cclApiRateLimit, agentDecisionsRoutes);
  app.use(cclApiRateLimit, importRoutes);
  app.use(cclApiRateLimit, emailTemplatesRoutes);
  app.use(cclApiRateLimit, agentConfigurationsRoutes);
  app.use(cclApiRateLimit, notificationsRoutes);
  app.use(cclApiRateLimit, usersRoutes);
  app.use(cclApiRateLimit, analyticsRoutes);
  app.use(cclApiRateLimit, leadDetailsRoutes);
  app.use(cclApiRateLimit, exportRoutes);
  app.use('/api/email', cclApiRateLimit, emailAgentsRoutes);
  
  // System routes (monitoring, health, etc.)
  app.use('/api/system', systemHealthRoutes);
  app.use('/api/queues', queueMonitoringRoutes);
  app.use('/api/monitoring', monitoringRoutes);
}

/**
 * Route configuration for easy management
 */
export const routeConfig = {
  rateLimited: [
    { path: '/api/boberdoo', router: boberdooRoutes },
    { path: '/api/campaigns', router: campaignsRoutes },
    { path: '/api/communications', router: communicationsRoutes },
    { path: '/api/agent-decisions', router: agentDecisionsRoutes },
    { path: '/api/import', router: importRoutes },
    { path: '/api/email-templates', router: emailTemplatesRoutes },
    { path: '/api/agent-configurations', router: agentConfigurationsRoutes },
    { path: '/api/notifications', router: notificationsRoutes },
    { path: '/api/users', router: usersRoutes },
    { path: '/api/analytics', router: analyticsRoutes },
    { path: '/api/lead-details', router: leadDetailsRoutes },
    { path: '/api/export', router: exportRoutes },
    { path: '/api/email', router: emailAgentsRoutes }
  ],
  public: [
    { path: '/api/webhooks', router: communicationsRoutes }
  ],
  system: [
    { path: '/api/system', router: systemHealthRoutes },
    { path: '/api/queues', router: queueMonitoringRoutes },
    { path: '/api/monitoring', router: monitoringRoutes }
  ],
  auth: [
    { path: '/api/auth', router: authRoutes }
  ]
};