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
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Leads table (existing, adding clientId)
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  status: varchar('status', { length: 50 }).default('new'),
  source: varchar('source', { length: 100 }),
  clientId: uuid('client_id').references(() => clients.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Agent configurations (existing, adding clientId)
export const agentConfigurations = pgTable('agent_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  role: text('role'),
  endGoal: text('end_goal'),
  instructions: jsonb('instructions'),
  domainExpertise: jsonb('domain_expertise'),
  personality: varchar('personality', { length: 50 }),
  tone: varchar('tone', { length: 50 }),
  responseLength: varchar('response_length', { length: 20 }),
  temperature: integer('temperature').default(70),
  maxTokens: integer('max_tokens').default(500),
  clientId: uuid('client_id').references(() => clients.id),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Campaigns (existing, adding clientId)
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('draft'),
  settings: jsonb('settings'),
  clientId: uuid('client_id').references(() => clients.id),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Communications (existing, adding clientId)
export const communications = pgTable('communications', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id),
  type: varchar('type', { length: 50 }).notNull(),
  direction: varchar('direction', { length: 20 }).notNull(),
  content: text('content'),
  status: varchar('status', { length: 50 }).default('sent'),
  clientId: uuid('client_id').references(() => clients.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow()
});

// Agent Decisions
export const agentDecisions = pgTable('agent_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id),
  agentType: agentTypeEnum('agent_type').notNull(),
  decision: text('decision').notNull(),
  reasoning: text('reasoning'),
  context: jsonb('context'),
  createdAt: timestamp('created_at').defaultNow()
});

// Conversations
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Email Templates
export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 50 }).default('marketing'),
  active: boolean('active').default(true),
  clientId: uuid('client_id').references(() => clients.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  token: varchar('token', { length: 255 }).notNull(),
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
  assignedLeads: many(leads),
  createdCampaigns: many(campaigns)
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  client: one(clients, {
    fields: [leads.clientId],
    references: [clients.id]
  }),
  assignedUser: one(users, {
    fields: [leads.assignedTo],
    references: [users.id]
  }),
  communications: many(communications)
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
  }),
  creator: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id]
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