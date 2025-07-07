import { vi } from "vitest";

// Storage mock factory
export const createStorageMock = () => ({
  // Leads
  createLead: vi.fn().mockResolvedValue({ id: "1", email: "test@example.com", status: "new" }),
  getLeads: vi.fn().mockResolvedValue([]),
  updateLead: vi.fn().mockResolvedValue(undefined),
  
  // Activities
  createActivity: vi.fn().mockResolvedValue({ id: "1", type: "test", description: "test" }),
  getActivities: vi.fn().mockResolvedValue([]),
  
  // Agents
  getAgents: vi.fn().mockResolvedValue([]),
  updateAgent: vi.fn().mockResolvedValue(undefined),
  
  // Visitors
  createVisitor: vi.fn().mockResolvedValue({ id: "1" }),
  updateVisitor: vi.fn().mockResolvedValue(undefined),
  getVisitorById: vi.fn().mockResolvedValue(null),
  getVisitor: vi.fn().mockResolvedValue(null),
  getVisitorByEmailHash: vi.fn().mockResolvedValue(null),
  createReturnToken: vi.fn().mockResolvedValue({ id: 1, returnToken: "test-token" }),
  
  // Email campaigns
  createEmailCampaign: vi.fn().mockResolvedValue({ id: 1 }),
  getEmailCampaignsByVisitor: vi.fn().mockResolvedValue([]),
  
  // Chat sessions
  getChatSessionsByVisitor: vi.fn().mockResolvedValue([]),
  getChatSessionBySessionId: vi.fn().mockResolvedValue(null),
  createChatSession: vi.fn().mockResolvedValue({ id: 1 }),
  updateChatSession: vi.fn().mockResolvedValue(undefined),
  
  // Agent activity
  createAgentActivity: vi.fn().mockResolvedValue({ id: 1 }),
  
  // Stats
  getStats: vi.fn().mockResolvedValue({ leads: 0, activities: 0, agents: 0, uptime: 0 }),
});

// Logger mock factory  
export const createLoggerMock = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// Standard test data
export const mockVisitor = {
  id: 1,
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0",
  phoneNumber: "+15551234567",
  email: "john.doe@example.com",
  emailHash: "hashed-email",
  metadata: {
    firstName: "John",
    lastName: "Doe",
    street: "123 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    income: 75000,
    employer: "Acme Corp",
    jobTitle: "Manager",
    creditScore: 720,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockAbandonmentEvent = {
  visitorId: "visitor-123",
  sessionId: "session-123",
  email: "john.doe@example.com",
  phoneNumber: "+15551234567",
  metadata: {
    currentStep: "income",
    completedFields: ["name", "email", "phone"],
    timeOnPage: 120,
    source: "google",
  },
  timestamp: new Date().toISOString(),
};

export const mockChatSession = {
  id: 1,
  sessionId: "session-123",
  visitorId: 1,
  messages: [],
  piiCollected: {},
  isActive: true,
  startedAt: new Date(),
  lastMessageAt: new Date(),
};

export const mockLead = {
  id: "1",
  email: "john.doe@example.com",
  phoneNumber: "+15551234567",
  status: "new" as const,
  leadData: mockVisitor.metadata,
  createdAt: new Date(),
  updatedAt: new Date(),
};