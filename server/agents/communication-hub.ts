import { BaseAgent, AgentContext, AgentDecision } from './base-agent';
import { EmailAgent } from './email-agent';
import { SMSAgent } from './sms-agent';
import { ChatAgent } from './chat-agent';
import { CCLLogger } from '../utils/logger';
import { ConversationsRepository, CampaignsRepository } from '../db';
import { Lead } from '../db/schema';

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

export class AgentCommunicationHub {
  private emailAgent: EmailAgent;
  private smsAgent: SMSAgent;
  private chatAgent: ChatAgent;
  private activeSyncs: Map<string, ScheduleSyncData> = new Map();

  constructor() {
    this.emailAgent = new EmailAgent();
    this.smsAgent = new SMSAgent();
    this.chatAgent = new ChatAgent();
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
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

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
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    // Find the next appropriate action based on conversation history
    const nextAction = syncData.coordinatedMessages.find(coord => {
      // Check if this agent/channel combination hasn't been used recently
      const recentUsage = conversations.filter(conv => 
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