import { Express } from 'express';
import { cclApiRateLimit } from '../middleware/rate-limit.js';
import { healthHandler } from '../api/unified-handlers';

// Route imports
import authRoutes from './auth';
import boberdooRoutes from './boberdoo';
import campaignsRoutes from './campaigns';
import communicationsRoutes from './communications';
import agentDecisionsRoutes from './agent-decisions';
import importRoutes from './import';
import emailAgentsRoutes from './email-agents';
import emailTemplatesRoutes from './email-templates';
import agentConfigurationsRoutes from './agent-configurations';
import notificationsRoutes from './notifications';
import usersRoutes from './users';
import analyticsRoutes from './analytics';
import leadDetailsRoutes from './lead-details';
import exportRoutes from './export';
import systemHealthRoutes from './system-health';
import multiAgentCampaignsRoutes from './multi-agent-campaigns';
import handoverRoutes from './handover';

// Route configuration
interface RouteConfig {
  path: string;
  router: any;
  middleware?: any[];
  public?: boolean;
}

const routes: RouteConfig[] = [
  // Public routes (no auth required)
  { path: '/api/auth', router: authRoutes, public: true },
  { path: '/api/webhooks', router: communicationsRoutes, public: true },
  
  // Protected API routes
  { path: '/api/boberdoo', router: boberdooRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/campaigns', router: campaignsRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/communications', router: communicationsRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/agent-decisions', router: agentDecisionsRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/import', router: importRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/email', router: emailAgentsRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/email-templates', router: emailTemplatesRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/agent-configurations', router: agentConfigurationsRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/notifications', router: notificationsRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/users', router: usersRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/analytics', router: analyticsRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/lead-details', router: leadDetailsRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/export', router: exportRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/handover', router: handoverRoutes, middleware: [cclApiRateLimit] },
  { path: '/api/multi-agent-campaigns', router: multiAgentCampaignsRoutes, middleware: [cclApiRateLimit] },
  
  // System routes
  { path: '/api/system', router: systemHealthRoutes },
  // { path: '/api/queues', router: queueMonitoringRoutes },
  // { path: '/api/monitoring', router: monitoringRoutes }
];

/**
 * Register all application routes with standardized middleware
 */
export function registerRoutes(app: Express) {
  // Global health endpoint
  app.get('/health', healthHandler.check);
  app.get('/api/health', healthHandler.check);
  
  // Register all routes
  routes.forEach(({ path, router, middleware = [], public: isPublic }) => {
    try {
      if (isPublic) {
        app.use(path, router);
      } else {
        app.use(path, ...middleware, router);
      }
    } catch (error) {
      console.warn(`Failed to register route ${path}:`, error);
    }
  });
}

// Export route configuration for external use
export { routes as routeConfig };