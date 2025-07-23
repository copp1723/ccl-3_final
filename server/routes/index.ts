import { Express } from 'express';
import { apiRateLimit } from '../middleware/rate-limit';
import { healthHandler } from '../api/unified-handlers';
import { clientValidation } from '../middleware/client-validation';

// Route imports - all original routes, no fallbacks needed
import authRoutes from './auth';
import boberdooRoutes from './boberdoo';
import clientsRoutes from './clients';
import campaignsRoutes from './campaigns';
import communicationsRoutes from './communications';
import agentDecisionsRoutes from './agent-decisions';
import importRoutes from './import';
import emailAgentsRoutes from './email-agents';
import emailRoutes from './email';
import emailTemplatesRoutes from './email-templates';
import campaignIntelligenceRoutes from './campaign-intelligence';
import chatRoutes from './chat';
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
import conversationsRoutes from './conversations';
import campaignExecutionRoutes from './campaign-execution';
import emailMonitorRoutes from './email-monitor';
import handoverApiRoutes from './handover-api';
import emailSchedulingRoutes from './email-scheduling';
import testRoutes from './test';

// Route configuration
interface RouteConfig {
  path: string;
  router: any;
  public?: boolean;
  middleware?: any[];
}

const routes: RouteConfig[] = [
  // Public routes (no auth required)
  { path: '/api/auth', router: authRoutes, public: true },
  { path: '/api/webhooks', router: communicationsRoutes, public: true },
  
  // Protected API routes with rate limiting
  { path: '/api/boberdoo', router: boberdooRoutes, middleware: [apiRateLimit] },
  { path: '/api/clients', router: clientsRoutes, middleware: [apiRateLimit] },
  { path: '/api/campaigns', router: campaignsRoutes, middleware: [apiRateLimit] },
  { path: '/api/communications', router: communicationsRoutes, middleware: [apiRateLimit] },
  { path: '/api/agent-decisions', router: agentDecisionsRoutes, middleware: [apiRateLimit] },
  { path: '/api/import', router: importRoutes, middleware: [apiRateLimit] },
  { path: '/api/email', router: emailRoutes, middleware: [apiRateLimit] },
  { path: '/api/email-agents', router: emailAgentsRoutes, middleware: [apiRateLimit] },
  { path: '/api/email-templates', router: emailTemplatesRoutes, middleware: [apiRateLimit] },
  { path: '/api/campaign-intelligence', router: campaignIntelligenceRoutes, middleware: [apiRateLimit] },
  { path: '/api/chat', router: chatRoutes, middleware: [apiRateLimit] },
  { path: '/api/agent-configurations', router: agentConfigurationsRoutes, middleware: [apiRateLimit] },
  { path: '/api/agents', router: agentConfigurationsRoutes, middleware: [apiRateLimit] }, // Alias for agent-configurations
  { path: '/api/notifications', router: notificationsRoutes, middleware: [apiRateLimit] },
  { path: '/api/users', router: usersRoutes, middleware: [apiRateLimit] },
  { path: '/api/analytics', router: analyticsRoutes, middleware: [apiRateLimit] },
  { path: '/api/lead-details', router: leadDetailsRoutes, middleware: [apiRateLimit] },
  { path: '/api/leads', router: leadsRoutes, middleware: [apiRateLimit] },
  { path: '/api/export', router: exportRoutes, middleware: [apiRateLimit] },
  { path: '/api/branding', router: brandingRoutes, middleware: [apiRateLimit] },
  { path: '/api/multi-agent-campaigns', router: multiAgentCampaignsRoutes, middleware: [apiRateLimit] },
  { path: '/api/handover', router: handoverRoutes, middleware: [apiRateLimit] },
  { path: '/api/supermemory', router: supermemoryRoutes, middleware: [apiRateLimit] },
  { path: '/api/cache', router: cacheRoutes, middleware: [apiRateLimit] },
  { path: '/api/conversations', router: conversationsRoutes, middleware: [apiRateLimit] },
  { path: '/api/campaign-execution', router: campaignExecutionRoutes, middleware: [apiRateLimit] },
  { path: '/api/email-monitor', router: emailMonitorRoutes, middleware: [apiRateLimit] },
  { path: '/api/handover-api', router: handoverApiRoutes, middleware: [apiRateLimit] },
  { path: '/api/email-scheduling', router: emailSchedulingRoutes, middleware: [apiRateLimit] },
  
  // System routes
  { path: '/api/system', router: systemHealthRoutes },
  { path: '/api/test', router: testRoutes, public: true },
];

/**
 * Register all application routes with improved error handling
 */
export function registerRoutes(app: Express) {
  // Health check endpoints
  app.get('/health', healthHandler.check);
  app.get('/api/health', healthHandler.check);
  
  // Apply improved client validation to all API routes
  app.use('/api', clientValidation);
  
  // Register all routes
  let registeredCount = 0;
  let failedCount = 0;
  
  routes.forEach(({ path, router, public: isPublic, middleware = [] }) => {
    try {
      if (isPublic) {
        app.use(path, router);
      } else {
        app.use(path, ...middleware, router);
      }
      registeredCount++;
      console.log(`✅ Registered route: ${path}`);
    } catch (error) {
      failedCount++;
      console.error(`❌ Failed to register route ${path}:`, error);
    }
  });
  
  console.log(`\n📊 Route Registration Summary:`);
  console.log(`   ✅ Successfully registered: ${registeredCount} routes`);
  console.log(`   ❌ Failed to register: ${failedCount} routes`);
  console.log(`   🗄️  Database status: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured (using mock data)'}\n`);
}