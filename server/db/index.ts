// Database client and connection
export { db, closeConnection, type DbTransaction } from './client';

// Schema exports
export * from './schema';

// Repository exports - using wrapped repositories with fallback support
export { 
  leadsRepository as LeadsRepository,
  conversationsRepository as ConversationsRepository,
  agentDecisionsRepository as AgentDecisionsRepository,
  campaignsRepository as CampaignsRepository,
  communicationsRepository as CommunicationsRepository,
  emailTemplatesRepository as EmailTemplatesRepository,
  agentConfigurationsRepository as AgentConfigurationsRepository,
  usersRepository as UsersRepository,
  auditLogRepository as AuditLogRepository,
  analyticsRepository as AnalyticsRepository
} from './wrapped-repositories';
