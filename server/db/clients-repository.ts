import { db } from './client';
import { clients } from './schema';
import { eq, and } from 'drizzle-orm';
import type { Client, NewClient } from './schema';

export class ClientsRepository {
  /**
   * List all clients
   */
  static async list(): Promise<Client[]> {
    return db.select().from(clients).orderBy(clients.name);
  }

  /**
   * Find client by ID
   */
  static async findById(id: string): Promise<Client | null> {
    if (!id) return null;
    
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    
    return client || null;
  }

  /**
   * Find client by domain
   */
  static async findByDomain(domain: string): Promise<Client | null> {
    if (!domain) return null;
    
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.domain, domain))
      .limit(1);
    
    return client || null;
  }

  /**
   * Create a new client
   */
  static async create(data: Omit<NewClient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    const [inserted] = await db
      .insert(clients)
      .values({
        ...data,
        active: data.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return inserted;
  }

  /**
   * Update client branding
   */
  static async updateBranding(id: string, branding: any): Promise<Client | null> {
    if (!id) return null;
    
    const client = await this.findById(id);
    if (!client) return null;

    const currentSettings = client.settings || {};
    const updatedSettings = {
      ...currentSettings,
      branding: {
        ...currentSettings.branding,
        ...branding
      }
    };

    const [updated] = await db
      .update(clients)
      .set({
        settings: updatedSettings,
        updatedAt: new Date()
      })
      .where(eq(clients.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Update client
   */
  static async update(id: string, data: Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Client | null> {
    if (!id) return null;

    const [updated] = await db
      .update(clients)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(clients.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Delete client
   */
  static async delete(id: string): Promise<boolean> {
    if (!id) return false;

    const result = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Toggle client active status
   */
  static async toggleActive(id: string): Promise<Client | null> {
    if (!id) return null;
    
    const client = await this.findById(id);
    if (!client) return null;

    const [updated] = await db
      .update(clients)
      .set({
        active: !client.active,
        updatedAt: new Date()
      })
      .where(eq(clients.id, id))
      .returning();

    return updated || null;
  }
} 