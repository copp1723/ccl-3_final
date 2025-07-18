import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, varchar, serial, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const agentTypeEnum = pgEnum('agent_type', ['overlord', 'email', 'sms', 'chat']);

// Clients table for white-label support
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }),
  settings: jsonb('settings'), // Stores branding config
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Users table (existing, adding clientId)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('user'),
  clientId: uuid('client_id').references(() => clients.id),
  active: boolean('active').default(true),
  passwordHash: varchar('password_hash', { length: 255 }),
  username: varchar('username', { length: 255 }).unique(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Define lead status enum to match the database
export const leadStatusEnum = pgEnum('lead_status', ['new', 'contacted', 'qualified', 'sent_to_boberdoo', 'rejected', 'archived']);
export const channelEnum = pgEnum('channel', ['email', 'sms', 'chat']);

// Leads table (matches actual database structure)
export const leads = pgTable('leads', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  source: text('source').notNull(),
  campaign: text('campaign'), // Original column
  status: leadStatusEnum('status').default('new').notNull(),
  assignedChannel: channelEnum('assigned_channel'),
  qualificationScore: integer('qualification_score').default(0),
  metadata: jsonb('metadata').default({}),
  boberdooId: text('boberdoo_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by'),
  campaignId: text('campaign_id'), // Added column
  clientId: uuid('client_id').references(() => clients.id)
});

// Agent configurations (matches actual database structure)
export const agentConfigurations = pgTable('agent_configurations', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  type: agentTypeEnum('type').notNull(),
  role: text('role').notNull(),
  endGoal: text('end_goal').notNull(),
  instructions: jsonb('instructions').notNull(),
  domainExpertise: jsonb('domain_expertise').default([]).notNull(),
  personality: text('personality').notNull(),
  tone: text('tone').notNull(),
  responseLength: text('response_length').default('medium'),
  apiModel: text('api_model'),
  temperature: integer('temperature').default(70),
  maxTokens: integer('max_tokens').default(500),
  active: boolean('active').default(true).notNull(),
  performance: jsonb('performance').default({"conversations":0,"successfulOutcomes":0,"averageResponseTime":0}),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by'),
  clientId: uuid('client_id').references(() => clients.id)
});

// Campaigns (matches actual database structure)
export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  goals: jsonb('goals').default([]).notNull(),
  qualificationCriteria: jsonb('qualification_criteria').notNull(),
  channelPreferences: jsonb('channel_preferences').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by'),
  handoverCriteria: jsonb('handover_criteria'),
  selectedLeads: jsonb('selected_leads'),
  clientId: uuid('client_id').references(() => clients.id)
});

// Communications (matches actual database structure)
export const communications = pgTable('communications', {
  id: text('id').primaryKey().notNull(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  channel: channelEnum('channel').notNull(),
  direction: text('direction').notNull(),
  content: text('content').notNull(),
  status: text('status').default('pending').notNull(),
  externalId: text('external_id'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  clientId: uuid('client_id').references(() => clients.id)
});

// Agent Decisions (matches actual database structure)
export const agentDecisions = pgTable('agent_decisions', {
  id: text('id').primaryKey().notNull(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  agentType: agentTypeEnum('agent_type').notNull(),
  decision: text('decision').notNull(),
  reasoning: text('reasoning'),
  context: jsonb('context').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Conversations (matches actual database structure)
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey().notNull(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  channel: channelEnum('channel').notNull(),
  agentType: agentTypeEnum('agent_type').notNull(),
  messages: jsonb('messages').default([]).notNull(),
  status: text('status').default('active').notNull(),
  crossChannelContext: jsonb('cross_channel_context').default({}),
  currentQualificationScore: integer('current_qualification_score').default(0),
  goalProgress: jsonb('goal_progress').default({}),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at')
});

// Email Templates
export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 50 }).default('marketing'),
  active: boolean('active').default(true),
  category: varchar('category', { length: 100 }),
  campaignId: text('campaign_id'),
  agentId: text('agent_id'),
  plainText: text('plain_text'),
  variables: jsonb('variables').default({}),
  performance: jsonb('performance').default({}),
  clientId: uuid('client_id').references(() => clients.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  token: varchar('token', { length: 255 }).notNull(),
  refreshToken: varchar('refresh_token', { length: 255 }).unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: varchar('resource_id', { length: 255 }),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow()
});

// Analytics Events
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  value: integer('value').default(1),
  leadId: text('lead_id').references(() => leads.id),
  properties: jsonb('properties'),
  userId: uuid('user_id').references(() => users.id),
  sessionId: varchar('session_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow()
});

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  users: many(users),
  leads: many(leads),
  agentConfigurations: many(agentConfigurations),
  campaigns: many(campaigns),
  communications: many(communications)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  client: one(clients, {
    fields: [users.clientId],
    references: [clients.id]
  }),
  createdCampaigns: many(campaigns)
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  client: one(clients, {
    fields: [leads.clientId],
    references: [clients.id]
  }),
  communications: many(communications),
  agentDecisions: many(agentDecisions),
  conversations: many(conversations)
}));

export const agentConfigurationsRelations = relations(agentConfigurations, ({ one }) => ({
  client: one(clients, {
    fields: [agentConfigurations.clientId],
    references: [clients.id]
  })
}));

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  client: one(clients, {
    fields: [campaigns.clientId],
    references: [clients.id]
  })
}));

export const communicationsRelations = relations(communications, ({ one }) => ({
  lead: one(leads, {
    fields: [communications.leadId],
    references: [leads.id]
  }),
  client: one(clients, {
    fields: [communications.clientId],
    references: [clients.id]
  })
}));

export const agentDecisionsRelations = relations(agentDecisions, ({ one }) => ({
  lead: one(leads, {
    fields: [agentDecisions.leadId],
    references: [leads.id]
  })
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  lead: one(leads, {
    fields: [conversations.leadId],
    references: [leads.id]
  })
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  client: one(clients, {
    fields: [emailTemplates.clientId],
    references: [clients.id]
  })
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id]
  })
}));

// Type definitions
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type AgentConfiguration = typeof agentConfigurations.$inferSelect;
export type NewAgentConfiguration = typeof agentConfigurations.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Communication = typeof communications.$inferSelect;
export type NewCommunication = typeof communications.$inferInsert;
export type AgentDecision = typeof agentDecisions.$inferSelect;
export type NewAgentDecision = typeof agentDecisions.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;