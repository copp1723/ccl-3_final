/**
 * Mock data providers for all repositories
 * Used when database is not available
 */

import { v4 as uuidv4 } from 'uuid';

// Mock Users
export const mockUsers = {
  users: [
    {
      id: 'user-1',
      email: 'admin@completecarloans.com',
      name: 'Admin User',
      role: 'admin',
      active: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    }
  ],

  findAll: () => mockUsers.users,
  findById: (id: string) => mockUsers.users.find(u => u.id === id),
  findByEmail: (email: string) => mockUsers.users.find(u => u.email === email),
  create: (data: any) => {
    const user = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockUsers.users.push(user);
    return user;
  },
  update: (id: string, data: any) => {
    const index = mockUsers.users.findIndex(u => u.id === id);
    if (index >= 0) {
      mockUsers.users[index] = { ...mockUsers.users[index], ...data, updatedAt: new Date() };
      return mockUsers.users[index];
    }
    return undefined;
  },
  login: async (email: string, password: string) => {
    const user = mockUsers.users.find(u => u.email === email);
    if (user && password === 'password123') { // Mock password check
      return { user, token: 'mock-jwt-token' };
    }
    return null;
  }
};

// Mock Leads
export const mockLeads = {
  leads: [
    {
      id: 'lead-1',
      clientId: 'ccl-default',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      status: 'new',
      source: 'website',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date()
    },
    {
      id: 'lead-2',
      clientId: 'ccl-default',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+0987654321',
      status: 'qualified',
      source: 'campaign',
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date()
    }
  ],

  findAll: (filters?: any) => {
    let results = [...mockLeads.leads];
    if (filters?.clientId) {
      results = results.filter(l => l.clientId === filters.clientId);
    }
    if (filters?.status) {
      results = results.filter(l => l.status === filters.status);
    }
    return results;
  },
  findById: (id: string) => mockLeads.leads.find(l => l.id === id),
  create: (data: any) => {
    const lead = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockLeads.leads.push(lead);
    return lead;
  },
  update: (id: string, data: any) => {
    const index = mockLeads.leads.findIndex(l => l.id === id);
    if (index >= 0) {
      mockLeads.leads[index] = { ...mockLeads.leads[index], ...data, updatedAt: new Date() };
      return mockLeads.leads[index];
    }
    return undefined;
  },
  getStats: () => ({
    total: mockLeads.leads.length,
    new: mockLeads.leads.filter(l => l.status === 'new').length,
    qualified: mockLeads.leads.filter(l => l.status === 'qualified').length,
    converted: mockLeads.leads.filter(l => l.status === 'converted').length
  }),
  countByStatus: () => {
    const counts: Record<string, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      converted: 0,
      dead: 0
    };
    mockLeads.leads.forEach(lead => {
      if (lead.status && counts[lead.status] !== undefined) {
        counts[lead.status]++;
      }
    });
    return counts;
  },
  getRecentLeads: (limit: number = 10) => {
    return mockLeads.leads
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }
};

// Mock Campaigns
export const mockCampaigns = {
  campaigns: [
    {
      id: 'campaign-1',
      clientId: 'ccl-default',
      name: 'Summer Auto Loans',
      type: 'email',
      status: 'active',
      settings: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    }
  ],

  findAll: (filters?: any) => {
    let results = [...mockCampaigns.campaigns];
    if (filters?.clientId) {
      results = results.filter(c => c.clientId === filters.clientId);
    }
    return results;
  },
  findById: (id: string) => mockCampaigns.campaigns.find(c => c.id === id),
  findByName: (name: string) => mockCampaigns.campaigns.find(c => c.name === name),
  create: (data: any) => {
    const campaign = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockCampaigns.campaigns.push(campaign);
    return campaign;
  },
  update: (id: string, data: any) => {
    const index = mockCampaigns.campaigns.findIndex(c => c.id === id);
    if (index >= 0) {
      mockCampaigns.campaigns[index] = { ...mockCampaigns.campaigns[index], ...data, updatedAt: new Date() };
      return mockCampaigns.campaigns[index];
    }
    return undefined;
  },
  delete: (id: string) => {
    const index = mockCampaigns.campaigns.findIndex(c => c.id === id);
    if (index >= 0) {
      mockCampaigns.campaigns.splice(index, 1);
      return true;
    }
    return false;
  }
};

// Mock Agent Configurations
export const mockAgentConfigurations = {
  agents: [
    {
      id: 'agent-1',
      clientId: 'ccl-default',
      name: 'Lead Qualifier',
      type: 'overlord',
      role: 'Lead Qualification',
      endGoal: 'Qualify leads for auto loans',
      instructions: { steps: ['Analyze lead data', 'Check eligibility', 'Route to appropriate channel'] },
      personality: 'Professional',
      tone: 'Helpful',
      active: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    },
    {
      id: 'agent-2',
      clientId: 'ccl-default',
      name: 'Email Assistant',
      type: 'email',
      role: 'Email Communication',
      endGoal: 'Engage leads via email',
      instructions: { templates: ['welcome', 'follow-up'] },
      personality: 'Friendly',
      tone: 'Conversational',
      active: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    }
  ],

  findAll: (filters?: any) => {
    let results = [...mockAgentConfigurations.agents];
    if (filters?.clientId) {
      results = results.filter(a => a.clientId === filters.clientId);
    }
    if (filters?.type) {
      results = results.filter(a => a.type === filters.type);
    }
    if (filters?.active !== undefined) {
      results = results.filter(a => a.active === filters.active);
    }
    return results;
  },
  findById: (id: string) => mockAgentConfigurations.agents.find(a => a.id === id),
  findByType: (type: string) => mockAgentConfigurations.agents.filter(a => a.type === type),
  create: (data: any) => {
    const agent = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockAgentConfigurations.agents.push(agent);
    return agent;
  },
  update: (id: string, data: any) => {
    const index = mockAgentConfigurations.agents.findIndex(a => a.id === id);
    if (index >= 0) {
      mockAgentConfigurations.agents[index] = { ...mockAgentConfigurations.agents[index], ...data, updatedAt: new Date() };
      return mockAgentConfigurations.agents[index];
    }
    return undefined;
  },
  delete: (id: string) => {
    const index = mockAgentConfigurations.agents.findIndex(a => a.id === id);
    if (index >= 0) {
      mockAgentConfigurations.agents.splice(index, 1);
      return true;
    }
    return false;
  }
};

// Mock Conversations
export const mockConversations = {
  conversations: [
    {
      id: 'conv-1',
      leadId: 'lead-1',
      channel: 'email',
      status: 'active',
      metadata: {},
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date()
    }
  ],

  findAll: (filters?: any) => {
    let results = [...mockConversations.conversations];
    if (filters?.leadId) {
      results = results.filter(c => c.leadId === filters.leadId);
    }
    if (filters?.channel) {
      results = results.filter(c => c.channel === filters.channel);
    }
    return results;
  },
  findById: (id: string) => mockConversations.conversations.find(c => c.id === id),
  findByLeadId: (leadId: string) => mockConversations.conversations.filter(c => c.leadId === leadId),
  create: (data: any) => {
    const conversation = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockConversations.conversations.push(conversation);
    return conversation;
  },
  update: (id: string, data: any) => {
    const index = mockConversations.conversations.findIndex(c => c.id === id);
    if (index >= 0) {
      mockConversations.conversations[index] = { ...mockConversations.conversations[index], ...data, updatedAt: new Date() };
      return mockConversations.conversations[index];
    }
    return undefined;
  },
  getActiveConversationsByChannel: (channel: string) => 
    mockConversations.conversations.filter(c => c.channel === channel && c.status === 'active')
};

// Mock Communications
export const mockCommunications = {
  communications: [
    {
      id: 'comm-1',
      conversationId: 'conv-1',
      leadId: 'lead-1',
      direction: 'outbound',
      channel: 'email',
      content: 'Welcome to Complete Car Loans!',
      status: 'sent',
      metadata: {},
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date()
    }
  ],

  findAll: (filters?: any) => {
    let results = [...mockCommunications.communications];
    if (filters?.leadId) {
      results = results.filter(c => c.leadId === filters.leadId);
    }
    if (filters?.conversationId) {
      results = results.filter(c => c.conversationId === filters.conversationId);
    }
    return results;
  },
  findById: (id: string) => mockCommunications.communications.find(c => c.id === id),
  create: (data: any) => {
    const communication = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockCommunications.communications.push(communication);
    return communication;
  },
  getRecent: async (limit: number = 10) => {
    return mockCommunications.communications
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }
};

// Mock Email Templates
export const mockEmailTemplates = {
  templates: [
    {
      id: 'template-1',
      clientId: 'ccl-default',
      name: 'Welcome Email',
      subject: 'Welcome to Complete Car Loans',
      content: '<p>Welcome! We\'re excited to help you find the perfect auto loan.</p>',
      category: 'onboarding',
      active: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    }
  ],

  findAll: (filters?: any) => {
    let results = [...mockEmailTemplates.templates];
    if (filters?.clientId) {
      results = results.filter(t => t.clientId === filters.clientId);
    }
    if (filters?.category) {
      results = results.filter(t => t.category === filters.category);
    }
    return results;
  },
  findById: (id: string) => mockEmailTemplates.templates.find(t => t.id === id),
  create: (data: any) => {
    const template = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockEmailTemplates.templates.push(template);
    return template;
  },
  update: (id: string, data: any) => {
    const index = mockEmailTemplates.templates.findIndex(t => t.id === id);
    if (index >= 0) {
      mockEmailTemplates.templates[index] = { ...mockEmailTemplates.templates[index], ...data, updatedAt: new Date() };
      return mockEmailTemplates.templates[index];
    }
    return undefined;
  },
  delete: (id: string) => {
    const index = mockEmailTemplates.templates.findIndex(t => t.id === id);
    if (index >= 0) {
      mockEmailTemplates.templates.splice(index, 1);
      return true;
    }
    return false;
  },
  findByName: (name: string) => mockEmailTemplates.templates.find(t => t.name === name),
  extractVariables: (content: string) => {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  },
  toggleActive: async (id: string) => {
    const template = mockEmailTemplates.templates.find(t => t.id === id);
    if (template) {
      template.active = !template.active;
      template.updatedAt = new Date();
      return template;
    }
    return undefined;
  },
  clone: async (id: string, newName: string) => {
    const original = mockEmailTemplates.templates.find(t => t.id === id);
    if (original) {
      const cloned = {
        ...original,
        id: uuidv4(),
        name: newName,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockEmailTemplates.templates.push(cloned);
      return cloned;
    }
    return undefined;
  },
  replaceVariables: (text: string, variables: Record<string, string>) => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  },
  getTopPerforming: async (metric: string, limit: number) => {
    // Mock implementation - return templates with fake performance data
    return mockEmailTemplates.templates.slice(0, limit).map(t => ({
      ...t,
      performance: {
        sent: Math.floor(Math.random() * 1000),
        opened: Math.floor(Math.random() * 800),
        clicked: Math.floor(Math.random() * 500),
        replied: Math.floor(Math.random() * 100),
        openRate: Math.random() * 0.8,
        clickRate: Math.random() * 0.5,
        replyRate: Math.random() * 0.1
      }
    }));
  },
  updatePerformance: async (id: string, metric: string) => {
    const template = mockEmailTemplates.templates.find(t => t.id === id);
    if (template) {
      // Mock performance update
      return { ...template, performance: { [metric]: 1 } };
    }
    return undefined;
  },
  createDefaultTemplates: async () => {
    const defaults = [
      {
        id: uuidv4(),
        clientId: 'ccl-default',
        name: 'Initial Contact',
        subject: 'Your Auto Loan Application',
        content: '<p>Thank you for your interest in an auto loan from Complete Car Loans!</p>',
        category: 'initial_contact',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        clientId: 'ccl-default',
        name: 'Follow Up',
        subject: 'Following Up on Your Auto Loan Application',
        content: '<p>We wanted to follow up on your auto loan application.</p>',
        category: 'follow_up',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    mockEmailTemplates.templates.push(...defaults);
    return defaults;
  }
};

// Mock Clients
export const mockClients = {
  clients: [
    {
      id: 'ccl-default',
      name: 'Complete Car Loans',
      domain: 'completecarloans.com',
      settings: {
        branding: {
          companyName: 'Complete Car Loans',
          primaryColor: '#1e40af',
          secondaryColor: '#64748b',
          logo: '/logo.png',
          emailFromName: 'Complete Car Loans Team',
          supportEmail: 'support@completecarloans.com'
        }
      },
      active: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    }
  ],

  findAll: () => mockClients.clients,
  list: async () => mockClients.clients,
  findById: (id: string) => mockClients.clients.find(c => c.id === id),
  findByDomain: (domain: string) => mockClients.clients.find(c => c.domain === domain),
  update: (id: string, data: any) => {
    const index = mockClients.clients.findIndex(c => c.id === id);
    if (index >= 0) {
      mockClients.clients[index] = { ...mockClients.clients[index], ...data, updatedAt: new Date() };
      return mockClients.clients[index];
    }
    return undefined;
  }
};

// Mock Agent Decisions
export const mockAgentDecisions = {
  decisions: [],

  findAll: (filters?: any) => mockAgentDecisions.decisions,
  findById: (id: string) => mockAgentDecisions.decisions.find((d: any) => d.id === id),
  create: (data: any) => {
    const decision = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockAgentDecisions.decisions.push(decision);
    return decision;
  }
};

// Mock Analytics
export const mockAnalytics = {
  track: async (event: any) => {
    console.log('Mock analytics event:', event);
    return { success: true };
  },
  getDashboardMetrics: async () => ({
    leads: {
      total: mockLeads.leads.length,
      new: mockLeads.leads.filter(l => l.status === 'new').length,
      qualified: mockLeads.leads.filter(l => l.status === 'qualified').length
    },
    conversations: {
      total: mockConversations.conversations.length,
      active: mockConversations.conversations.filter(c => c.status === 'active').length
    },
    agents: {
      total: mockAgentConfigurations.agents.length,
      active: mockAgentConfigurations.agents.filter(a => a.active).length
    }
  })
};

// Mock Audit Log
export const mockAuditLog = {
  logs: [],

  create: (data: any) => {
    const log = {
      id: uuidv4(),
      ...data,
      createdAt: new Date()
    };
    mockAuditLog.logs.push(log);
    return log;
  },
  findAll: (filters?: any) => mockAuditLog.logs
};