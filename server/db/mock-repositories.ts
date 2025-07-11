// server/db/mock-repositories.ts
// Mock repositories for when database is not available

export class MockLeadsRepository {
  private leads: any[] = [];
  
  async findAll(options: any = {}) {
    const limit = options.limit || 20;
    return this.leads.slice(0, limit);
  }
  
  async findById(id: string) {
    return this.leads.find(lead => lead.id === id);
  }
  
  async create(data: any) {
    const lead = {
      id: `lead-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.leads.push(lead);
    return lead;
  }
  
  async update(id: string, data: any) {
    const index = this.leads.findIndex(lead => lead.id === id);
    if (index >= 0) {
      this.leads[index] = { ...this.leads[index], ...data, updatedAt: new Date() };
      return this.leads[index];
    }
    return null;
  }
}

export class MockConversationsRepository {
  private conversations: any[] = [];
  
  async findAll(options: any = {}) {
    return this.conversations;
  }
  
  async create(data: any) {
    const conversation = {
      id: `conv-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.conversations.push(conversation);
    return conversation;
  }
}

export class MockAgentDecisionsRepository {
  private decisions: any[] = [];
  
  async create(leadId: string, agentType: string, decision: string, reasoning: string, metadata?: any) {
    const decisionRecord = {
      id: `decision-${Date.now()}`,
      leadId,
      agentType,
      decision,
      reasoning,
      metadata,
      createdAt: new Date()
    };
    this.decisions.push(decisionRecord);
    return decisionRecord;
  }
  
  async findByLeadId(leadId: string) {
    return this.decisions.filter(d => d.leadId === leadId);
  }
}

export class MockCommunicationsRepository {
  private communications: any[] = [];
  
  async create(data: any) {
    const communication = {
      id: `comm-${Date.now()}`,
      ...data,
      createdAt: new Date()
    };
    this.communications.push(communication);
    return communication;
  }
  
  async findByLeadId(leadId: string) {
    return this.communications.filter(c => c.leadId === leadId);
  }
}

export class MockAgentConfigurationsRepository {
  private configurations: any[] = [
    {
      id: 'default-email',
      name: 'Email Nurture Agent',
      type: 'email',
      active: true,
      config: {
        endGoal: 'Convert leads through personalized email sequences',
        personality: 'professional',
        domainExpertise: ['Sales', 'Customer Success']
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  async findAll(filters: any = {}) {
    let results = [...this.configurations];
    
    if (filters.type) {
      results = results.filter(c => c.type === filters.type);
    }
    
    if (filters.active !== undefined) {
      results = results.filter(c => c.active === filters.active);
    }
    
    return results;
  }
  
  async findById(id: string) {
    return this.configurations.find(c => c.id === id);
  }
  
  async create(data: any) {
    const config = {
      id: `agent-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.configurations.push(config);
    return config;
  }
  
  async update(id: string, data: any) {
    const index = this.configurations.findIndex(c => c.id === id);
    if (index >= 0) {
      this.configurations[index] = { 
        ...this.configurations[index], 
        ...data, 
        updatedAt: new Date() 
      };
      return this.configurations[index];
    }
    return null;
  }
}

export class MockBrandingRepository {
  private brandings: any[] = [
    {
      id: 'default',
      name: 'CCL Default',
      config: {
        companyName: 'Customer Connection Lab',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        logoUrl: '',
        emailFromName: 'CCL Team',
        supportEmail: 'support@ccl.com'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  async findAll() {
    return this.brandings;
  }
  
  async findById(id: string) {
    return this.brandings.find(b => b.id === id);
  }
  
  async create(data: any) {
    const branding = {
      id: `branding-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.brandings.push(branding);
    return branding;
  }
}

export class MockCampaignsRepository {
  private campaigns: any[] = [];
  
  async findAll() {
    return this.campaigns;
  }
  
  async create(data: any) {
    const campaign = {
      id: `campaign-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.campaigns.push(campaign);
    return campaign;
  }
}

// Export singleton instances
export const mockLeadsRepository = new MockLeadsRepository();
export const mockConversationsRepository = new MockConversationsRepository();
export const mockAgentDecisionsRepository = new MockAgentDecisionsRepository();
export const mockCommunicationsRepository = new MockCommunicationsRepository();
export const mockAgentConfigurationsRepository = new MockAgentConfigurationsRepository();
export const mockBrandingRepository = new MockBrandingRepository();
export const mockCampaignsRepository = new MockCampaignsRepository();

export async function closeConnection() {
  // No-op for mock repositories
  console.log('Mock repositories closed');
}
