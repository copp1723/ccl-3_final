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
import { mockUsers } from './mock-data';

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
  findAll: async () => mockUsers.findAll(),
  findByEmail: async (email: string) => mockUsers.findByEmail(email),
  findByUsername: async (username: string) => mockUsers.findByEmail(username), // Using email as username
  findById: async (id: string) => mockUsers.findById(id),
  create: async (data: any) => mockUsers.create(data),
  update: async (id: string, data: any) => mockUsers.update(id, data),
  login: async (username: string, password: string) => mockUsers.login(username, password),
  logout: async () => null,
  logoutAllSessions: async () => null,
  refreshToken: async () => null,
  createDefaultAdmin: async () => null
};

export const AuditLogRepository = useRealDb ? realRepositories.AuditLogRepository : {
  create: async () => ({ id: `audit-${Date.now()}` })
};

export const AnalyticsRepository = useRealDb ? realRepositories.AnalyticsRepository : {
  getLeadStats: async () => ({ total: 0, new: 0, qualified: 0, converted: 0 }),
  trackEvent: async () => ({ id: `event-${Date.now()}` })
};

// Branding repository (not in original exports)
export const BrandingRepository = mockBrandingRepository;

// Close connection function
export const closeConnection = useRealDb ? realRepositories.closeConnection : mockCloseConnection;

// Re-export schema if available
export * from './schema';
