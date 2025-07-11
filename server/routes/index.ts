import { Express } from 'express';
import { apiRateLimit } from '../middleware/rate-limit';
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
import leadsRoutes from './leads';
import exportRoutes from './export';
import systemHealthRoutes from './system-health';
import multiAgentCampaignsRoutes from './multi-agent-campaigns';
import handoverRoutes from './handover';
import brandingRoutes from './branding';
import supermemoryRoutes from './supermemory';
import cacheRoutes from './cache';
import { clientValidation } from '../middleware/client-validation';

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
  { path: '/api/boberdoo', router: boberdooRoutes, middleware: [apiRateLimit] },
  { path: '/api/campaigns', router: campaignsRoutes, middleware: [apiRateLimit] },
  { path: '/api/communications', router: communicationsRoutes, middleware: [apiRateLimit] },
  { path: '/api/agent-decisions', router: agentDecisionsRoutes, middleware: [apiRateLimit] },
  { path: '/api/import', router: importRoutes, middleware: [apiRateLimit] },
  { path: '/api/email', router: emailAgentsRoutes, middleware: [apiRateLimit] },
  { path: '/api/email-templates', router: emailTemplatesRoutes, middleware: [apiRateLimit] },
  { path: '/api/agent-configurations', router: agentConfigurationsRoutes, middleware: [apiRateLimit] },
  { path: '/api/notifications', router: notificationsRoutes, middleware: [apiRateLimit] },
  { path: '/api/users', router: usersRoutes, middleware: [apiRateLimit] },
  { path: '/api/analytics', router: analyticsRoutes, middleware: [apiRateLimit] },
  { path: '/api/leads', router: leadsRoutes, middleware: [apiRateLimit] },
  { path: '/api/lead-details', router: leadDetailsRoutes, middleware: [apiRateLimit] },
  { path: '/api/export', router: exportRoutes, middleware: [apiRateLimit] },
  { path: '/api/handover', router: handoverRoutes, middleware: [apiRateLimit] },
  { path: '/api/multi-agent-campaigns', router: multiAgentCampaignsRoutes, middleware: [apiRateLimit] },
  { path: '/api/branding', router: brandingRoutes, middleware: [apiRateLimit] },
  { path: '/api/supermemory', router: supermemoryRoutes, middleware: [apiRateLimit] },
  { path: '/api/cache', router: cacheRoutes, middleware: [apiRateLimit] },
  
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
  
  // Apply client validation to all API routes
  app.use('/api', clientValidation);
  
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