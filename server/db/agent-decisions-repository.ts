import { nanoid } from 'nanoid';

// Temporary in-memory storage to replace removed agentDecisions table
type AgentType = 'email' | 'sms' | 'chat' | 'routing' | 'qualification';

export interface AgentDecision {
  id: string;
  leadId: string;
  agentType: AgentType;
  decision: string;
  reasoning: string | null;
  context: Record<string, any> | null;
  createdAt: Date;
}

const decisionStore: AgentDecision[] = [];

export class AgentDecisionsRepository {
  /**
   * Record an agent decision
   */
  static async create(
    leadId: string,
    agentType: AgentType,
    decision: string,
    reasoning?: string,
    context?: Record<string, any>
  ): Promise<AgentDecision> {
    const decisionRecord: AgentDecision = {
      id: nanoid(),
      leadId,
      agentType,
      decision,
      reasoning: reasoning || null,
      context: context || {},
      createdAt: new Date()
    };

    decisionStore.push(decisionRecord);
    return decisionRecord;
  }

  /**
   * Get all decisions for a lead
   */
  static async findByLeadId(leadId: string): Promise<AgentDecision[]> {
    return decisionStore.filter(d => d.leadId === leadId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get decisions by agent type
   */
  static async findByAgentType(
    agentType: AgentType
  ): Promise<AgentDecision[]> {
    return decisionStore.filter(d => d.agentType === agentType).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get the latest decision for a lead from a specific agent
   */
  static async findLatestDecision(
    leadId: string,
    agentType: AgentType
  ): Promise<AgentDecision | null> {
    return (
      decisionStore
        .filter(d => d.leadId === leadId && d.agentType === agentType)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null
    );
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
   * Get decision statistics
   */
  static async getDecisionStats(): Promise<{
    agentType: string;
    decision: string;
    count: number;
  }[]> {
    // Generate stats from in-memory store
    const statMap: Record<string, Record<string, number>> = {};
    decisionStore.forEach(d => {
      if (!statMap[d.agentType]) statMap[d.agentType] = {};
      if (!statMap[d.agentType][d.decision]) statMap[d.agentType][d.decision] = 0;
      statMap[d.agentType][d.decision] += 1;
    });

    const stats: { agentType: string; decision: string; count: number }[] = [];
    Object.entries(statMap).forEach(([agentType, decisions]) => {
      Object.entries(decisions).forEach(([decision, count]) => {
        stats.push({ agentType, decision, count });
      });
    });

    return stats;
  }

  /**
   * Get recent decisions
   */
  static async getRecentDecisions(limit: number = 20): Promise<AgentDecision[]> {
    return decisionStore
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}