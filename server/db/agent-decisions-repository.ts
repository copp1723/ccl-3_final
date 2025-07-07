import { eq, desc, and } from 'drizzle-orm';
import { db } from './client';
import { agentDecisions, agentTypeEnum } from './schema';
import { nanoid } from 'nanoid';

export interface AgentDecision {
  id: string;
  leadId: string;
  agentType: typeof agentTypeEnum.enumValues[number];
  decision: string;
  reasoning: string | null;
  context: Record<string, any> | null;
  createdAt: Date;
}

export class AgentDecisionsRepository {
  /**
   * Record an agent decision
   */
  static async create(
    leadId: string,
    agentType: typeof agentTypeEnum.enumValues[number],
    decision: string,
    reasoning?: string,
    context?: Record<string, any>
  ): Promise<AgentDecision> {
    const decisionRecord = {
      id: nanoid(),
      leadId,
      agentType,
      decision,
      reasoning: reasoning || null,
      context: context || {},
      createdAt: new Date()
    };

    const [inserted] = await db.insert(agentDecisions).values(decisionRecord).returning();
    return inserted;
  }

  /**
   * Get all decisions for a lead
   */
  static async findByLeadId(leadId: string): Promise<AgentDecision[]> {
    return db
      .select()
      .from(agentDecisions)
      .where(eq(agentDecisions.leadId, leadId))
      .orderBy(desc(agentDecisions.createdAt));
  }

  /**
   * Get decisions by agent type
   */
  static async findByAgentType(
    agentType: typeof agentTypeEnum.enumValues[number]
  ): Promise<AgentDecision[]> {
    return db
      .select()
      .from(agentDecisions)
      .where(eq(agentDecisions.agentType, agentType))
      .orderBy(desc(agentDecisions.createdAt));
  }

  /**
   * Get the latest decision for a lead from a specific agent
   */
  static async findLatestDecision(
    leadId: string,
    agentType: typeof agentTypeEnum.enumValues[number]
  ): Promise<AgentDecision | null> {
    const [decision] = await db
      .select()
      .from(agentDecisions)
      .where(
        and(
          eq(agentDecisions.leadId, leadId),
          eq(agentDecisions.agentType, agentType)
        )
      )
      .orderBy(desc(agentDecisions.createdAt))
      .limit(1);

    return decision || null;
  }

  /**
   * Get decision timeline for a lead
   */
  static async getDecisionTimeline(leadId: string): Promise<{
    agent: string;
    decision: string;
    reasoning: string | null;
    timestamp: Date;
  }[]> {
    const decisions = await this.findByLeadId(leadId);
    
    return decisions.map(d => ({
      agent: d.agentType,
      decision: d.decision,
      reasoning: d.reasoning,
      timestamp: d.createdAt
    }));
  }

  /**
   * Count decisions by type and agent
   */
  static async getDecisionStats(): Promise<{
    agentType: string;
    decision: string;
    count: number;
  }[]> {
    const stats = await db
      .select({
        agentType: agentDecisions.agentType,
        decision: agentDecisions.decision,
        count: db.$count(agentDecisions.id)
      })
      .from(agentDecisions)
      .groupBy(agentDecisions.agentType, agentDecisions.decision);

    return stats;
  }

  /**
   * Get recent decisions across all agents
   */
  static async getRecentDecisions(limit: number = 20): Promise<AgentDecision[]> {
    return db
      .select()
      .from(agentDecisions)
      .orderBy(desc(agentDecisions.createdAt))
      .limit(limit);
  }
}