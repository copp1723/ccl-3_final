/**
 * Wrapped repository instances for ESM compatibility.
 * Static imports are used to ensure named exports work in ESM environments.
 */

import { UsersRepository } from './users-repository';
import { LeadsRepository } from './leads-repository';
import { CampaignsRepository } from './campaigns-repository';
import { AgentConfigurationsRepository } from './agent-configurations-repository';
import { ConversationsRepository } from './conversations-repository';
import { CommunicationsRepository } from './communications-repository';
import { EmailTemplatesRepository } from './email-templates-repository';
import { AgentDecisionsRepository } from './agent-decisions-repository';
import { AnalyticsRepository } from './analytics-repository';
import { AuditLogRepository } from './audit-log-repository';
import { ClientsRepository } from './clients-repository';

// Export repositories as named exports for ESM compatibility
export const usersRepository = UsersRepository;
export const leadsRepository = LeadsRepository;
export const campaignsRepository = CampaignsRepository;
export const agentConfigurationsRepository = AgentConfigurationsRepository;
export const conversationsRepository = ConversationsRepository;
export const communicationsRepository = CommunicationsRepository;
export const emailTemplatesRepository = EmailTemplatesRepository;
export const agentDecisionsRepository = AgentDecisionsRepository;
export const analyticsRepository = AnalyticsRepository;
export const auditLogRepository = AuditLogRepository;
export const clientsRepository = ClientsRepository;