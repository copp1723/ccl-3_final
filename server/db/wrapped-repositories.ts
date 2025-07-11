/**
 * Wrapped repository instances that automatically fallback to mock data
 * when database is not available
 */

import { createWrappedRepository } from './repository-wrapper';
import {
  mockUsers,
  mockLeads,
  mockCampaigns,
  mockAgentConfigurations,
  mockConversations,
  mockCommunications,
  mockEmailTemplates,
  mockClients,
  mockAgentDecisions,
  mockAnalytics,
  mockAuditLog
} from './mock-data';

// Cache for real repositories
const repositoryCache = new Map<string, any>();

/**
 * Get or create a wrapped repository
 */
function getWrappedRepository(name: string, mockData: any): any {
  const cacheKey = `wrapped_${name}`;
  
  if (repositoryCache.has(cacheKey)) {
    return repositoryCache.get(cacheKey);
  }

  // Try to load the real repository module
  let realRepository = {};
  try {
    // Attempt synchronous require for initial load
    const modulePath = `./${name}-repository`;
    const module = require(modulePath);
    realRepository = module[`${name}Repository`] || {};
  } catch (error) {
    console.warn(`Repository ${name} not available, using mock data only`);
  }

  const wrapped = createWrappedRepository(name, realRepository, mockData);
  repositoryCache.set(cacheKey, wrapped);
  
  return wrapped;
}

// Export wrapped repositories
export const usersRepository = getWrappedRepository('users', mockUsers);
export const leadsRepository = getWrappedRepository('leads', mockLeads);
export const campaignsRepository = getWrappedRepository('campaigns', mockCampaigns);
export const agentConfigurationsRepository = getWrappedRepository('agent-configurations', mockAgentConfigurations);
export const conversationsRepository = getWrappedRepository('conversations', mockConversations);
export const communicationsRepository = getWrappedRepository('communications', mockCommunications);
export const emailTemplatesRepository = getWrappedRepository('email-templates', mockEmailTemplates);
export const clientsRepository = getWrappedRepository('clients', mockClients);
export const agentDecisionsRepository = getWrappedRepository('agent-decisions', mockAgentDecisions);
export const analyticsRepository = getWrappedRepository('analytics', mockAnalytics);
export const auditLogRepository = getWrappedRepository('audit-log', mockAuditLog);