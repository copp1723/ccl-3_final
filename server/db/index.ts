// Database client and connection
export { db, closeConnection, type DbTransaction } from './client';

// Schema exports
export * from './schema';

// Repository exports
export { LeadsRepository } from './leads-repository';
export { ConversationsRepository } from './conversations-repository';
export { AgentDecisionsRepository } from './agent-decisions-repository';
export { CampaignsRepository } from './campaigns-repository';
export { CommunicationsRepository } from './communications-repository';
export { EmailTemplatesRepository } from './email-templates-repository';
export { AgentConfigurationsRepository } from './agent-configurations-repository';
export { UsersRepository } from './users-repository';
export { AuditLogRepository } from './audit-log-repository';
export { AnalyticsRepository } from './analytics-repository';
