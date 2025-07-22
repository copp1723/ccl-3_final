// Database client and connection
export { db, closeConnection, type DbTransaction } from './client';

// Schema exports
export * from './schema';

// Repository exports - using wrapped repositories with fallback support
export { 
  leadsRepository,
  leadsRepository as LeadsRepository,
  conversationsRepository,
  conversationsRepository as ConversationsRepository,
  agentDecisionsRepository,
  agentDecisionsRepository as AgentDecisionsRepository,
  campaignsRepository,
  campaignsRepository as CampaignsRepository,
  communicationsRepository,
  communicationsRepository as CommunicationsRepository,
  emailTemplatesRepository,
  emailTemplatesRepository as EmailTemplatesRepository,
  agentConfigurationsRepository,
  agentConfigurationsRepository as AgentConfigurationsRepository,
  usersRepository,
  usersRepository as UsersRepository,
  auditLogRepository,
  auditLogRepository as AuditLogRepository,
  analyticsRepository,
  analyticsRepository as AnalyticsRepository,
  clientsRepository,
  clientsRepository as ClientsRepository
} from './wrapped-repositories';
