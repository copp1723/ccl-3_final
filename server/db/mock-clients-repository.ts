export class MockClientsRepository {
  private clients: any[] = [
    {
      id: 'default',
      name: 'Default Client',
      domain: 'localhost',
      branding: {
        companyName: 'Customer Connection Lab',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981',
        logoUrl: '',
        emailFromName: 'CCL Team',
        supportEmail: 'support@ccl.com',
        websiteUrl: '',
        favicon: '',
        customCss: ''
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  async list() {
    return this.clients;
  }
  
  async findById(id: string) {
    return this.clients.find(c => c.id === id);
  }
  
  async create(data: any) {
    const client = {
      id: `client-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.clients.push(client);
    return client;
  }
}

export const mockClientsRepository = new MockClientsRepository();