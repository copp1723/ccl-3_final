import { db } from './client';
import { clients } from './schema';
import { eq } from 'drizzle-orm';
import { CCLBrandingConfig } from '../../shared/config/branding-config';

export interface Client {
  id: string;
  name: string;
  domain?: string | null;
  settings?: any;
  active?: boolean | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export class ClientsRepository {
  async findById(id: string): Promise<Client | null> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0] || null;
  }

  async findByDomain(domain: string): Promise<Client | null> {
    const result = await db.select().from(clients).where(eq(clients.domain, domain)).limit(1);
    return result[0] || null;
  }

  async create(data: {
    name: string;
    domain?: string;
    settings?: any;
  }): Promise<Client> {
    const result = await db.insert(clients).values({
      name: data.name,
      domain: data.domain,
      settings: data.settings,
      active: true
    }).returning();
    
    return result[0];
  }

  async updateBranding(id: string, branding: CCLBrandingConfig): Promise<Client | null> {
    const client = await this.findById(id);
    if (!client) return null;

    const updatedSettings = {
      ...client.settings,
      branding
    };

    const result = await db.update(clients)
      .set({ 
        settings: updatedSettings,
        updatedAt: new Date()
      })
      .where(eq(clients.id, id))
      .returning();

    return result[0] || null;
  }

  async getBranding(id: string): Promise<CCLBrandingConfig | null> {
    const client = await this.findById(id);
    if (!client?.settings?.branding) return null;
    
    return client.settings.branding as CCLBrandingConfig;
  }

  async list(): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.active, true));
  }
}

export const clientsRepository = new ClientsRepository();