import { pgTable, text, timestamp, jsonb, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums
export const leadStatusEnum = pgEnum('lead_status', [
  'new',
  'contacted',
  'qualified',
  'sent_to_boberdoo',
  'rejected',
  'archived'
]);

export const channelEnum = pgEnum('channel', ['email', 'sms', 'chat']);

export const agentTypeEnum = pgEnum('agent_type', ['overlord', 'email', 'sms', 'chat']);

// Tables
export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  source: text('source').notNull(), // e.g., 'website', 'facebook', 'google'
  campaign: text('campaign'),
  status: leadStatusEnum('status').notNull().default('new'),
  assignedChannel: channelEnum('assigned_channel'),
  qualificationScore: integer('qualification_score').default(0),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  boberdooId: text('boberdoo_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  campaignId: text('campaign_id').references(() => campaigns.id),
  channel: channelEnum('channel').notNull(),
  agentType: agentTypeEnum('agent_type').notNull(),
  messages: jsonb('messages').$type<Array<{
    role: 'agent' | 'lead';
    content: string;
    timestamp: string;
    qualificationScoreChange?: number;
    triggeredKeywords?: string[];
  }>>().notNull().default([]),
  currentQualificationScore: integer('current_qualification_score').default(0),
  goalProgress: jsonb('goal_progress').$type<Record<string, boolean>>().default({}),
  handoverTriggered: boolean('handover_triggered').default(false),
  handoverReason: text('handover_reason'),
  crossChannelContext: jsonb('cross_channel_context').$type<{
    previousChannels: string[];
    sharedNotes: string[];
    leadPreferences: Record<string, any>;
  }>().default({ previousChannels: [], sharedNotes: [], leadPreferences: {} }),
  status: text('status').notNull().default('active'), // active, handover_pending, human_takeover, completed, failed
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at')
});

export const agentDecisions = pgTable('agent_decisions', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  agentType: agentTypeEnum('agent_type').notNull(),
  decision: text('decision').notNull(),
  reasoning: text('reasoning'),
  context: jsonb('context').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  goals: jsonb('goals').$type<string[]>().notNull().default([]),
  qualificationCriteria: jsonb('qualification_criteria').$type<{
    minScore: number;
    requiredFields: string[];
    requiredGoals: string[];
  }>().notNull(),
  handoverCriteria: jsonb('handover_criteria').$type<{
    qualificationScore: number;
    conversationLength: number;
    keywordTriggers: string[];
    timeThreshold: number;
    goalCompletionRequired: string[];
  }>().notNull(),
  channelPreferences: jsonb('channel_preferences').$type<{
    primary: 'email' | 'sms' | 'chat';
    fallback: ('email' | 'sms' | 'chat')[];
  }>().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const communications = pgTable('communications', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  channel: channelEnum('channel').notNull(),
  direction: text('direction').notNull(), // 'inbound' or 'outbound'
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'), // pending, sent, delivered, failed
  externalId: text('external_id'), // Twilio/Mailgun ID
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const emailTemplates = pgTable('email_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  content: text('content').notNull(), // HTML content
  plainText: text('plain_text'), // Plain text version
  category: text('category').notNull(), // 'initial_contact', 'follow_up', 'nurture', 'custom'
  variables: jsonb('variables').$type<string[]>().notNull().default([]), // e.g., ['{{name}}', '{{company}}']
  campaignId: text('campaign_id').references(() => campaigns.id),
  agentId: text('agent_id'), // Which email agent uses this template
  active: boolean('active').notNull().default(true),
  performance: jsonb('performance').$type<{
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    openRate?: number;
    clickRate?: number;
    replyRate?: number;
  }>().default({ sent: 0, opened: 0, clicked: 0, replied: 0 }),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const agentConfigurations = pgTable('agent_configurations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: agentTypeEnum('type').notNull(), // 'email', 'sms', 'chat', 'overlord'
  role: text('role').notNull(), // e.g., 'Sales Specialist', 'Customer Support'
  endGoal: text('end_goal').notNull(), // Primary objective
  instructions: jsonb('instructions').$type<{
    dos: string[];
    donts: string[];
  }>().notNull(),
  domainExpertise: jsonb('domain_expertise').$type<string[]>().notNull().default([]),
  personality: text('personality').notNull(), // 'professional', 'friendly', 'casual'
  tone: text('tone').notNull(), // 'formal', 'conversational', 'enthusiastic'
  responseLength: text('response_length').default('medium'), // 'short', 'medium', 'long'
  apiModel: text('api_model'), // Which LLM model to use
  temperature: integer('temperature').default(70), // 0-100 scale
  maxTokens: integer('max_tokens').default(500),
  active: boolean('active').notNull().default(true),
  performance: jsonb('performance').$type<{
    conversations: number;
    successfulOutcomes: number;
    averageResponseTime: number;
    satisfactionScore?: number;
  }>().default({ conversations: 0, successfulOutcomes: 0, averageResponseTime: 0 }),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Schemas for validation
export const insertLeadSchema = createInsertSchema(leads);
export const selectLeadSchema = createSelectSchema(leads);

export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);

export const insertCampaignSchema = createInsertSchema(campaigns);
export const selectCampaignSchema = createSelectSchema(campaigns);

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
export const selectEmailTemplateSchema = createSelectSchema(emailTemplates);

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'agent', 'viewer']);

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  role: userRoleEnum('role').notNull().default('agent'),
  active: boolean('active').notNull().default(true),
  lastLogin: timestamp('last_login'),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Sessions table for JWT refresh tokens
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  refreshToken: text('refresh_token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Audit logs table
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(), // 'create', 'update', 'delete', 'view', 'export'
  resource: text('resource').notNull(), // 'lead', 'campaign', 'template', etc.
  resourceId: text('resource_id'),
  changes: jsonb('changes').$type<Record<string, any>>().default({}),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Analytics events table
export const analyticsEvents = pgTable('analytics_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(), // 'lead_created', 'email_sent', 'conversion', etc.
  leadId: text('lead_id').references(() => leads.id),
  campaignId: text('campaign_id').references(() => campaigns.id),
  userId: text('user_id').references(() => users.id),
  channel: channelEnum('channel'),
  value: integer('value').default(1), // For counting or monetary values
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// User schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

// Session schemas
export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);

// Audit log schemas
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);

// Analytics event schemas
export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents);
export const selectAnalyticsEventSchema = createSelectSchema(analyticsEvents);

// Types
export type Lead = z.infer<typeof selectLeadSchema>;
export type NewLead = z.infer<typeof insertLeadSchema>;
export type Conversation = z.infer<typeof selectConversationSchema>;
export type Campaign = z.infer<typeof selectCampaignSchema>;
export type EmailTemplate = z.infer<typeof selectEmailTemplateSchema>;
export type NewEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;
export type Session = z.infer<typeof selectSessionSchema>;
export type AuditLog = z.infer<typeof selectAuditLogSchema>;
export type AnalyticsEvent = z.infer<typeof selectAnalyticsEventSchema>;