// shared/types/tables.ts
// Quick type definitions for missing tables to fix TypeScript errors

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  created_at: Date;
  updated_at: Date;
}

export interface Segment {
  id: number;
  name: string;
  criteria: any;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignDraft {
  id: number;
  campaign_id: number;
  content: any;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: number;
  lead_id: number;
  agent_id?: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserSession {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
}

// Export all table types
export type Tables = {
  emailTemplates: EmailTemplate;
  segments: Segment;
  campaignDrafts: CampaignDraft;
  agents: Agent;
  conversations: Conversation;
  userSessions: UserSession;
};
