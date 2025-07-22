import { eq, desc, and, or, gte, sql, ilike } from 'drizzle-orm';
import { db } from './client';
import { leads, communications, Lead, NewLead } from './schema';
import { nanoid } from 'nanoid';

export class LeadsRepository {
  /**
   * Create a new lead
   */
  static async create(leadData: Omit<NewLead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const lead = {
      ...leadData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [inserted] = await db.insert(leads).values(lead).returning();
    return inserted;
  }

  /**
   * Find lead by ID
   */
  static async findById(id: string): Promise<Lead | null> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || null;
  }

  /**
   * Find all leads with optional filtering
   */
  static async findAll(filters: any = {}): Promise<Lead[]> {
    const query = db.select().from(leads);
    return await query.orderBy(desc(leads.createdAt));
  }

  /**
   * Update lead
   */
  static async update(id: string, data: Partial<Lead>): Promise<Lead | null> {
    const [updated] = await db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    
    return updated || null;
  }

  /**
   * Delete lead
   */
  static async delete(id: string): Promise<boolean> {
    await db.delete(leads).where(eq(leads.id, id));
    return true;
  }
}