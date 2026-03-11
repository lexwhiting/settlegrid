import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  smallint,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Developers ────────────────────────────────────────────────────────────────

export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
  tier: text('tier').notNull().default('standard'), // 'standard' | 'enterprise'
  revenueSharePct: integer('revenue_share_pct').notNull().default(85), // 85 = developer keeps 85%
  stripeConnectId: text('stripe_connect_id'),
  stripeConnectStatus: text('stripe_connect_status').notNull().default('not_started'),
  stripeSubscriptionId: text('stripe_subscription_id'), // Enterprise tier subscription
  apiKeyHash: text('api_key_hash'),
  balanceCents: integer('balance_cents').notNull().default(0),
  payoutSchedule: text('payout_schedule').notNull().default('monthly'),
  payoutMinimumCents: integer('payout_minimum_cents').notNull().default(2500),
  // R9: Developer Public Profiles
  publicProfile: boolean('public_profile').notNull().default(false),
  publicBio: text('public_bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const developersRelations = relations(developers, ({ many }) => ({
  tools: many(tools),
  payouts: many(payouts),
  webhookEndpoints: many(webhookEndpoints),
  auditLogs: many(auditLogs),
}))

// ─── Tools ─────────────────────────────────────────────────────────────────────

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  developerId: uuid('developer_id')
    .notNull()
    .references(() => developers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  pricingConfig: jsonb('pricing_config'),
  status: text('status').notNull().default('draft'),
  totalInvocations: integer('total_invocations').notNull().default(0),
  totalRevenueCents: integer('total_revenue_cents').notNull().default(0),
  // R7: Tool Categories & Directory
  category: text('category'), // e.g. 'data', 'nlp', 'image', 'code', 'search', 'finance'
  tags: jsonb('tags').default('[]'), // string[]
  // R10: Tool Versioning
  currentVersion: text('current_version').notNull().default('1.0.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const toolsRelations = relations(tools, ({ one, many }) => ({
  developer: one(developers, {
    fields: [tools.developerId],
    references: [developers.id],
  }),
  consumerToolBalances: many(consumerToolBalances),
  apiKeys: many(apiKeys),
  invocations: many(invocations),
  purchases: many(purchases),
  reviews: many(toolReviews),
  changelogs: many(toolChangelogs),
}))

// ─── Consumers ─────────────────────────────────────────────────────────────────

export const consumers = pgTable('consumers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const consumersRelations = relations(consumers, ({ many }) => ({
  consumerToolBalances: many(consumerToolBalances),
  apiKeys: many(apiKeys),
  invocations: many(invocations),
  purchases: many(purchases),
  reviews: many(toolReviews),
}))

// ─── Consumer Tool Balances ────────────────────────────────────────────────────

export const consumerToolBalances = pgTable('consumer_tool_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  consumerId: uuid('consumer_id')
    .notNull()
    .references(() => consumers.id, { onDelete: 'cascade' }),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  balanceCents: integer('balance_cents').notNull().default(0),
  autoRefill: boolean('auto_refill').notNull().default(false),
  autoRefillAmountCents: integer('auto_refill_amount_cents').notNull().default(2000),
  autoRefillThresholdCents: integer('auto_refill_threshold_cents').notNull().default(500),
  // R4: Consumer Budget Controls
  spendingLimitCents: integer('spending_limit_cents'), // null = unlimited
  spendingLimitPeriod: text('spending_limit_period'), // 'daily' | 'weekly' | 'monthly'
  currentPeriodSpendCents: integer('current_period_spend_cents').notNull().default(0),
  periodResetAt: timestamp('period_reset_at', { withTimezone: true }),
  alertAtPct: integer('alert_at_pct'), // e.g. 80 = alert at 80% of limit
})

export const consumerToolBalancesRelations = relations(consumerToolBalances, ({ one }) => ({
  consumer: one(consumers, {
    fields: [consumerToolBalances.consumerId],
    references: [consumers.id],
  }),
  tool: one(tools, {
    fields: [consumerToolBalances.toolId],
    references: [tools.id],
  }),
}))

// ─── API Keys ──────────────────────────────────────────────────────────────────

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  consumerId: uuid('consumer_id')
    .notNull()
    .references(() => consumers.id, { onDelete: 'cascade' }),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull(),
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
  status: text('status').notNull().default('active'),
  // R1: Sandbox/Test Mode
  isTestKey: boolean('is_test_key').notNull().default(false),
  // R6: IP Allowlisting
  ipAllowlist: jsonb('ip_allowlist'), // string[] of IPs/CIDRs, null = unrestricted
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  consumer: one(consumers, {
    fields: [apiKeys.consumerId],
    references: [consumers.id],
  }),
  tool: one(tools, {
    fields: [apiKeys.toolId],
    references: [tools.id],
  }),
  invocations: many(invocations),
}))

// ─── Invocations ───────────────────────────────────────────────────────────────

export const invocations = pgTable('invocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  consumerId: uuid('consumer_id')
    .notNull()
    .references(() => consumers.id, { onDelete: 'cascade' }),
  apiKeyId: uuid('api_key_id')
    .notNull()
    .references(() => apiKeys.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  costCents: integer('cost_cents').notNull(),
  latencyMs: integer('latency_ms'),
  status: text('status').notNull().default('success'),
  // R1: Sandbox flag
  isTest: boolean('is_test').notNull().default(false),
  // R5: Custom metadata
  metadata: jsonb('metadata'), // max 1KB, developer-defined
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invocationsRelations = relations(invocations, ({ one }) => ({
  tool: one(tools, {
    fields: [invocations.toolId],
    references: [tools.id],
  }),
  consumer: one(consumers, {
    fields: [invocations.consumerId],
    references: [consumers.id],
  }),
  apiKey: one(apiKeys, {
    fields: [invocations.apiKeyId],
    references: [apiKeys.id],
  }),
}))

// ─── Purchases ─────────────────────────────────────────────────────────────────

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  consumerId: uuid('consumer_id')
    .notNull()
    .references(() => consumers.id, { onDelete: 'cascade' }),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull(),
  stripeSessionId: text('stripe_session_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const purchasesRelations = relations(purchases, ({ one }) => ({
  consumer: one(consumers, {
    fields: [purchases.consumerId],
    references: [consumers.id],
  }),
  tool: one(tools, {
    fields: [purchases.toolId],
    references: [tools.id],
  }),
}))

// ─── Payouts ───────────────────────────────────────────────────────────────────

export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  developerId: uuid('developer_id')
    .notNull()
    .references(() => developers.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull(),
  platformFeeCents: integer('platform_fee_cents').notNull(),
  stripeTransferId: text('stripe_transfer_id'),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const payoutsRelations = relations(payouts, ({ one }) => ({
  developer: one(developers, {
    fields: [payouts.developerId],
    references: [developers.id],
  }),
}))

// ─── Webhook Endpoints ────────────────────────────────────────────────────────

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  developerId: uuid('developer_id')
    .notNull()
    .references(() => developers.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: jsonb('events').notNull().default('["invocation.completed","payout.initiated","tool.status_changed"]'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  developer: one(developers, {
    fields: [webhookEndpoints.developerId],
    references: [developers.id],
  }),
  deliveries: many(webhookDeliveries),
}))

// ─── Webhook Deliveries ───────────────────────────────────────────────────────

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id')
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'),
  httpStatus: integer('http_status'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}))

// ─── Audit Logs (R3) ─────────────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  developerId: uuid('developer_id').references(() => developers.id, { onDelete: 'set null' }),
  consumerId: uuid('consumer_id').references(() => consumers.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // e.g. 'tool.created', 'key.revoked', 'payout.triggered'
  resourceType: text('resource_type').notNull(), // 'tool' | 'apiKey' | 'webhook' | 'payout' | 'settings'
  resourceId: text('resource_id'), // UUID of affected resource
  details: jsonb('details'), // additional context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  developer: one(developers, {
    fields: [auditLogs.developerId],
    references: [developers.id],
  }),
  consumer: one(consumers, {
    fields: [auditLogs.consumerId],
    references: [consumers.id],
  }),
}))

// ─── Tool Reviews (R8) ───────────────────────────────────────────────────────

export const toolReviews = pgTable('tool_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  consumerId: uuid('consumer_id')
    .notNull()
    .references(() => consumers.id, { onDelete: 'cascade' }),
  rating: smallint('rating').notNull(), // 1-5
  comment: text('comment'), // max 1000 chars
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const toolReviewsRelations = relations(toolReviews, ({ one }) => ({
  tool: one(tools, {
    fields: [toolReviews.toolId],
    references: [tools.id],
  }),
  consumer: one(consumers, {
    fields: [toolReviews.consumerId],
    references: [consumers.id],
  }),
}))

// ─── Tool Changelogs (R10) ───────────────────────────────────────────────────

export const toolChangelogs = pgTable('tool_changelogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id')
    .notNull()
    .references(() => tools.id, { onDelete: 'cascade' }),
  version: text('version').notNull(), // e.g. '1.1.0'
  changeType: text('change_type').notNull(), // 'major' | 'minor' | 'patch'
  summary: text('summary').notNull(), // e.g. 'Added new endpoint for batch processing'
  details: jsonb('details'), // structured change details
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const toolChangelogsRelations = relations(toolChangelogs, ({ one }) => ({
  tool: one(tools, {
    fields: [toolChangelogs.toolId],
    references: [tools.id],
  }),
}))
