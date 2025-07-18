// Lead Types
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'dead';
  score: number;
  campaignId?: string;
  boberdooLeadId?: string;
  vehicleType?: string;
  createdAt: string;
  updatedAt?: string;
  lastContactedAt?: string;
  conversationCount?: number;
}

// Campaign Types
export interface CampaignSettings {
  goals: string[];
  qualificationCriteria: {
    minScore: number;
    requiredFields: string[];
    requiredGoals: string[];
  };
  handoverCriteria: {
    qualificationScore: number;
    conversationLength: number;
    timeThreshold: number;
    keywordTriggers: string[];
    goalCompletionRequired: string[];
    handoverRecipients: {
      name: string;
      email: string;
      role: string;
      priority: 'high' | 'medium' | 'low';
    }[];
  };
  channelPreferences: {
    primary: 'email' | 'sms' | 'chat';
    fallback: Array<'email' | 'sms' | 'chat'>;
  };
  touchSequence: Array<{
    templateId: string;
    delayDays: number;
    delayHours: number;
    conditions?: any;
  }>;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status?: 'active' | 'paused' | 'completed';
  settings?: CampaignSettings;
  agentId?: string;
  assignedAgents?: string[];
  createdAt: string;
  updatedAt?: string;
  active?: boolean;
  stats?: {
    totalLeads: number;
    activeLeads: number;
    convertedLeads: number;
  };
}

// Client/Branding Types
export interface CCLBrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logo?: string;
  favicon?: string;
  companyName: string;
  emailTemplate?: string;
  smsTemplate?: string;
  chatGreeting?: string;
  supportEmail?: string;
  supportPhone?: string;
  website?: string;
  defaultEmailSignature?: string;
}

export interface Client {
  id: string;
  name: string;
  industry?: string;
  brand_config?: CCLBrandingConfig;
  createdAt: string;
}

// Unified Agent Configuration Types
export type AgentType = 'overlord' | 'email' | 'sms' | 'chat';
export type AgentPersonality = 'professional' | 'friendly' | 'authoritative' | 'empathetic' | 'casual' | 'enthusiastic';
export type AgentTone = 'formal' | 'casual' | 'enthusiastic' | 'persuasive' | 'conversational' | 'warm' | 'direct';
export type ResponseLength = 'short' | 'medium' | 'long';

export interface AgentCapabilities {
  email: boolean;
  sms: boolean;
  chat: boolean;
}

export interface AgentInstructions {
  dos: string[];
  donts: string[];
}

export interface AgentPerformance {
  conversations: number;
  successfulOutcomes: number;
  averageResponseTime?: number;
  satisfactionScore?: number;
}

export interface UnifiedAgentConfig {
  id?: string;
  name: string;
  type: AgentType;
  role: string;
  endGoal: string;
  instructions: AgentInstructions;
  domainExpertise: string[];
  personality: AgentPersonality;
  tone: AgentTone;
  responseLength: ResponseLength;
  apiModel?: string;
  temperature: number;
  maxTokens: number;
  active: boolean;
  capabilities?: AgentCapabilities;
  performance?: AgentPerformance;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface Stats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
}

export type ViewType =
  | 'dashboard'
  | 'clients'
  | 'leads'
  | 'agents'
  | 'campaigns'
  | 'templates'
  | 'reports'
  | 'conversations'
  | 'branding';