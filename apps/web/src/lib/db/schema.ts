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
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { relations, sql, desc } from 'drizzle-orm'

// ─── Developers ────────────────────────────────────────────────────────────────

export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  slug: text('slug').unique(), // vanity URL slug, e.g., 'lexwhiting'
  supabaseUserId: text('supabase_user_id').unique(),
  passwordHash: text('password_hash'),
  tier: text('tier').notNull().default('standard'), // 'standard' | 'builder' | 'scale' | 'enterprise' (legacy: 'starter' | 'growth' may exist for migrated users — treat as 'builder')
  stripeConnectId: text('stripe_connect_id'),
  stripeConnectStatus: text('stripe_connect_status').notNull().default('not_started'),
  stripeCustomerId: text('stripe_customer_id'), // Stripe Customer for subscription billing
  stripeSubscriptionId: text('stripe_subscription_id'), // Plan subscription
  balanceCents: integer('balance_cents').notNull().default(0),
  payoutSchedule: text('payout_schedule').notNull().default('monthly'),
  payoutMinimumCents: integer('payout_minimum_cents').notNull().default(2500), // $25 default; Stripe per-payout fees (≈$0.25 + 0.25%) erode small amounts. Per-dev tunable down to $1.
  // Notification preferences — { eventType: boolean } pairs
  notificationPreferences: jsonb('notification_preferences').notNull().default('{}'),
  // Notification webhooks — { slack?: string, discord?: string }
  notificationWebhooks: jsonb('notification_webhooks').notNull().default('{}'),
  // Data retention preferences (defaults must match API-enforced minimums)
  logRetentionDays: integer('log_retention_days').notNull().default(90),
  webhookLogRetentionDays: integer('webhook_log_retention_days').notNull().default(7),
  auditLogRetentionDays: integer('audit_log_retention_days').notNull().default(90),
  // R9: Developer Public Profiles
  publicProfile: boolean('public_profile').notNull().default(false),
  publicBio: text('public_bio'),
  avatarUrl: text('avatar_url'),
  // Signup referral credits (Dropbox model — 5k bonus ops per invite)
  inviteCode: text('invite_code').unique(), // format: inv_{12 hex chars}
  referredByDeveloperId: uuid('referred_by_developer_id'), // FK intentionally omitted to avoid circular ref during insert
  bonusOpsBalance: integer('bonus_ops_balance').notNull().default(0), // cumulative bonus ops from referrals
  // Founding Member program — first 100 developers get lifetime free tier
  isFoundingMember: boolean('is_founding_member').notNull().default(false),
  foundingMemberAt: timestamp('founding_member_at', { withTimezone: true }),
  // P3.RAIL3 — chargeback velocity auto-pause. Set TRUE by the
  // chargeback-velocity job when a developer crosses the red tier
  // (>0.5% chargeback rate). Reversible via the founder admin
  // unpause action; existing tools keep running, only NEW onboarding
  // is blocked.
  onboardingPaused: boolean('onboarding_paused').notNull().default(false),
  onboardingPausedAt: timestamp('onboarding_paused_at', { withTimezone: true }),
  onboardingPausedReason: text('onboarding_paused_reason'),
  // P3.RAIL3 — payout-schedule TTL cache. The /dashboard/payouts page
  // reads from the local cache when this timestamp is < 1h old; on
  // staler cache it refreshes from Stripe.
  payoutScheduleSyncedAt: timestamp('payout_schedule_synced_at', { withTimezone: true }),
  payoutScheduleWeekday: text('payout_schedule_weekday'),
  payoutScheduleMonthDay: integer('payout_schedule_month_day'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('developers_slug_idx').on(table.slug),
  uniqueIndex('developers_invite_code_idx').on(table.inviteCode),
  // P3.RAIL3 — chargeback-watch admin page filters by paused flag.
  index('developers_onboarding_paused_idx').on(table.onboardingPaused),
])

export const developersRelations = relations(developers, ({ many }) => ({
  tools: many(tools),
  payouts: many(payouts),
  webhookEndpoints: many(webhookEndpoints),
  auditLogs: many(auditLogs),
  achievements: many(achievements),
  developerApiKeys: many(developerApiKeys),
}))

// ─── Tools ─────────────────────────────────────────────────────────────────────

export const tools = pgTable(
  'tools',
  {
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
    // Tool type: what kind of service this is
    toolType: text('tool_type').notNull().default('mcp-server'), // 'mcp-server' | 'ai-model' | 'rest-api' | 'agent-tool' | 'automation' | 'extension' | 'dataset' | 'sdk-package'
    // Source ecosystem: where this tool was crawled from (null if manually registered)
    sourceEcosystem: text('source_ecosystem'), // 'mcp-registry' | 'pulsemcp' | 'smithery' | 'npm' | 'pypi' | 'huggingface' | 'replicate' | 'apify' | 'openrouter' | 'github' | null
    // R7: Tool Categories & Directory
    category: text('category'), // e.g. 'data', 'nlp', 'image', 'code', 'search', 'finance'
    tags: jsonb('tags').default('[]'), // string[]
    // R10: Tool Versioning
    currentVersion: text('current_version').notNull().default('1.0.0'),
    // S4: Health Check Endpoint
    healthEndpoint: text('health_endpoint'), // URL to ping for health checks
    // Smart Proxy: the actual tool URL that the proxy forwards requests to
    proxyEndpoint: text('proxy_endpoint'),
    // Claim Your Listing: source repo and claim flow fields
    sourceRepoUrl: text('source_repo_url'), // GitHub repo URL the tool was crawled from
    claimToken: text('claim_token'), // Unique token for claiming this tool
    claimEmailSentAt: timestamp('claim_email_sent_at', { withTimezone: true }), // When claim email was sent
    claimFollowUpCount: integer('claim_follow_up_count').notNull().default(0), // Number of follow-up emails sent (0-3)
    lastFollowUpAt: timestamp('last_follow_up_at', { withTimezone: true }), // When last follow-up email was sent
    // Enrichment metadata from crawlers (popularity, stars, license, etc.)
    crawlMetadata: jsonb('crawl_metadata'),
    // Premium templates: gated behind one-time purchase
    isPremium: boolean('is_premium').notNull().default(false),
    premiumPriceCents: integer('premium_price_cents'), // one-time price for premium templates
    // Quality gate: set to true after first real (non-test) invocation
    verified: boolean('verified').notNull().default(false),
    // Manual escalation: timestamp of most recent report
    reportedAt: timestamp('reported_at', { withTimezone: true }),
    // P2.INTL2: marketplace visibility for claimed-but-unpublished tools.
    // Defaults true on new rows so claim transitions preserve visibility.
    // Migration backfills existing 'draft' rows to false (don't retroactively
    // expose existing developers' in-progress drafts). Only consulted when
    // status='draft' — 'unclaimed' and 'active' tools are always in the
    // marketplace regardless of this flag.
    listedInMarketplace: boolean('listed_in_marketplace').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tools_developer_id_idx').on(table.developerId),
    index('tools_status_idx').on(table.status),
    index('tools_category_idx').on(table.category),
    index('tools_tool_type_idx').on(table.toolType),
    index('tools_source_ecosystem_idx').on(table.sourceEcosystem),
    index('tools_claim_token_idx').on(table.claimToken),
  ]
)

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
  supabaseUserId: text('supabase_user_id').unique(),
  passwordHash: text('password_hash'),
  stripeCustomerId: text('stripe_customer_id'),
  // S5: Auto-Refill default payment method
  defaultPaymentMethodId: text('default_payment_method_id'),
  // Consumer Referral Program
  referralCode: text('referral_code').unique(), // format: ref_{12 hex chars}
  referredByConsumerId: uuid('referred_by_consumer_id'), // FK intentionally omitted to avoid circular ref
  // Global Balance (Volume Discount Credit Packs)
  globalBalanceCents: integer('global_balance_cents').notNull().default(0),
  // Auto-refill configuration for global balance
  autoRefillPackId: text('auto_refill_pack_id'), // pack_20 | pack_100 | pack_500 | pack_1000
  autoRefillTriggerCents: integer('auto_refill_trigger_cents'), // trigger when balance drops below this
  // Newsletter subscription
  newsletterSubscribed: boolean('newsletter_subscribed').notNull().default(true),
  newsletterFrequency: text('newsletter_frequency').notNull().default('weekly'), // 'weekly' | 'monthly'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('consumers_referral_code_idx').on(table.referralCode),
])

export const consumersRelations = relations(consumers, ({ many }) => ({
  consumerToolBalances: many(consumerToolBalances),
  apiKeys: many(apiKeys),
  invocations: many(invocations),
  purchases: many(purchases),
  reviews: many(toolReviews),
}))

// ─── Consumer Tool Balances ────────────────────────────────────────────────────

export const consumerToolBalances = pgTable(
  'consumer_tool_balances',
  {
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ctb_consumer_id_idx').on(table.consumerId),
    index('ctb_tool_id_idx').on(table.toolId),
    uniqueIndex('ctb_consumer_tool_idx').on(table.consumerId, table.toolId),
  ]
)

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

export const apiKeys = pgTable(
  'api_keys',
  {
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
  },
  (table) => [
    index('api_keys_consumer_id_idx').on(table.consumerId),
    index('api_keys_tool_id_idx').on(table.toolId),
    uniqueIndex('api_keys_key_hash_idx').on(table.keyHash),
  ]
)

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

// ─── Developer API Keys ──────────────────────────────────────────────────────
// Publisher-side API keys for programmatic tool publishing via
// PUT /api/tools/publish. Mirrors the consumer `apiKeys` table but keyed to a
// developer (multiple keys per developer, soft-revoke, prefix + last-used
// metadata). Replaces the unused single `developers.apiKeyHash` column.

export const developerApiKeys = pgTable(
  'developer_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    developerId: uuid('developer_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull(),
    keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
    label: text('label'), // optional user-supplied name
    status: text('status').notNull().default('active'), // 'active' | 'revoked'
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('developer_api_keys_developer_id_idx').on(table.developerId),
    uniqueIndex('developer_api_keys_key_hash_idx').on(table.keyHash),
  ]
)

export const developerApiKeysRelations = relations(developerApiKeys, ({ one }) => ({
  developer: one(developers, {
    fields: [developerApiKeys.developerId],
    references: [developers.id],
  }),
}))

// ─── Invocations ───────────────────────────────────────────────────────────────

export const invocations = pgTable(
  'invocations',
  {
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
    // R11: Usage Fingerprinting
    sessionId: text('session_id'), // tracks session context
    referralCode: text('referral_code'), // tracks referral source
    // Fraud detection flag
    isFlagged: boolean('is_flagged').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('invocations_tool_id_idx').on(table.toolId),
    index('invocations_consumer_id_idx').on(table.consumerId),
    index('invocations_api_key_id_idx').on(table.apiKeyId),
    index('invocations_created_at_idx').on(table.createdAt),
    index('invocations_tool_created_idx').on(table.toolId, table.createdAt),
  ]
)

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

export const purchases = pgTable(
  'purchases',
  {
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
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('purchases_consumer_id_idx').on(table.consumerId),
    index('purchases_tool_id_idx').on(table.toolId),
    index('purchases_stripe_session_idx').on(table.stripeSessionId),
  ]
)

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

export const payouts = pgTable(
  'payouts',
  {
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
    // Payout safety: error message for failed payouts
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('payouts_developer_id_idx').on(table.developerId),
    index('payouts_status_idx').on(table.status),
  ]
)

export const payoutsRelations = relations(payouts, ({ one }) => ({
  developer: one(developers, {
    fields: [payouts.developerId],
    references: [developers.id],
  }),
}))

// ─── Webhook Endpoints ────────────────────────────────────────────────────────

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    developerId: uuid('developer_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    events: jsonb('events').notNull().default('["invocation.completed","payout.initiated","tool.status_changed"]'),
    /** Custom headers merged into webhook deliveries. Scale+ feature. */
    customHeaders: jsonb('custom_headers'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('webhook_endpoints_developer_id_idx').on(table.developerId),
  ]
)

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  developer: one(developers, {
    fields: [webhookEndpoints.developerId],
    references: [developers.id],
  }),
  deliveries: many(webhookDeliveries),
}))

// ─── Webhook Deliveries ───────────────────────────────────────────────────────

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
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
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('webhook_deliveries_endpoint_id_idx').on(table.endpointId),
    index('webhook_deliveries_status_idx').on(table.status),
    index('webhook_deliveries_next_retry_idx').on(table.nextRetryAt),
  ]
)

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}))

// ─── Audit Logs (R3) ─────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
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
  },
  (table) => [
    index('audit_logs_developer_id_idx').on(table.developerId),
    index('audit_logs_consumer_id_idx').on(table.consumerId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ]
)

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

export const toolReviews = pgTable(
  'tool_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(), // 1-5
    comment: text('comment'), // max 1000 chars
    developerResponse: text('developer_response'), // max 1000 chars
    developerRespondedAt: timestamp('developer_responded_at', { withTimezone: true }),
    reportedAt: timestamp('reported_at', { withTimezone: true }),
    status: text('status').notNull().default('visible'), // 'visible' | 'hidden' | 'removed'
    hideReason: text('hide_reason'), // 'profanity' | 'spam' | 'off_topic' | 'abuse' | 'admin'
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tool_reviews_tool_id_idx').on(table.toolId),
    index('tool_reviews_consumer_id_idx').on(table.consumerId),
    uniqueIndex('tool_reviews_tool_consumer_idx').on(table.toolId, table.consumerId),
  ]
)

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

export const toolChangelogs = pgTable(
  'tool_changelogs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    version: text('version').notNull(), // e.g. '1.1.0'
    changeType: text('change_type').notNull(), // 'major' | 'minor' | 'patch'
    summary: text('summary').notNull(), // e.g. 'Added new endpoint for batch processing'
    details: jsonb('details'), // structured change details
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tool_changelogs_tool_id_idx').on(table.toolId),
  ]
)

export const toolChangelogsRelations = relations(toolChangelogs, ({ one }) => ({
  tool: one(tools, {
    fields: [toolChangelogs.toolId],
    references: [tools.id],
  }),
}))

// ─── Conversion Events (R12) ────────────────────────────────────────────────

export const conversionEvents = pgTable(
  'conversion_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    event: text('event').notNull(), // 'free_trial' | 'upgrade' | 'downgrade' | 'churn'
    fromTier: text('from_tier'),
    toTier: text('to_tier'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('conversion_events_tool_id_idx').on(table.toolId),
    index('conversion_events_consumer_id_idx').on(table.consumerId),
  ]
)

export const conversionEventsRelations = relations(conversionEvents, ({ one }) => ({
  tool: one(tools, {
    fields: [conversionEvents.toolId],
    references: [tools.id],
  }),
  consumer: one(consumers, {
    fields: [conversionEvents.consumerId],
    references: [consumers.id],
  }),
}))

// ─── Consumer Alerts (R14) ──────────────────────────────────────────────────

export const consumerAlerts = pgTable(
  'consumer_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    alertType: text('alert_type').notNull(), // 'low_balance' | 'budget_exceeded' | 'usage_spike'
    threshold: integer('threshold').notNull(), // e.g. balance in cents or invocation count
    channel: text('channel').notNull().default('email'), // 'email' | 'webhook'
    status: text('status').notNull().default('active'), // 'active' | 'paused'
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('consumer_alerts_consumer_id_idx').on(table.consumerId),
    index('consumer_alerts_tool_id_idx').on(table.toolId),
    index('consumer_alerts_status_idx').on(table.status),
  ]
)

export const consumerAlertsRelations = relations(consumerAlerts, ({ one }) => ({
  consumer: one(consumers, {
    fields: [consumerAlerts.consumerId],
    references: [consumers.id],
  }),
  tool: one(tools, {
    fields: [consumerAlerts.toolId],
    references: [tools.id],
  }),
}))

// ─── Tool Health Checks (R16) ───────────────────────────────────────────────

export const toolHealthChecks = pgTable(
  'tool_health_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // 'up' | 'down' | 'degraded'
    responseTimeMs: integer('response_time_ms'),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tool_health_checks_tool_id_idx').on(table.toolId),
    index('tool_health_checks_checked_at_idx').on(table.checkedAt),
  ]
)

export const toolHealthChecksRelations = relations(toolHealthChecks, ({ one }) => ({
  tool: one(tools, {
    fields: [toolHealthChecks.toolId],
    references: [tools.id],
  }),
}))

// ─── Referrals (R17) ────────────────────────────────────────────────────────

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    referredToolId: uuid('referred_tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    referralCode: text('referral_code').notNull().unique(),
    commissionPct: integer('commission_pct').notNull().default(10), // 10 = 10%
    totalEarnedCents: integer('total_earned_cents').notNull().default(0),
    status: text('status').notNull().default('active'), // 'active' | 'revoked'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('referrals_referrer_id_idx').on(table.referrerId),
  ]
)

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(developers, {
    fields: [referrals.referrerId],
    references: [developers.id],
  }),
  referredTool: one(tools, {
    fields: [referrals.referredToolId],
    references: [tools.id],
  }),
}))

// ─── Signup Invites (Developer-level referral credits) ─────────────────────

export const signupInvites = pgTable(
  'signup_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    bonusOps: integer('bonus_ops').notNull().default(5000), // ops credited to each party
    inviterCredited: boolean('inviter_credited').notNull().default(false),
    inviteeCredited: boolean('invitee_credited').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('signup_invites_inviter_id_idx').on(table.inviterId),
    index('signup_invites_invitee_id_idx').on(table.inviteeId),
    uniqueIndex('signup_invites_invitee_unique_idx').on(table.inviteeId), // each developer can only be invited once
  ]
)

export const signupInvitesRelations = relations(signupInvites, ({ one }) => ({
  inviter: one(developers, {
    fields: [signupInvites.inviterId],
    references: [developers.id],
  }),
  invitee: one(developers, {
    fields: [signupInvites.inviteeId],
    references: [developers.id],
  }),
}))

// ─── Developer Reputation (R20) ─────────────────────────────────────────────

export const developerReputation = pgTable(
  'developer_reputation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    developerId: uuid('developer_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    score: integer('score').notNull().default(50), // 0-100
    responseTimePct: integer('response_time_pct').notNull().default(0), // percentile
    uptimePct: integer('uptime_pct').notNull().default(100), // percentage
    reviewAvg: integer('review_avg').notNull().default(0), // avg rating * 100 (e.g. 450 = 4.50)
    totalTools: integer('total_tools').notNull().default(0),
    totalConsumers: integer('total_consumers').notNull().default(0),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('developer_reputation_developer_id_idx').on(table.developerId),
  ]
)

export const developerReputationRelations = relations(developerReputation, ({ one }) => ({
  developer: one(developers, {
    fields: [developerReputation.developerId],
    references: [developers.id],
  }),
}))

// ─── Waitlist Signups ───────────────────────────────────────────────────────

export const waitlistSignups = pgTable(
  'waitlist_signups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    feature: text('feature').notNull().default('marketplace'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('waitlist_email_feature_idx').on(table.email, table.feature)]
)

// ─── Settlement Layer: Accounts & Ledger ────────────────────────────────────
// NOTE: ledgerEntries.accountId and counterpartyAccountId intentionally lack FK
// references to accounts.id. This avoids row-level lock contention on the accounts
// table during high-throughput ledger writes. Referential integrity is enforced in
// application code (postLedgerEntry validates account existence before inserting).
// Similarly, workflowSessions.parentSessionId omits a self-referential FK —
// delegation tree integrity is enforced by createSession().

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(), // 'provider' | 'customer' | 'platform' | 'escrow'
    entityId: text('entity_id').notNull(), // developer/consumer/system ID
    label: text('label'), // human-readable label
    balanceCents: integer('balance_cents').notNull().default(0),
    pendingDebitCents: integer('pending_debit_cents').notNull().default(0),
    pendingCreditCents: integer('pending_credit_cents').notNull().default(0),
    currencyCode: varchar('currency_code', { length: 3 }).notNull().default('USD'),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_type_idx').on(table.type),
    index('accounts_entity_id_idx').on(table.entityId),
    check('accounts_type_check', sql`${table.type} IN ('provider', 'customer', 'platform', 'escrow')`),
  ]
)

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Dual semantic, PERMANENT (B4, 2026-06-04):
    //   - double-entry rows (rail IS NULL): a real accounts.id
    //     (postLedgerEntry validates existence — see note above).
    //   - SETTLEMENT rows (rail NOT NULL): the OWNING DEVELOPER's id,
    //     NOT an accounts.id. The reconciler credits real money from
    //     this value (reconcile.ts creditSettlement matches
    //     developers.id = account_id), so a "backfill" to accounts.id
    //     would make that UPDATE match zero rows and un-credit
    //     genuinely-collected USDC (loud since B4 — the zero-row check
    //     fires settlement.credit_failed — but still un-credited).
    //     NEVER backfill settlement rows.
    //     See docs/tech-debt/b4-account-attribution-resolution-2026-06-04.md.
    accountId: uuid('account_id').notNull(),
    entryType: text('entry_type').notNull(), // 'debit' | 'credit'
    amountCents: integer('amount_cents').notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).notNull().default('USD'),
    category: text('category').notNull(), // 'metering' | 'purchase' | 'payout' | 'refund' | 'fee' | 'netting' | 'delegation'
    operationId: text('operation_id'), // links to invocation/purchase/payout
    batchId: text('batch_id'), // for netting batches
    counterpartyAccountId: uuid('counterparty_account_id'),
    description: text('description').notNull(),
    metadata: jsonb('metadata'),
    // P2.TAX1 — tax portion of this entry (see Stripe Tax wiring in
    // apps/web/src/lib/stripe-tax.ts). Non-tax entries (metering,
    // payouts, internal transfers) MUST write 0 so reconciliation
    // queries can SUM without coalescing.
    taxCents: integer('tax_cents').notNull().default(0),
    // ISO-3166 alpha-2 country code for non-US; 'US-<state>' (e.g.,
    // 'US-CA') for US. NULL when no tax was collected.
    taxJurisdiction: varchar('tax_jurisdiction', { length: 8 }),
    // ─── P3.K4 unified settlement columns ─────────────────────────
    // All rail adapters write to this single table via
    // packages/mcp/src/ledger.ts's recordLedgerEntry() helper — see
    // apps/web/src/lib/settlement/ledger.ts for the Postgres writer.
    // Columns are nullable so existing double-entry balance rows
    // (which don't carry a rail/protocol/take) continue to work
    // without backfilling.
    sessionId: uuid('session_id'),
    rail: text('rail'),
    protocol: text('protocol'),
    takeBps: integer('take_bps'),
    takeCents: integer('take_cents'),
    settlementStatus: text('settlement_status'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    externalRef: text('external_ref'),
    // ─── P3.K6 authorization gate columns ─────────────────────────
    // `authorizationSignals` is the per-check audit trail produced
    // by `authorizeInvocation()`. Reconciliation + compliance
    // queries read this to demonstrate the gate executed (OFAC
    // strict-liability evidence). The 403 HTTP response body must
    // NOT expose this array (hostile req e); only the top-level
    // denial reason is caller-visible. `authorizationArtifact`
    // is an optional cryptographic approval token returned by
    // external authorization plugins (enterprise policy engines,
    // regulated-industry policy layers).
    authorizationSignals: jsonb('authorization_signals'),
    authorizationArtifact: text('authorization_artifact'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ledger_entries_account_id_idx').on(table.accountId),
    index('ledger_entries_category_idx').on(table.category),
    index('ledger_entries_operation_id_idx').on(table.operationId),
    index('ledger_entries_created_at_idx').on(table.createdAt),
    // P3.K4 — reconciliation queries filter by rail + status so
    // both get an index. session_id gets one too so multi-hop
    // workflow queries stay O(log n).
    index('ledger_entries_rail_idx').on(table.rail),
    index('ledger_entries_settlement_status_idx').on(table.settlementStatus),
    index('ledger_entries_session_id_idx').on(table.sessionId),
    index('ledger_entries_external_ref_idx').on(table.externalRef),
    check('ledger_entries_amount_positive', sql`${table.amountCents} > 0`),
    check('ledger_entries_entry_type_check', sql`${table.entryType} IN ('debit', 'credit')`),
    // P2.TAX1 — tax-cents and jurisdiction are tied: non-zero tax
    // MUST have a jurisdiction recorded, so an auditor can always
    // trace a collected tax amount back to the authority it was
    // collected for.
    check(
      'ledger_entries_tax_jurisdiction_required',
      sql`(${table.taxCents} = 0 AND ${table.taxJurisdiction} IS NULL)
          OR (${table.taxCents} > 0 AND ${table.taxJurisdiction} IS NOT NULL)
          OR (${table.taxCents} = 0 AND ${table.taxJurisdiction} IS NOT NULL)`,
    ),
    // P3.K4 — settlement_status is a closed enum; check constraint
    // enforces the valid values at the DB level so an adapter that
    // forgets to convert its native status can't silently write
    // garbage.
    check(
      'ledger_entries_settlement_status_check',
      sql`${table.settlementStatus} IS NULL OR ${table.settlementStatus} IN (
          'pending', 'settled', 'voided', 'failed', 'reversed'
        )`,
    ),
    // P3.K4 — settlement rows carry a take (platform fee in bps +
    // cents). Enforce the trivial constraints at the DB so a
    // reconciliation SUM cannot return negative / out-of-range
    // values from a single bad row.
    check(
      'ledger_entries_take_bps_range',
      sql`${table.takeBps} IS NULL
          OR (${table.takeBps} >= 0 AND ${table.takeBps} <= 10000)`,
    ),
    check(
      'ledger_entries_take_cents_nonneg',
      sql`${table.takeCents} IS NULL OR ${table.takeCents} >= 0`,
    ),
    // A settled row MUST carry a settledAt timestamp; a non-settled
    // row MUST NOT (matches the shape check in
    // packages/mcp/src/ledger.ts). NULL status is allowed (the
    // legacy double-entry balance rows pre-date P3.K4 and don't
    // populate status at all).
    check(
      'ledger_entries_settled_at_shape',
      sql`(${table.settlementStatus} IS NULL AND ${table.settledAt} IS NULL)
          OR (${table.settlementStatus} = 'settled' AND ${table.settledAt} IS NOT NULL)
          OR (${table.settlementStatus} IS NOT NULL AND ${table.settlementStatus} <> 'settled' AND ${table.settledAt} IS NULL)`,
    ),
  ]
)

// ─── Settlement Layer: Workflow Sessions ─────────────────────────────────────

export const workflowSessions = pgTable(
  'workflow_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: text('customer_id').notNull(),
    parentSessionId: uuid('parent_session_id'),
    budgetCents: integer('budget_cents').notNull(),
    spentCents: integer('spent_cents').notNull().default(0),
    reservedCents: integer('reserved_cents').notNull().default(0),
    status: text('status').notNull().default('active'),
    // 'active' | 'finalizing' | 'settled' | 'completed' | 'failed' | 'expired' | 'cancelled'
    settlementMode: text('settlement_mode').notNull().default('immediate'),
    // 'immediate' | 'deferred' | 'atomic'
    protocol: text('protocol'), // 'mcp' | 'x402' | 'ap2' | 'visa-tap' | 'mpp' | 'ucp' | 'acp' | 'mastercard-vi' | 'circle-nano' | null
    hops: jsonb('hops').notNull().default('[]'),
    // Array<SessionHop> — each service call recorded as a hop
    atomicSettlementId: uuid('atomic_settlement_id'),
    // references settlementBatches.id — no FK to avoid circular
    metadata: jsonb('metadata'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('workflow_sessions_customer_id_idx').on(table.customerId),
    index('workflow_sessions_parent_session_id_idx').on(table.parentSessionId),
    index('workflow_sessions_status_idx').on(table.status),
    index('workflow_sessions_expires_at_idx').on(table.expiresAt),
    index('workflow_sessions_atomic_settlement_idx').on(table.atomicSettlementId),
    index('workflow_sessions_customer_status_idx').on(table.customerId, table.status),
    check('workflow_sessions_budget_positive', sql`${table.budgetCents} > 0`),
    check('workflow_sessions_status_check', sql`${table.status} IN ('active', 'finalizing', 'settled', 'completed', 'failed', 'expired', 'cancelled')`),
  ]
)

// ─── Settlement Batches ──────────────────────────────────────────────────────

export const settlementBatches = pgTable(
  'settlement_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull(),
    // references workflowSessions.id but no FK to avoid circular
    totalAmountCents: integer('total_amount_cents').notNull(),
    platformFeeCents: integer('platform_fee_cents').notNull(),
    status: text('status').notNull().default('pending'),
    // 'pending' | 'processing' | 'completed' | 'failed' | 'rolled_back'
    disbursements: jsonb('disbursements').notNull().default('[]'),
    // Array<SessionDisbursement>
    rollbackReason: text('rollback_reason'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('settlement_batches_session_id_idx').on(table.sessionId),
    index('settlement_batches_status_idx').on(table.status),
  ]
)

// ─── Agent Identities (KYA) ─────────────────────────────────────────────────

export const agentIdentities = pgTable(
  'agent_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: text('provider_id'),
    agentName: text('agent_name').notNull(),
    identityType: text('identity_type').notNull(), // 'api-key' | 'did:key' | 'jwt' | 'x509' | 'tap-token'
    publicKey: text('public_key'),
    fingerprint: text('fingerprint').unique(),
    verificationLevel: text('verification_level').notNull().default('none'), // 'none' | 'basic' | 'business' | 'individual'
    capabilities: jsonb('capabilities'), // { tools, methods, pricing, protocols }
    spendingLimitCents: integer('spending_limit_cents'),
    status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'revoked'
    metadata: jsonb('metadata'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('agent_identities_provider_id_idx').on(table.providerId),
    uniqueIndex('agent_identities_fingerprint_idx').on(table.fingerprint),
    index('agent_identities_identity_type_idx').on(table.identityType),
    index('agent_identities_status_idx').on(table.status),
  ]
)

// ─── Organizations (Phase 5: Enterprise) ────────────────────────────────────

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    plan: text('plan').notNull().default('free'),
      // 'free' | 'builder' | 'scale' | 'enterprise' (legacy: 'starter' | 'growth' may exist for migrated orgs — treat as 'builder')
    billingEmail: text('billing_email').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    settings: jsonb('settings').notNull().default('{}'),
      // { defaultBudgetCents?: number; requireApproval?: boolean;
      //   allowedIps?: string[]; ssoEnabled?: boolean; ssoProvider?: string }
    monthlyBudgetCents: integer('monthly_budget_cents'), // null = unlimited
    currentMonthSpendCents: integer('current_month_spend_cents').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('organizations_slug_idx').on(table.slug),
    index('organizations_plan_idx').on(table.plan),
    check('organizations_plan_check', sql`${table.plan} IN ('free', 'builder', 'starter', 'growth', 'scale', 'enterprise')`),
  ]
)

// ─── Organization Members ───────────────────────────────────────────────────

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    role: text('role').notNull().default('member'),
      // 'owner' | 'admin' | 'member' | 'viewer'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('org_members_org_id_idx').on(table.orgId),
    index('org_members_user_id_idx').on(table.userId),
    uniqueIndex('org_members_org_user_idx').on(table.orgId, table.userId),
  ]
)

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.orgId],
    references: [organizations.id],
  }),
}))

// ─── Cost Allocations ───────────────────────────────────────────────────────

export const costAllocations = pgTable(
  'cost_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    departmentTag: text('department_tag').notNull(),
    serviceId: text('service_id'), // tool slug or null for unattributed
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    totalCents: integer('total_cents').notNull().default(0),
    operationCount: integer('operation_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cost_allocations_org_period_idx').on(table.orgId, table.periodStart),
    index('cost_allocations_dept_idx').on(table.departmentTag),
    index('cost_allocations_org_dept_idx').on(table.orgId, table.departmentTag),
  ]
)

// ─── Compliance Exports ─────────────────────────────────────────────────────

export const complianceExports = pgTable(
  'compliance_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestType: text('request_type').notNull(), // 'data-export' | 'data-deletion'
    entityType: text('entity_type').notNull(), // 'customer' | 'provider'
    entityId: text('entity_id').notNull(),
    status: text('status').notNull().default('pending'),
      // 'pending' | 'processing' | 'completed' | 'failed'
    resultUrl: text('result_url'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('compliance_exports_entity_idx').on(table.entityId, table.entityType),
  ]
)

// ─── Outcome Verifications (Phase 8) ────────────────────────────────────────

export const outcomeVerifications = pgTable(
  'outcome_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invocationId: text('invocation_id').notNull(),
    toolId: text('tool_id').notNull(),
    consumerId: text('consumer_id').notNull(),
    outcomeType: text('outcome_type').notNull(), // 'boolean' | 'score' | 'custom'
    successCriteria: jsonb('success_criteria').notNull(),
    fullPriceCents: integer('full_price_cents').notNull(),
    failurePriceCents: integer('failure_price_cents').notNull().default(0),
    actualOutcome: jsonb('actual_outcome'),
    outcomeScore: integer('outcome_score'), // 0-100 for score-based
    passed: boolean('passed'),
    settledPriceCents: integer('settled_price_cents'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    disputeStatus: text('dispute_status'), // null | 'opened' | 'under_review' | 'resolved_for_consumer' | 'resolved_for_provider'
    disputeReason: text('dispute_reason'),
    disputeResolvedAt: timestamp('dispute_resolved_at', { withTimezone: true }),
    disputeDeadline: timestamp('dispute_deadline', { withTimezone: true }), // 24h from verification
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('outcome_verifications_invocation_id_idx').on(table.invocationId),
    index('outcome_verifications_tool_id_idx').on(table.toolId),
    index('outcome_verifications_consumer_id_idx').on(table.consumerId),
    index('outcome_verifications_dispute_status_idx').on(table.disputeStatus),
  ]
)

// ─── Achievements (Gamification) ─────────────────────────────────────────────

export const achievements = pgTable(
  'achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    developerId: uuid('developer_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    badgeKey: text('badge_key').notNull(), // e.g., 'first_tool', 'first_invocation', 'first_dollar'
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('achievements_developer_id_idx').on(table.developerId),
    uniqueIndex('achievements_dev_badge_idx').on(table.developerId, table.badgeKey),
  ]
)

export const achievementsRelations = relations(achievements, ({ one }) => ({
  developer: one(developers, {
    fields: [achievements.developerId],
    references: [developers.id],
  }),
}))

// ─── Consumer Schedules (Cron-as-a-Service) ──────────────────────────────────

export const consumerSchedules = pgTable(
  'consumer_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consumerId: uuid('consumer_id')
      .notNull()
      .references(() => consumers.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(), // tool slug for display/routing
    method: text('method'), // tool method to invoke (null = default)
    payload: jsonb('payload').notNull().default('{}'), // request payload
    cronExpression: varchar('cron_expression', { length: 50 }).notNull(), // e.g., '0 * * * *' (hourly)
    enabled: boolean('enabled').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    failCount: integer('fail_count').notNull().default(0),
    maxFailures: integer('max_failures').notNull().default(5),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('consumer_schedules_consumer_id_idx').on(table.consumerId),
    index('consumer_schedules_tool_id_idx').on(table.toolId),
    index('consumer_schedules_enabled_next_run_idx').on(table.enabled, table.nextRunAt),
  ]
)

export const consumerSchedulesRelations = relations(consumerSchedules, ({ one }) => ({
  consumer: one(consumers, {
    fields: [consumerSchedules.consumerId],
    references: [consumers.id],
  }),
  tool: one(tools, {
    fields: [consumerSchedules.toolId],
    references: [tools.id],
  }),
}))

// ─── Shadow Index (P2.11) ──────────────────────────────────────────────────────

export const mcpShadowIndex = pgTable(
  'mcp_shadow_index',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(), // 'pulsemcp' | 'smithery' | 'awesome-mcp' | 'github' | 'npm' | 'pypi'
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    tags: jsonb('tags').$type<string[]>(),
    stars: integer('stars'),
    downloads: integer('downloads'),
    lastUpdated: timestamp('last_updated', { withTimezone: true }),
    sourceUrl: text('source_url'),
    settlegridAvailable: boolean('settlegrid_available').notNull().default(true),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('mcp_shadow_source_owner_repo_idx').on(
      table.source,
      table.owner,
      table.repo,
    ),
    index('mcp_shadow_category_idx').on(table.category),
    index('mcp_shadow_last_updated_idx').on(desc(table.lastUpdated)),
  ]
)

/**
 * Consumer-audit #1: Stripe webhook idempotency ledger.
 *
 * Stripe retries webhooks on HTTP errors or if the acknowledgement is
 * slow. Without dedup, a retried `checkout.session.completed` would
 * credit the consumer twice. This table records every processed event
 * ID and is consulted BEFORE any state change so retries become no-ops.
 *
 * `eventId` is the Stripe event ID (e.g., `evt_1OaZ...`), which Stripe
 * guarantees is unique per event. The unique index on that column is
 * load-bearing — the insert-or-conflict pattern in the webhook handler
 * depends on it to detect duplicates atomically.
 */
export const processedWebhookEvents = pgTable(
  'processed_webhook_events',
  {
    eventId: text('event_id').primaryKey(),
    source: text('source').notNull().default('stripe'), // 'stripe' | future providers
    eventType: text('event_type').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('processed_webhook_events_processed_at_idx').on(desc(table.processedAt)),
  ],
)

// ─── P3.RAIL3 — Chargeback velocity alerts ────────────────────────────────────
//
// Each row represents an emitted alert (yellow or red tier) for one
// developer at one point in time. The chargeback-velocity job
// consults this table BEFORE sending a fresh email so a persistently-
// problematic account doesn't receive a notification every cron run
// (hostile (d) — yellow rate-limited 7d, red rate-limited 24h). Rows
// are append-only — a tier escalation from yellow→red is a NEW row,
// not an update; the founder admin page reads the latest row per
// developer.
//
// `details` jsonb captures the velocity computation inputs (charges,
// chargebacks, rate, threshold) so a future audit query can replay
// "what did we know on the day we paused this developer".
//
// `resolvedAt` flips when the founder un-pauses or when the developer
// drops back into green naturally. Audit-trail rather than a soft-
// delete: the row stays.
export const chargebackAlerts = pgTable(
  'chargeback_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    developerId: uuid('developer_id')
      .notNull()
      .references(() => developers.id, { onDelete: 'cascade' }),
    /** 'yellow' | 'red' — green never produces a row. */
    tier: text('tier').notNull(),
    /** chargebacks_count / charges_count, in the rolling 30-day window. */
    rateByCount: text('rate_by_count').notNull(), // stored as decimal string for portability
    /** chargebacks_volume_cents / charges_volume_cents, same window. */
    rateByVolume: text('rate_by_volume').notNull(),
    /** Sample size at the time of the alert. */
    chargesCount: integer('charges_count').notNull(),
    chargebacksCount: integer('chargebacks_count').notNull(),
    chargesVolumeCents: integer('charges_volume_cents').notNull(),
    chargebacksVolumeCents: integer('chargebacks_volume_cents').notNull(),
    /** Was the developer onboarding-paused as part of this alert? Red only. */
    pausedOnboarding: boolean('paused_onboarding').notNull().default(false),
    /** Replay payload — frozen velocity inputs + thresholds. */
    details: jsonb('details'),
    /** Email send status. 'sent' | 'rate_limited' | 'skipped' | 'failed'. */
    emailStatus: text('email_status').notNull().default('skipped'),
    /** Set when the founder un-pauses or the account returns to green. */
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedReason: text('resolved_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('chargeback_alerts_developer_id_idx').on(table.developerId),
    index('chargeback_alerts_tier_idx').on(table.tier),
    index('chargeback_alerts_created_at_idx').on(desc(table.createdAt)),
    check(
      'chargeback_alerts_tier_check',
      sql`${table.tier} IN ('yellow', 'red')`,
    ),
    check(
      'chargeback_alerts_email_status_check',
      sql`${table.emailStatus} IN ('sent', 'rate_limited', 'skipped', 'failed')`,
    ),
    check(
      'chargeback_alerts_counts_nonneg',
      sql`${table.chargesCount} >= 0 AND ${table.chargebacksCount} >= 0
          AND ${table.chargesVolumeCents} >= 0
          AND ${table.chargebacksVolumeCents} >= 0`,
    ),
  ],
)

export const chargebackAlertsRelations = relations(chargebackAlerts, ({ one }) => ({
  developer: one(developers, {
    fields: [chargebackAlerts.developerId],
    references: [developers.id],
  }),
}))

// ─── P5.K1 — Kernel telemetry ──────────────────────────────────────────────────

/**
 * Backing store for the `/admin/kernel-health` dashboard. Populated
 * via POST to `/api/telemetry/kernel` from the SDK kernel's
 * emitter (the spec'd `/api/internal/...` path was relocated under
 * D2 because `internal/` is gitignored repo-wide). The table is the
 * dashboard's source of truth so the surface keeps working when
 * PostHog is unreachable; PostHog forwarding from the same endpoint
 * is a parallel sink.
 *
 * Indexed for the three dashboard queries: top-level (by occurredAt
 * desc), per-adapter (by adapter, occurredAt), and rails (by rail,
 * occurredAt). Composite indices keep dashboard queries fast under
 * deep history; old rows are reclaimed by a future data-retention
 * job (out of scope for P5.K1).
 *
 * `props` is jsonb — the schema is event-name-keyed and varies per
 * event type (see packages/mcp/src/kernel-telemetry.ts). Keeping it
 * loose at the DB layer avoids per-event-type table sprawl.
 */
export const kernelTelemetry = pgTable(
  'kernel_telemetry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventName: text('event_name').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Adapter denormalized so per-adapter dashboard queries hit an
     * index instead of probing into `props.adapter`. Required for
     * all five event types.
     */
    adapter: text('adapter').notNull(),
    /**
     * Rail denormalized for the rails dashboard. Null for events
     * that don't carry a rail (latency / error events are
     * adapter-scoped, not rail-scoped).
     */
    rail: text('rail'),
    /**
     * Developer UUID. Null when the event happened before we knew
     * the developer or for events that don't carry it. Indexed for
     * future per-developer drill-downs.
     */
    devId: uuid('dev_id'),
    /** Event-type-specific properties (sanitized at emit-time). */
    props: jsonb('props').notNull().$type<Record<string, unknown>>(),
  },
  (table) => [
    index('kernel_telemetry_occurred_at_idx').on(desc(table.occurredAt)),
    index('kernel_telemetry_adapter_idx').on(
      table.adapter,
      desc(table.occurredAt),
    ),
    index('kernel_telemetry_rail_idx').on(table.rail, desc(table.occurredAt)),
    index('kernel_telemetry_event_name_idx').on(
      table.eventName,
      desc(table.occurredAt),
    ),
    index('kernel_telemetry_dev_id_idx').on(table.devId),
    check(
      'kernel_telemetry_event_name_check',
      sql`${table.eventName} IN (
        'kernel.request_received',
        'kernel.routing_decision',
        'kernel.adapter_latency_ms',
        'kernel.adapter_error',
        'kernel.invocation_settled'
      )`,
    ),
  ],
)
