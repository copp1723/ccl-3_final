import { BaseAgent, AgentContext, AgentDecision } from './base-agent';
import { EmailAgent } from './email-agent';
import { SMSAgent } from './sms-agent';
import { ChatAgent } from './chat-agent';
import { CCLLogger } from '../utils/logger';
import { ConversationsRepository, CampaignsRepository } from '../db';
import { Lead } from '../db/schema';
import { EventEmitter } from 'events';
import { WebSocketMessageHandler } from '../websocket/message-handler';

interface AgentCapabilities {
  email: boolean;
  sms: boolean;
  chat: boolean;
}

interface MessageCoordination {
  agentId: string;
  channel: 'email' | 'sms' | 'chat';
  scheduledTime?: Date;
  priority: number;
  messageTemplate?: string;
}

interface ScheduleSyncData {
  campaignId: string;
  agents: string[];
  coordinatedMessages: MessageCoordination[];
  lastSyncTime: Date;
}

// Agent-to-agent message types
interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'decision' | 'status' | 'handover' | 'goal_update' | 'coordination';
  payload: any;
  timestamp: Date;
}

// Goal progress tracking
interface GoalProgress {
  campaignId: string;
  leadId: string;
  goals: {
    [goalName: string]: {
      target: number;
      current: number;
      completed: boolean;
      lastUpdated: Date;
    };
  };
}

export class AgentCommunicationHub extends EventEmitter {
  private emailAgent: EmailAgent;
  private smsAgent: SMSAgent;
  private chatAgent: ChatAgent;
  private activeSyncs: Map<string, ScheduleSyncData> = new Map();
  private agentMessages: Map<string, AgentMessage[]> = new Map();
  private goalProgress: Map<string, GoalProgress> = new Map();
  private wsHandler: WebSocketMessageHandler | null = null;
  private logger = new CCLLogger();

  constructor() {
    super();
    this.emailAgent = new EmailAgent();
    this.smsAgent = new SMSAgent();
    this.chatAgent = new ChatAgent();
    this.initializeMessageHandlers();
  }

  /**
   * Initialize WebSocket handler for real-time communication
   */
  setWebSocketHandler(wsHandler: WebSocketMessageHandler): void {
    this.wsHandler = wsHandler;
  }

  /**
   * Initialize internal message handlers for agent communication
   */
  private initializeMessageHandlers(): void {
    // Handle decision coordination
    this.on('agent:decision', async (message: AgentMessage) => {
      await this.handleAgentDecision(message);
    });

    // Handle status updates
    this.on('agent:status', async (message: AgentMessage) => {
      await this.handleAgentStatus(message);
    });

    // Handle handover requests
    this.on('agent:handover', async (message: AgentMessage) => {
      await this.handleAgentHandover(message);
    });

    // Handle goal updates
    this.on('agent:goal_update', async (message: AgentMessage) => {
      await this.handleGoalUpdate(message);
    });
  }

  /**
   * Send message between agents
   */
  async sendAgentMessage(from: string, to: string, type: AgentMessage['type'], payload: any): Promise<void> {
    const message: AgentMessage = {
      id: crypto.randomUUID(),
      from,
      to,
      type,
      payload,
      timestamp: new Date()
    };

    // Store message
    const key = `${from}-${to}`;
    if (!this.agentMessages.has(key)) {
      this.agentMessages.set(key, []);
    }
    this.agentMessages.get(key)!.push(message);

    // Emit for processing
    this.emit(`agent:${type}`, message);

    // Send via WebSocket for real-time updates
    if (this.wsHandler) {
      (this.wsHandler as any).broadcastCallback({
        type: 'agent_message',
        data: message
      });
    }

    this.logger.info('Agent message sent', {
      from,
      to,
      type,
      messageId: message.id
    });
  }

  /**
   * Handle agent decision coordination
   */
  private async handleAgentDecision(message: AgentMessage): Promise<void> {
    const { from, payload } = message;
    const { leadId, decision, requiresCoordination } = payload;

    if (requiresCoordination) {
      // Get all active agents for this lead
      const activeAgents = await this.getActiveAgentsForLead(leadId);
      
      // Coordinate decision with other agents
      const coordinationResults = await Promise.all(
        activeAgents
          .filter(agent => agent !== from)
          .map(agent => this.requestAgentFeedback(agent, decision))
      );

      // Aggregate feedback and make final decision
      const finalDecision = this.aggregateDecisions(decision, coordinationResults);
      
      // Notify all agents of final decision
      for (const agent of activeAgents) {
        await this.sendAgentMessage('hub', agent, 'coordination', {
          leadId,
          finalDecision,
          originalDecision: decision
        });
      }
    }
  }

  /**
   * Handle agent status updates
   */
  private async handleAgentStatus(message: AgentMessage): Promise<void> {
    const { from, payload } = message;
    const { leadId, status, details } = payload;

    // Broadcast status to relevant agents
    const activeAgents = await this.getActiveAgentsForLead(leadId);
    for (const agent of activeAgents) {
      if (agent !== from) {
        await this.sendAgentMessage('hub', agent, 'status', {
          leadId,
          reportingAgent: from,
          status,
          details
        });
      }
    }

    // Update WebSocket clients
    if (this.wsHandler) {
      (this.wsHandler as any).broadcastCallback({
        type: 'agent_status_update',
        data: { leadId, agent: from, status, details }
      });
    }
  }

  /**
   * Handle agent handover requests
   */
  private async handleAgentHandover(message: AgentMessage): Promise<void> {
    const { from, payload } = message;
    const { leadId, targetAgent, reason, context } = payload;

    this.logger.info('Agent handover requested', {
      from,
      to: targetAgent,
      leadId,
      reason
    });

    // Get target agent
    const agent = this.getAgentByType(targetAgent);
    if (!agent) {
      this.logger.error('Target agent not found for handover', { targetAgent });
      return;
    }

    // Transfer context to target agent
    await this.sendAgentMessage(from, targetAgent, 'handover', {
      leadId,
      context,
      reason,
      previousAgent: from
    });

    // Update conversation ownership
    const conversations = await ConversationsRepository.findByLeadId(leadId);
    const activeConversation = conversations.find((c: any) => c.status === 'active');
    
    if (activeConversation) {
      await ConversationsRepository.updateAgentType(activeConversation.id, targetAgent);
    }
  }

  /**
   * Handle goal progress updates
   */
  private async handleGoalUpdate(message: AgentMessage): Promise<void> {
    const { payload } = message;
    const { campaignId, leadId, goalName, progress } = payload;

    const key = `${campaignId}-${leadId}`;
    let goalData = this.goalProgress.get(key);
    
    if (!goalData) {
      goalData = {
        campaignId,
        leadId,
        goals: {}
      };
      this.goalProgress.set(key, goalData);
    }

    // Update goal progress
    goalData.goals[goalName] = {
      target: progress.target,
      current: progress.current,
      completed: progress.current >= progress.target,
      lastUpdated: new Date()
    };

    // Check if all goals are completed
    const allGoalsCompleted = Object.values(goalData.goals).every(g => g.completed);
    
    if (allGoalsCompleted) {
      // Trigger campaign completion logic
      await this.handleCampaignCompletion(campaignId, leadId);
    }

    // Broadcast goal update
    if (this.wsHandler) {
      (this.wsHandler as any).broadcastCallback({
        type: 'goal_progress_update',
        data: {
          campaignId,
          leadId,
          goals: goalData.goals
        }
      });
    }
  }

  /**
   * Track goal progress for a lead
   */
  async updateGoalProgress(
    campaignId: string,
    leadId: string,
    goalName: string,
    increment: number = 1
  ): Promise<void> {
    const campaign = await CampaignsRepository.findById(campaignId);
    if (!campaign || !campaign.goals) return;

    const goal = (campaign.goals as any[]).find((g: any) => g.name === goalName);
    if (!goal) return;

    const key = `${campaignId}-${leadId}`;
    let goalData = this.goalProgress.get(key);
    
    if (!goalData) {
      goalData = {
        campaignId,
        leadId,
        goals: {}
      };
      this.goalProgress.set(key, goalData);
    }

    const currentProgress = goalData.goals[goalName]?.current || 0;
    const newProgress = currentProgress + increment;

    await this.sendAgentMessage('hub', 'all', 'goal_update', {
      campaignId,
      leadId,
      goalName,
      progress: {
        target: goal.target || 100,
        current: newProgress
      }
    });
  }

  /**
   * Get goal progress for a lead
   */
  getGoalProgress(campaignId: string, leadId: string): GoalProgress | null {
    const key = `${campaignId}-${leadId}`;
    return this.goalProgress.get(key) || null;
  }

  /**
   * Request feedback from an agent
   */
  private async requestAgentFeedback(agentId: string, decision: any): Promise<any> {
    // Simulate agent feedback (in production, this would query the actual agent)
    return {
      agentId,
      agrees: Math.random() > 0.3,
      confidence: Math.random(),
      suggestions: []
    };
  }

  /**
   * Aggregate decisions from multiple agents
   */
  private aggregateDecisions(originalDecision: any, feedback: any[]): any {
    const agreementCount = feedback.filter((f: any) => f.agrees).length;
    const totalAgents = feedback.length;
    const agreementRatio = totalAgents > 0 ? agreementCount / totalAgents : 1;

    return {
      ...originalDecision,
      consensus: agreementRatio > 0.5,
      confidence: agreementRatio,
      feedback
    };
  }

  /**
   * Get active agents for a lead
   */
  private async getActiveAgentsForLead(leadId: string): Promise<string[]> {
    const conversations = await ConversationsRepository.findByLeadId(leadId);
    const activeAgents = new Set<string>();
    
    conversations
      .filter((c: any) => c.status === 'active')
      .forEach((c: any) => activeAgents.add(c.agentType));
    
    return Array.from(activeAgents);
  }

  /**
   * Get agent by type
   */
  private getAgentByType(type: string): BaseAgent | null {
    switch (type) {
      case 'email':
        return this.emailAgent;
      case 'sms':
        return this.smsAgent;
      case 'chat':
        return this.chatAgent;
      default:
        return null;
    }
  }

  /**
   * Handle campaign completion
   */
  private async handleCampaignCompletion(campaignId: string, leadId: string): Promise<void> {
    this.logger.info('Campaign goals completed', { campaignId, leadId });
    
    // Notify all agents
    const activeAgents = await this.getActiveAgentsForLead(leadId);
    for (const agent of activeAgents) {
      await this.sendAgentMessage('hub', agent, 'coordination', {
        leadId,
        event: 'campaign_completed',
        campaignId
      });
    }

    // Update campaign status
    await CampaignsRepository.updateLeadStatus(campaignId, leadId, 'completed');
  }

  /**
   * Get message history between agents
   */
  getAgentMessageHistory(from: string, to: string): AgentMessage[] {
    const key = `${from}-${to}`;
    return this.agentMessages.get(key) || [];
  }

  /**
   * Clear message history (for testing)
   */
  clearMessageHistory(): void {
    this.agentMessages.clear();
    this.goalProgress.clear();
  }

  /**
   * Create a multi-channel agent that can communicate across all channels
   */
  async createCommunicationAgent(
    agentId: string,
    capabilities: AgentCapabilities,
    campaignId?: string
  ): Promise<CommunicationAgentInstance> {
    return new CommunicationAgentInstance(
      agentId,
      capabilities,
      this,
      campaignId
    );
  }

  /**
   * Coordinate messaging between multiple agents on the same campaign
   */
  async coordinateAgentMessages(
    campaignId: string,
    leadId: string,
    agents: string[],
    messageStrategy: 'round_robin' | 'priority_based' | 'channel_specific'
  ): Promise<MessageCoordination[]> {
    const campaign = await CampaignsRepository.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const conversations = await ConversationsRepository.findByLeadId(leadId);
    const lastActivity = conversations
      .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    const coordinations: MessageCoordination[] = [];

    switch (messageStrategy) {
      case 'round_robin':
        coordinations.push(...this.createRoundRobinSchedule(agents, campaign));
        break;
      case 'priority_based':
        coordinations.push(...this.createPriorityBasedSchedule(agents, campaign));
        break;
      case 'channel_specific':
        coordinations.push(...this.createChannelSpecificSchedule(agents, campaign));
        break;
    }

    // Store sync data
    this.activeSyncs.set(campaignId, {
      campaignId,
      agents,
      coordinatedMessages: coordinations,
      lastSyncTime: new Date()
    });

    new CCLLogger().info('Communication hub agents coordinated', {
      campaignId,
      leadId,
      agentCount: agents.length,
      strategy: messageStrategy
    });

    return coordinations;
  }

  /**
   * Sync schedules between agents on the same campaign
   */
  async syncAgentSchedules(campaignId: string): Promise<ScheduleSyncData | null> {
    const campaign = await CampaignsRepository.findById(campaignId);
    if (!campaign) return null;

    const syncData = this.activeSyncs.get(campaignId);
    if (!syncData) return null;

    // Update schedules based on campaign preferences and agent availability
    const updatedCoordinations = await this.rebalanceMessageSchedule(syncData);
    
    syncData.coordinatedMessages = updatedCoordinations;
    syncData.lastSyncTime = new Date();
    
    this.activeSyncs.set(campaignId, syncData);

    new CCLLogger().info('Communication hub schedules synced', {
      campaignId,
      messageCount: updatedCoordinations.length
    });

    return syncData;
  }

  /**
   * Get the next agent/channel for a lead based on coordination strategy
   */
  async getNextCommunicationAction(
    leadId: string,
    campaignId: string
  ): Promise<{ agentId: string; channel: 'email' | 'sms' | 'chat'; priority: number } | null> {
    const syncData = this.activeSyncs.get(campaignId);
    if (!syncData) return null;

    const conversations = await ConversationsRepository.findByLeadId(leadId);
    const lastConversation = conversations
      .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    // Find the next appropriate action based on conversation history
    const nextAction = syncData.coordinatedMessages.find(coord => {
      // Check if this agent/channel combination hasn't been used recently
      const recentUsage = conversations.filter((conv: any) => 
        conv.channel === coord.channel && 
        new Date(conv.startedAt).getTime() > Date.now() - (24 * 60 * 60 * 1000) // 24 hours
      );
      
      return recentUsage.length === 0;
    });

    return nextAction ? {
      agentId: nextAction.agentId,
      channel: nextAction.channel,
      priority: nextAction.priority
    } : null;
  }

  /**
   * Process a message through the appropriate agent and channel
   */
  async processMessage(
    message: string,
    context: AgentContext,
    channel: 'email' | 'sms' | 'chat'
  ): Promise<string> {
    switch (channel) {
      case 'email':
        return await this.emailAgent.processMessage(message, context);
      case 'sms':
        return await this.smsAgent.processMessage(message, context);
      case 'chat':
        return await this.chatAgent.processMessage(message, context);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  private createRoundRobinSchedule(agents: string[], campaign: any): MessageCoordination[] {
    const coordinations: MessageCoordination[] = [];
    const channels: ('email' | 'sms' | 'chat')[] = ['email', 'sms', 'chat'];

    agents.forEach((agentId, index) => {
      const channel = channels[index % channels.length];
      coordinations.push({
        agentId,
        channel,
        priority: index + 1,
        scheduledTime: new Date(Date.now() + (index * 60 * 60 * 1000)) // Stagger by hour
      });
    });

    return coordinations;
  }

  private createPriorityBasedSchedule(agents: string[], campaign: any): MessageCoordination[] {
    const coordinations: MessageCoordination[] = [];
    const primaryChannel = campaign.channelPreferences?.primary || 'email';

    agents.forEach((agentId, index) => {
      coordinations.push({
        agentId,
        channel: primaryChannel,
        priority: index + 1,
        scheduledTime: new Date(Date.now() + (index * 2 * 60 * 60 * 1000)) // Stagger by 2 hours
      });
    });

    return coordinations;
  }

  private createChannelSpecificSchedule(agents: string[], campaign: any): MessageCoordination[] {
    const coordinations: MessageCoordination[] = [];
    const channels: ('email' | 'sms' | 'chat')[] = ['email', 'sms', 'chat'];
    const channelPrefs = campaign.channelPreferences;

    // Assign agents to their preferred channels
    agents.forEach((agentId, index) => {
      let channel: 'email' | 'sms' | 'chat';
      
      if (index === 0) {
        channel = channelPrefs?.primary || 'email';
      } else if (channelPrefs?.fallback && index - 1 < channelPrefs.fallback.length) {
        channel = channelPrefs.fallback[index - 1];
      } else {
        channel = channels[index % channels.length];
      }

      coordinations.push({
        agentId,
        channel,
        priority: index + 1,
        scheduledTime: new Date(Date.now() + (index * 30 * 60 * 1000)) // Stagger by 30 minutes
      });
    });

    return coordinations;
  }

  private async rebalanceMessageSchedule(syncData: ScheduleSyncData): Promise<MessageCoordination[]> {
    // Rebalance based on performance and availability
    return syncData.coordinatedMessages.map(coord => ({
      ...coord,
      scheduledTime: new Date(Date.now() + Math.random() * 60 * 60 * 1000) // Random within next hour
    }));
  }
}

/**
 * Individual agent instance that can work across multiple channels
 */
export class CommunicationAgentInstance {
  constructor(
    public id: string,
    public capabilities: AgentCapabilities,
    private hub: AgentCommunicationHub,
    public campaignId?: string
  ) {}

  async sendMessage(
    lead: Lead,
    message: string,
    channel: 'email' | 'sms' | 'chat',
    context: AgentContext
  ): Promise<any> {
    if (!this.capabilities[channel]) {
      throw new Error(`Agent ${this.id} does not have ${channel} capabilities`);
    }

    new CCLLogger().info(`Agent ${this.id} sent message`, {
      leadId: lead.id,
      channel,
      campaignId: this.campaignId
    });

    // Process through the appropriate channel agent
    const response = await this.hub.processMessage(message, context, channel);

    // Actual sending logic would depend on the channel
    switch (channel) {
      case 'email':
        // Email sending logic
        return { success: true, channel: 'email', response };
      case 'sms':
        // SMS sending logic  
        return { success: true, channel: 'sms', response };
      case 'chat':
        // Chat message logic
        return { success: true, channel: 'chat', response };
    }
  }

  async getAvailableChannels(): Promise<('email' | 'sms' | 'chat')[]> {
    return Object.entries(this.capabilities)
      .filter(([_, enabled]) => enabled)
      .map(([channel, _]) => channel as 'email' | 'sms' | 'chat');
  }

  async isChannelAvailable(channel: 'email' | 'sms' | 'chat'): Promise<boolean> {
    return this.capabilities[channel];
  }
}

// Singleton instance
let communicationHub: AgentCommunicationHub | null = null;

export function getCommunicationHub(): AgentCommunicationHub {
  if (!communicationHub) {
    communicationHub = new AgentCommunicationHub();
  }
  return communicationHub;
}