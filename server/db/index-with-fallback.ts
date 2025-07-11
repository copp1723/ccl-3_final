// server/db/index-with-fallback.ts
// Database exports with automatic fallback to mock repositories

import { 
  mockLeadsRepository,
  mockConversationsRepository,
  mockAgentDecisionsRepository,
  mockCommunicationsRepository,
  mockAgentConfigurationsRepository,
  mockBrandingRepository,
  mockCampaignsRepository,
  closeConnection as mockCloseConnection
} from './mock-repositories';

// Try to import real repositories
let realRepositories: any = null;
let useRealDb = false;

try {
  if (process.env.DATABASE_URL) {
    realRepositories = await import('./index');
    useRealDb = true;
    console.log('✅ Using real database');
  } else {
    console.log('⚠️  No DATABASE_URL configured, using mock data');
  }
} catch (error) {
  console.log('⚠️  Database connection failed, using mock data:', error.message);
}

// Export repositories with fallback
export const LeadsRepository = useRealDb ? realRepositories.LeadsRepository : mockLeadsRepository;
export const ConversationsRepository = useRealDb ? realRepositories.ConversationsRepository : mockConversationsRepository;
export const AgentDecisionsRepository = useRealDb ? realRepositories.AgentDecisionsRepository : mockAgentDecisionsRepository;
export const CommunicationsRepository = useRealDb ? realRepositories.CommunicationsRepository : mockCommunicationsRepository;
export const AgentConfigurationsRepository = useRealDb ? realRepositories.AgentConfigurationsRepository : mockAgentConfigurationsRepository;
export const CampaignsRepository = useRealDb ? realRepositories.CampaignsRepository : mockCampaignsRepository;

// For repositories not in mock, return mock versions
export const EmailTemplatesRepository = useRealDb ? realRepositories.EmailTemplatesRepository : {
  findAll: async () => [],
  create: async (data: any) => ({ id: `template-${Date.now()}`, ...data })
};

export const UsersRepository = useRealDb ? realRepositories.UsersRepository : {
  findByEmail: async () => null,
  create: async (data: any) => ({ id: `user-${Date.now()}`, ...data })
};

export const AuditLogRepository = useRealDb ? realRepositories.AuditLogRepository : {
  create: async () => null
};

export const AnalyticsRepository = useRealDb ? realRepositories.AnalyticsRepository : {
  getLeadStats: async () => ({ total: 0, new: 0, qualified: 0, converted: 0 })
};

// Branding repository (not in original exports)
export const BrandingRepository = mockBrandingRepository;

// Close connection function
export const closeConnection = useRealDb ? realRepositories.closeConnection : mockCloseConnection;

// Re-export schema if available
export * from './schema';
