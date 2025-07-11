export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  status: string;
  score: number;
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

export type ViewType = 'dashboard' | 'leads' | 'agent-management' | 'conversations' | 'branding';