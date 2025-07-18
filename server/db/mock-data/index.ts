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

  findAll: async () => mockUsers.users,
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
      return {
        user,
        accessToken: 'mock-jwt-access-token',
        refreshToken: 'mock-jwt-refresh-token',
        expiresIn: 3600
      };
    }
    return null;
  },
  refreshToken: async (refreshToken: string) => {
    if (refreshToken === 'mock-jwt-refresh-token') {
      return {
        accessToken: 'mock-jwt-access-token-refreshed',
        refreshToken: 'mock-jwt-refresh-token-new',
        expiresIn: 3600
      };
    }
    throw new Error('Invalid refresh token');
  },
  logout: async (refreshToken: string) => {
    // Mock logout - just return success
    return true;
  },
  logoutAllSessions: async (userId: string) => {
    // Mock logout all sessions - just return success
    return true;
  },
  toggleActive: async (id: string) => {
    const user = mockUsers.users.find(u => u.id === id);
    if (user) {
      user.active = !user.active;
      user.updatedAt = new Date();
      return user;
    }
    return null;
  },
  cleanupExpiredSessions: async () => {
    // Mock cleanup - return a random number
    return Math.floor(Math.random() * 10);
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
      campaignId: 'campaign-1',
      qualificationScore: 0,
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
      campaignId: 'campaign-1',
      qualificationScore: 75,
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
    if (filters?.campaignId) {
      results = results.filter(l => l.campaignId === filters.campaignId);
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
  updateQualificationScore: async (id: string, score: number) => {
    const lead = mockLeads.leads.find(l => l.id === id);
    if (lead) {
      lead.qualificationScore = score;
      lead.updatedAt = new Date();
      return lead;
    }
    return undefined;
  },
  findWithRelatedData: async (leadId: string) => {
    const lead = mockLeads.leads.find(l => l.id === leadId);
    if (!lead) return null;
    
    return {
      ...lead,
      conversations: mockConversations.findByLeadId(leadId),
      communications: mockCommunications.findByLeadId(leadId),
      decisions: mockAgentDecisions.findByLeadId(leadId)
    };
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
  findActive: () => mockCampaigns.campaigns.filter(c => c.active),
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
  },
  toggleActive: async (id: string) => {
    const campaign = mockCampaigns.campaigns.find(c => c.id === id);
    if (campaign) {
      campaign.active = !campaign.active;
      campaign.updatedAt = new Date();
      return campaign;
    }
    return null;
  },
  getCampaignStats: async (campaignId: string) => ({
    totalLeads: mockLeads.leads.filter(l => l.campaignId === campaignId).length,
    qualifiedLeads: mockLeads.leads.filter(l => l.campaignId === campaignId && l.status === 'qualified').length,
    convertedLeads: mockLeads.leads.filter(l => l.campaignId === campaignId && l.status === 'converted').length,
    totalCommunications: mockCommunications.communications.filter(c => c.campaignId === campaignId).length
  }),
  getDefaultCampaign: async () => mockCampaigns.campaigns[0],
  clone: async (id: string, name: string) => {
    const original = mockCampaigns.campaigns.find(c => c.id === id);
    if (original) {
      const cloned = {
        ...original,
        id: uuidv4(),
        name,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockCampaigns.campaigns.push(cloned);
      return cloned;
    }
    return undefined;
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
  findByName: (name: string) => mockAgentConfigurations.agents.find(a => a.name === name),
  getActiveByType: (type: string) => mockAgentConfigurations.agents.find(a => a.type === type && a.active),
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
  },
  toggleActive: async (id: string) => {
    const agent = mockAgentConfigurations.agents.find(a => a.id === id);
    if (agent) {
      agent.active = !agent.active;
      agent.updatedAt = new Date();
      return agent;
    }
    return null;
  },
  clone: async (id: string, name: string) => {
    const original = mockAgentConfigurations.agents.find(a => a.id === id);
    if (original) {
      const cloned = {
        ...original,
        id: uuidv4(),
        name,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockAgentConfigurations.agents.push(cloned);
      return cloned;
    }
    return undefined;
  },
  getTopPerforming: async (metric: string, limit: number) =>
    mockAgentConfigurations.agents.slice(0, limit).map(a => ({
      ...a,
      performance: { decisions: Math.floor(Math.random() * 100), accuracy: Math.random() }
    })),
  createDefaultAgents: async () => {
    const defaults = [
      {
        id: uuidv4(),
        clientId: 'ccl-default',
        name: 'Default Overlord',
        type: 'overlord',
        role: 'Lead Qualification',
        endGoal: 'Qualify leads',
        instructions: { steps: ['Analyze', 'Qualify', 'Route'] },
        personality: 'Professional',
        tone: 'Helpful',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    mockAgentConfigurations.agents.push(...defaults);
    return defaults;
  },
  updatePerformance: async (id: string, performance: any) => {
    const agent = mockAgentConfigurations.agents.find(a => a.id === id);
    return agent ? { ...agent, performance } : undefined;
  },
  generatePromptFromConfig: (agent: any, context: any) => {
    return `You are ${agent.name}, a ${agent.type} agent. Your role is ${agent.role}. Context: ${JSON.stringify(context)}`;
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
  findActiveByLeadAndChannel: (leadId: string, channel: string) =>
    mockConversations.conversations.find(c => c.leadId === leadId && c.channel === channel && c.status === 'active'),
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
  updateStatus: async (id: string, status: string) => {
    const conversation = mockConversations.conversations.find(c => c.id === id);
    if (conversation) {
      conversation.status = status;
      conversation.updatedAt = new Date();
      return conversation;
    }
    return undefined;
  },
  addMessage: async (id: string, message: any) => {
    const conversation = mockConversations.conversations.find(c => c.id === id);
    if (conversation) {
      if (!conversation.messages) conversation.messages = [];
      conversation.messages.push({ ...message, timestamp: new Date() });
      conversation.updatedAt = new Date();
      return conversation;
    }
    return undefined;
  },
  getActiveConversationsByChannel: () => {
    const counts: Record<string, number> = {};
    mockConversations.conversations.forEach(c => {
      if (c.status === 'active') {
        counts[c.channel] = (counts[c.channel] || 0) + 1;
      }
    });
    return counts;
  },
  updateWithHandoverAnalysis: async (id: string, analysis: any) => {
    const conversation = mockConversations.conversations.find(c => c.id === id);
    if (conversation) {
      conversation.handoverAnalysis = analysis;
      conversation.updatedAt = new Date();
      return conversation;
    }
    return undefined;
  },
  updateCrossChannelContext: async (id: string, context: any) => {
    const conversation = mockConversations.conversations.find(c => c.id === id);
    if (conversation) {
      conversation.crossChannelContext = context;
      conversation.updatedAt = new Date();
      return conversation;
    }
    return undefined;
  },
  updateQualificationScore: async (id: string, score: number) => {
    const conversation = mockConversations.conversations.find(c => c.id === id);
    if (conversation) {
      conversation.qualificationScore = score;
      conversation.updatedAt = new Date();
      return conversation;
    }
    return undefined;
  }
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
  findByLeadId: (leadId: string) => mockCommunications.communications.filter(c => c.leadId === leadId),
  findByConversationId: (conversationId: string) => mockCommunications.communications.filter(c => c.conversationId === conversationId),
  findByExternalId: (externalId: string) => mockCommunications.communications.find(c => c.externalId === externalId),
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
  update: (id: string, data: any) => {
    const index = mockCommunications.communications.findIndex(c => c.id === id);
    if (index >= 0) {
      mockCommunications.communications[index] = { ...mockCommunications.communications[index], ...data, updatedAt: new Date() };
      return mockCommunications.communications[index];
    }
    return undefined;
  },
  updateStatus: async (id: string, status: string) => {
    const communication = mockCommunications.communications.find(c => c.id === id);
    if (communication) {
      communication.status = status;
      communication.updatedAt = new Date();
      return communication;
    }
    return undefined;
  },
  getRecent: async (limit: number = 10) => {
    return mockCommunications.communications
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  },
  getPendingCommunications: async () =>
    mockCommunications.communications.filter(c => c.status === 'pending'),
  getStats: async () => ({
    total: mockCommunications.communications.length,
    byChannel: mockCommunications.communications.reduce((acc: any, comm) => {
      acc[comm.channel] = (acc[comm.channel] || 0) + 1;
      return acc;
    }, {}),
    byStatus: mockCommunications.communications.reduce((acc: any, comm) => {
      acc[comm.status] = (acc[comm.status] || 0) + 1;
      return acc;
    }, {})
  })
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
  create: (data: any) => {
    const client = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockClients.clients.push(client);
    return client;
  },
  update: (id: string, data: any) => {
    const index = mockClients.clients.findIndex(c => c.id === id);
    if (index >= 0) {
      mockClients.clients[index] = { ...mockClients.clients[index], ...data, updatedAt: new Date() };
      return mockClients.clients[index];
    }
    return undefined;
  },
  updateBranding: async (id: string, branding: any) => {
    const client = mockClients.clients.find(c => c.id === id);
    if (client) {
      if (!client.settings) client.settings = {};
      client.settings.branding = { ...client.settings.branding, ...branding };
      client.updatedAt = new Date();
      return client;
    }
    return undefined;
  }
};

// Mock Agent Decisions
export const mockAgentDecisions = {
  decisions: [],

  findAll: (filters?: any) => mockAgentDecisions.decisions,
  findById: (id: string) => mockAgentDecisions.decisions.find((d: any) => d.id === id),
  findByLeadId: (leadId: string) => mockAgentDecisions.decisions.filter((d: any) => d.leadId === leadId),
  findByAgentType: (agentType: string) => mockAgentDecisions.decisions.filter((d: any) => d.agentType === agentType),
  getDecisionTimeline: async (leadId: string) =>
    mockAgentDecisions.decisions
      .filter((d: any) => d.leadId === leadId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  getDecisionStats: async () => ({
    total: mockAgentDecisions.decisions.length,
    byType: mockAgentDecisions.decisions.reduce((acc: any, d: any) => {
      acc[d.agentType] = (acc[d.agentType] || 0) + 1;
      return acc;
    }, {})
  }),
  getRecentDecisions: async (limit: number = 20) =>
    mockAgentDecisions.decisions
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit),
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
  trackEvent: async (event: any) => {
    console.log('Mock analytics event:', event);
    return { id: `event-${Date.now()}`, success: true };
  },
  getLeadStats: async () => ({
    total: mockLeads.leads.length,
    new: mockLeads.leads.filter(l => l.status === 'new').length,
    qualified: mockLeads.leads.filter(l => l.status === 'qualified').length,
    converted: mockLeads.leads.filter(l => l.status === 'converted').length
  }),
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
  }),
  getDashboardStats: async (startDate?: Date, endDate?: Date) => ({
    totalLeads: mockLeads.leads.length,
    newLeads: mockLeads.leads.filter(l => l.status === 'new').length,
    qualifiedLeads: mockLeads.leads.filter(l => l.status === 'qualified').length,
    convertedLeads: mockLeads.leads.filter(l => l.status === 'converted').length,
    totalConversations: mockConversations.conversations.length,
    activeConversations: mockConversations.conversations.filter(c => c.status === 'active').length,
    totalCommunications: mockCommunications.communications.length,
    totalCampaigns: mockCampaigns.campaigns.length,
    activeCampaigns: mockCampaigns.campaigns.filter(c => c.active).length
  }),
  getLeadAnalytics: async (filters: any) => ({
    total: mockLeads.leads.length,
    byStatus: mockLeads.countByStatus(),
    recent: mockLeads.getRecentLeads(10)
  }),
  getCampaignPerformance: async (campaignId?: string) => {
    if (campaignId) {
      const campaign = mockCampaigns.findById(campaignId);
      return campaign ? { ...campaign, performance: { leads: 10, conversions: 2 } } : null;
    }
    return mockCampaigns.campaigns.map(c => ({ ...c, performance: { leads: 10, conversions: 2 } }));
  },
  getAgentPerformance: async (startDate?: Date, endDate?: Date) =>
    mockAgentConfigurations.agents.map(a => ({ ...a, performance: { decisions: 5, accuracy: 0.8 } })),
  getCommunicationAnalytics: async (filters: any) => ({
    total: mockCommunications.communications.length,
    byChannel: mockCommunications.communications.reduce((acc: any, comm) => {
      acc[comm.channel] = (acc[comm.channel] || 0) + 1;
      return acc;
    }, {})
  }),
  getFunnelAnalysis: async (startDate?: Date, endDate?: Date) => ({
    stages: ['lead', 'qualified', 'converted'],
    counts: [mockLeads.leads.length, 5, 2]
  }),
  getEventMetrics: async (eventType: string, filters: any) => ({
    eventType,
    count: Math.floor(Math.random() * 100),
    data: []
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
  findAll: (filters?: any) => mockAuditLog.logs,
  findByUser: (userId: string, options?: { limit?: number }) => {
    const limit = options?.limit || 100;
    return mockAuditLog.logs
      .filter(log => log.userId === userId)
      .slice(0, limit);
  },
  getUserActivity: (userId: string, days: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return mockAuditLog.logs
      .filter(log =>
        log.userId === userId &&
        new Date(log.createdAt) >= cutoffDate
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
};