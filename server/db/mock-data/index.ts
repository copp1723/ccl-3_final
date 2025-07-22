// Mock data for fallback when database is not available

export interface MockClient {
  id: string;
  name: string;
  domain?: string;
  settings?: any;
  active: boolean;
}

export const mockClients = {
  clients: [
    {
      id: 'ccl-default',
      name: 'Complete Car Loans',
      domain: 'completecarloans.com',
      settings: {
        branding: {
          companyName: 'Complete Car Loans',
          primaryColor: '#2563eb',
          secondaryColor: '#1d4ed8'
        }
      },
      active: true
    },
    {
      id: 'demo-client',
      name: 'Demo Client',
      domain: 'demo.localhost',
      settings: {
        branding: {
          companyName: 'Demo Client',
          primaryColor: '#059669',
          secondaryColor: '#047857'
        }
      },
      active: true
    }
  ] as MockClient[],

  findById(id: string): MockClient | undefined {
    return this.clients.find(client => client.id === id);
  },

  findByDomain(domain: string): MockClient | undefined {
    return this.clients.find(client => client.domain === domain);
  },

  findAll(): MockClient[] {
    return this.clients.filter(client => client.active);
  }
};

export default mockClients; 