import { db } from './client';
import { agentConfigurations } from './schema';
import { eq, and, or, ilike, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface AgentConfigurationData {
  name: string;
  type: 'overlord' | 'email' | 'sms' | 'chat';
  role: string;
  endGoal: string;
  instructions: {
    dos: string[];
    donts: string[];
  };
  domainExpertise?: string[];
  personality: string;
  tone: string;
  responseLength?: string;
  apiModel?: string;
  temperature?: number;
  maxTokens?: number;
  active?: boolean;
  metadata?: Record<string, any>;
}

export class AgentConfigurationsRepository {
  static async create(data: AgentConfigurationData) {
    const [agent] = await db
      .insert(agentConfigurations)
      .values({
        id: nanoid(),
        ...data,
        domainExpertise: data.domainExpertise || [],
        responseLength: data.responseLength || 'medium',
        temperature: data.temperature || 70,
        maxTokens: data.maxTokens || 500,
        active: data.active !== false,
        performance: {
          conversations: 0,
          successfulOutcomes: 0,
          averageResponseTime: 0
        },
        metadata: data.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return agent;
  }

  static async findById(id: string) {
    const [agent] = await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.id, id))
      .limit(1);
    
    return agent;
  }

  static async findByType(type: 'overlord' | 'email' | 'sms' | 'chat') {
    const agents = await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.type, type))
      .orderBy(desc(agentConfigurations.createdAt));
    
    return agents;
  }

  static async findByName(name: string) {
    const [agent] = await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.name, name))
      .limit(1);
    
    return agent;
  }

  static async findAll(options?: {
    type?: string;
    active?: boolean;
    search?: string;
    personality?: string;
    tone?: string;
  }) {
    let query = db.select().from(agentConfigurations);

    const conditions = [];

    if (options?.type) {
      conditions.push(eq(agentConfigurations.type, options.type as any));
    }

    if (options?.active !== undefined) {
      conditions.push(eq(agentConfigurations.active, options.active));
    }

    if (options?.personality) {
      conditions.push(eq(agentConfigurations.personality, options.personality));
    }

    if (options?.tone) {
      conditions.push(eq(agentConfigurations.tone, options.tone));
    }

    if (options?.search) {
      conditions.push(
        or(
          ilike(agentConfigurations.name, `%${options.search}%`),
          ilike(agentConfigurations.role, `%${options.search}%`),
          ilike(agentConfigurations.endGoal, `%${options.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const agents = await query.orderBy(desc(agentConfigurations.createdAt));
    return agents;
  }

  static async update(id: string, data: Partial<AgentConfigurationData>) {
    const [agent] = await db
      .update(agentConfigurations)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(agentConfigurations.id, id))
      .returning();
    
    return agent;
  }

  static async toggleActive(id: string) {
    const agent = await this.findById(id);
    if (!agent) return null;

    const [updated] = await db
      .update(agentConfigurations)
      .set({
        active: !agent.active,
        updatedAt: new Date()
      })
      .where(eq(agentConfigurations.id, id))
      .returning();
    
    return updated;
  }

  static async delete(id: string) {
    const [deleted] = await db
      .delete(agentConfigurations)
      .where(eq(agentConfigurations.id, id))
      .returning();
    
    return deleted;
  }

  static async updatePerformance(
    id: string, 
    metric: 'conversations' | 'successfulOutcomes' | 'averageResponseTime',
    value?: number
  ) {
    const agent = await this.findById(id);
    if (!agent) return null;

    const performance = agent.performance as any || {
      conversations: 0,
      successfulOutcomes: 0,
      averageResponseTime: 0
    };

    if (metric === 'averageResponseTime' && value !== undefined) {
      // Calculate new average response time
      const totalTime = performance.averageResponseTime * performance.conversations;
      const newTotalTime = totalTime + value;
      performance.averageResponseTime = performance.conversations > 0 
        ? newTotalTime / (performance.conversations + 1)
        : value;
    } else if (metric === 'conversations' || metric === 'successfulOutcomes') {
      performance[metric] = (performance[metric] || 0) + 1;
    }

    // Calculate satisfaction score based on success rate
    if (performance.conversations > 0) {
      performance.satisfactionScore = 
        (performance.successfulOutcomes / performance.conversations) * 100;
    }

    const [updated] = await db
      .update(agentConfigurations)
      .set({
        performance,
        updatedAt: new Date()
      })
      .where(eq(agentConfigurations.id, id))
      .returning();
    
    return updated;
  }

  static async clone(id: string, newName: string) {
    const agent = await this.findById(id);
    if (!agent) return null;

    const cloned = await this.create({
      name: newName,
      type: agent.type,
      role: agent.role,
      endGoal: agent.endGoal,
      instructions: agent.instructions as any,
      domainExpertise: agent.domainExpertise as string[],
      personality: agent.personality,
      tone: agent.tone,
      responseLength: agent.responseLength || 'medium',
      apiModel: agent.apiModel || undefined,
      temperature: agent.temperature || 70,
      maxTokens: agent.maxTokens || 500,
      active: true, // Cloned agents start as active
      metadata: {
        ...agent.metadata as any,
        clonedFrom: agent.id,
        clonedAt: new Date().toISOString()
      }
    });

    return cloned;
  }

  static async getTopPerforming(
    metric: 'satisfactionScore' | 'conversations' | 'successfulOutcomes' = 'satisfactionScore',
    limit: number = 10
  ) {
    const agents = await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.active, true))
      .orderBy(
        desc(sql`(performance->>'${metric}')::numeric`)
      )
      .limit(limit);
    
    return agents.filter(agent => {
      const perf = agent.performance as any;
      return perf && perf[metric] > 0;
    });
  }

  static async createDefaultAgents() {
    const defaultAgents: AgentConfigurationData[] = [
      {
        name: 'Overlord Orchestrator',
        type: 'overlord',
        role: 'Lead Routing & Qualification Manager',
        endGoal: 'Route leads to the most appropriate communication channel and qualify them for Boberdoo submission',
        instructions: {
          dos: [
            'Analyze lead source and metadata to determine best channel',
            'Consider lead preferences when available',
            'Prioritize channels based on urgency and lead value',
            'Track and learn from routing decisions'
          ],
          donts: [
            "Don't route to unavailable channels",
            "Don't ignore campaign-specific routing rules",
            "Don't delay high-value leads"
          ]
        },
        domainExpertise: ['Lead Management', 'Channel Optimization', 'Qualification Criteria'],
        personality: 'analytical',
        tone: 'professional',
        responseLength: 'medium'
      },
      {
        name: 'Professional Email Agent',
        type: 'email',
        role: 'Senior Sales Development Representative',
        endGoal: 'Convert leads into qualified opportunities through personalized email communication',
        instructions: {
          dos: [
            'Personalize every email based on lead information',
            'Follow up within 24 hours of initial contact',
            'Provide value in every interaction',
            'Use data to optimize email timing and content'
          ],
          donts: [
            "Don't use aggressive sales tactics",
            "Don't send generic templates without personalization",
            "Don't overwhelm with too many follow-ups"
          ]
        },
        domainExpertise: ['Email Marketing', 'Sales Development', 'Lead Nurturing'],
        personality: 'professional',
        tone: 'friendly',
        responseLength: 'medium',
        temperature: 75,
        maxTokens: 600
      },
      {
        name: 'SMS Quick Response Agent',
        type: 'sms',
        role: 'Mobile Engagement Specialist',
        endGoal: 'Engage leads quickly through concise, action-oriented SMS messages',
        instructions: {
          dos: [
            'Keep messages under 160 characters when possible',
            'Include clear call-to-action',
            'Respond quickly to inbound messages',
            'Use casual but respectful language'
          ],
          donts: [
            "Don't send messages outside business hours",
            "Don't use complex language or jargon",
            "Don't send multiple messages in succession"
          ]
        },
        domainExpertise: ['SMS Marketing', 'Mobile Communication', 'Quick Response'],
        personality: 'friendly',
        tone: 'casual',
        responseLength: 'short',
        temperature: 65,
        maxTokens: 200
      },
      {
        name: 'Live Chat Support Agent',
        type: 'chat',
        role: 'Real-time Customer Engagement Specialist',
        endGoal: 'Provide immediate assistance and qualify leads through live chat interactions',
        instructions: {
          dos: [
            'Respond within 30 seconds',
            'Ask qualifying questions naturally',
            'Provide helpful resources and links',
            'Transfer to human agent when needed'
          ],
          donts: [
            "Don't leave customers waiting",
            "Don't provide incorrect information",
            "Don't be overly pushy or salesy"
          ]
        },
        domainExpertise: ['Live Chat', 'Customer Support', 'Real-time Engagement'],
        personality: 'friendly',
        tone: 'conversational',
        responseLength: 'short',
        temperature: 70,
        maxTokens: 300
      }
    ];

    const created = [];
    for (const agentData of defaultAgents) {
      // Check if agent already exists
      const existing = await this.findByName(agentData.name);
      if (!existing) {
        const agent = await this.create(agentData);
        created.push(agent);
      }
    }

    return created;
  }

  static async getActiveByType(type: 'overlord' | 'email' | 'sms' | 'chat') {
    const [agent] = await db
      .select()
      .from(agentConfigurations)
      .where(
        and(
          eq(agentConfigurations.type, type),
          eq(agentConfigurations.active, true)
        )
      )
      .orderBy(desc(agentConfigurations.createdAt))
      .limit(1);
    
    return agent;
  }

  static validateInstructions(instructions: any): instructions is { dos: string[]; donts: string[] } {
    return (
      instructions &&
      typeof instructions === 'object' &&
      Array.isArray(instructions.dos) &&
      Array.isArray(instructions.donts) &&
      instructions.dos.every((item: any) => typeof item === 'string') &&
      instructions.donts.every((item: any) => typeof item === 'string')
    );
  }

  static generatePromptFromConfig(agent: any, context: any = {}) {
    const { role, endGoal, instructions, personality, tone, domainExpertise } = agent;
    
    let prompt = `You are a ${role}. Your primary goal is: ${endGoal}\n\n`;
    
    if (domainExpertise && domainExpertise.length > 0) {
      prompt += `Your areas of expertise include: ${domainExpertise.join(', ')}.\n\n`;
    }
    
    prompt += `Instructions:\n`;
    prompt += `DO:\n${instructions.dos.map((d: string) => `- ${d}`).join('\n')}\n\n`;
    prompt += `DON'T:\n${instructions.donts.map((d: string) => `- ${d}`).join('\n')}\n\n`;
    
    prompt += `Personality: ${personality}\n`;
    prompt += `Tone: ${tone}\n`;
    prompt += `Response Length: ${agent.responseLength || 'medium'}\n\n`;
    
    if (context.leadInfo) {
      prompt += `Lead Information:\n${JSON.stringify(context.leadInfo, null, 2)}\n\n`;
    }
    
    if (context.conversationHistory) {
      prompt += `Conversation History:\n${context.conversationHistory}\n\n`;
    }
    
    if (context.specificRequest) {
      prompt += `Specific Request: ${context.specificRequest}\n`;
    }
    
    return prompt;
  }
}