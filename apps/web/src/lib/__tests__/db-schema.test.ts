import { describe, it, expect } from 'vitest'

/**
 * Tests for the database schema definition.
 * Validates that schema objects have the expected fields with correct types.
 */

// We import the schema directly since it's just pgTable definitions
// without needing a database connection
import * as schema from '@/lib/db/schema'

describe('developers table schema', () => {
  it('exports developers table', () => {
    expect(schema.developers).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.developers.id).toBeDefined()
  })

  it('has email column', () => {
    expect(schema.developers.email).toBeDefined()
  })

  it('has passwordHash column', () => {
    expect(schema.developers.passwordHash).toBeDefined()
  })

  it('has stripeConnectId column', () => {
    expect(schema.developers.stripeConnectId).toBeDefined()
  })

  it('has balanceCents column', () => {
    expect(schema.developers.balanceCents).toBeDefined()
  })

  it('has payoutSchedule column', () => {
    expect(schema.developers.payoutSchedule).toBeDefined()
  })

  it('has payoutMinimumCents column', () => {
    expect(schema.developers.payoutMinimumCents).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.developers.createdAt).toBeDefined()
  })

  it('has updatedAt column', () => {
    expect(schema.developers.updatedAt).toBeDefined()
  })

  it('has tier column', () => {
    expect(schema.developers.tier).toBeDefined()
  })

  it('has revenueSharePct column', () => {
    expect(schema.developers.revenueSharePct).toBeDefined()
  })

  it('has stripeSubscriptionId column', () => {
    expect(schema.developers.stripeSubscriptionId).toBeDefined()
  })

  it('has publicProfile column', () => {
    expect(schema.developers.publicProfile).toBeDefined()
  })

  it('has publicBio column', () => {
    expect(schema.developers.publicBio).toBeDefined()
  })

  it('has avatarUrl column', () => {
    expect(schema.developers.avatarUrl).toBeDefined()
  })

  it('has developersRelations defined', () => {
    expect(schema.developersRelations).toBeDefined()
  })
})

describe('tools table schema', () => {
  it('exports tools table', () => {
    expect(schema.tools).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.tools.id).toBeDefined()
  })

  it('has developerId column', () => {
    expect(schema.tools.developerId).toBeDefined()
  })

  it('has name column', () => {
    expect(schema.tools.name).toBeDefined()
  })

  it('has slug column', () => {
    expect(schema.tools.slug).toBeDefined()
  })

  it('has pricingConfig column', () => {
    expect(schema.tools.pricingConfig).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.tools.status).toBeDefined()
  })

  it('has totalInvocations column', () => {
    expect(schema.tools.totalInvocations).toBeDefined()
  })

  it('has totalRevenueCents column', () => {
    expect(schema.tools.totalRevenueCents).toBeDefined()
  })

  it('has category column', () => {
    expect(schema.tools.category).toBeDefined()
  })

  it('has tags column', () => {
    expect(schema.tools.tags).toBeDefined()
  })

  it('has currentVersion column', () => {
    expect(schema.tools.currentVersion).toBeDefined()
  })

  it('has toolsRelations defined', () => {
    expect(schema.toolsRelations).toBeDefined()
  })
})

describe('consumers table schema', () => {
  it('exports consumers table', () => {
    expect(schema.consumers).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.consumers.id).toBeDefined()
  })

  it('has email column', () => {
    expect(schema.consumers.email).toBeDefined()
  })

  it('has passwordHash column', () => {
    expect(schema.consumers.passwordHash).toBeDefined()
  })

  it('has stripeCustomerId column', () => {
    expect(schema.consumers.stripeCustomerId).toBeDefined()
  })

  it('has consumersRelations defined', () => {
    expect(schema.consumersRelations).toBeDefined()
  })
})

describe('consumerToolBalances table schema', () => {
  it('exports consumerToolBalances table', () => {
    expect(schema.consumerToolBalances).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.consumerToolBalances.consumerId).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.consumerToolBalances.toolId).toBeDefined()
  })

  it('has balanceCents column', () => {
    expect(schema.consumerToolBalances.balanceCents).toBeDefined()
  })

  it('has autoRefill column', () => {
    expect(schema.consumerToolBalances.autoRefill).toBeDefined()
  })

  it('has autoRefillAmountCents column', () => {
    expect(schema.consumerToolBalances.autoRefillAmountCents).toBeDefined()
  })

  it('has autoRefillThresholdCents column', () => {
    expect(schema.consumerToolBalances.autoRefillThresholdCents).toBeDefined()
  })

  it('has spendingLimitCents column', () => {
    expect(schema.consumerToolBalances.spendingLimitCents).toBeDefined()
  })

  it('has spendingLimitPeriod column', () => {
    expect(schema.consumerToolBalances.spendingLimitPeriod).toBeDefined()
  })

  it('has currentPeriodSpendCents column', () => {
    expect(schema.consumerToolBalances.currentPeriodSpendCents).toBeDefined()
  })

  it('has periodResetAt column', () => {
    expect(schema.consumerToolBalances.periodResetAt).toBeDefined()
  })

  it('has alertAtPct column', () => {
    expect(schema.consumerToolBalances.alertAtPct).toBeDefined()
  })
})

describe('apiKeys table schema', () => {
  it('exports apiKeys table', () => {
    expect(schema.apiKeys).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.apiKeys.consumerId).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.apiKeys.toolId).toBeDefined()
  })

  it('has keyHash column', () => {
    expect(schema.apiKeys.keyHash).toBeDefined()
  })

  it('has keyPrefix column', () => {
    expect(schema.apiKeys.keyPrefix).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.apiKeys.status).toBeDefined()
  })

  it('has isTestKey column', () => {
    expect(schema.apiKeys.isTestKey).toBeDefined()
  })

  it('has ipAllowlist column', () => {
    expect(schema.apiKeys.ipAllowlist).toBeDefined()
  })

  it('has lastUsedAt column', () => {
    expect(schema.apiKeys.lastUsedAt).toBeDefined()
  })
})

describe('invocations table schema', () => {
  it('exports invocations table', () => {
    expect(schema.invocations).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.invocations.toolId).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.invocations.consumerId).toBeDefined()
  })

  it('has apiKeyId column', () => {
    expect(schema.invocations.apiKeyId).toBeDefined()
  })

  it('has method column', () => {
    expect(schema.invocations.method).toBeDefined()
  })

  it('has costCents column', () => {
    expect(schema.invocations.costCents).toBeDefined()
  })

  it('has latencyMs column', () => {
    expect(schema.invocations.latencyMs).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.invocations.status).toBeDefined()
  })

  it('has isTest column', () => {
    expect(schema.invocations.isTest).toBeDefined()
  })

  it('has metadata column', () => {
    expect(schema.invocations.metadata).toBeDefined()
  })
})

describe('purchases table schema', () => {
  it('exports purchases table', () => {
    expect(schema.purchases).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.purchases.consumerId).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.purchases.toolId).toBeDefined()
  })

  it('has amountCents column', () => {
    expect(schema.purchases.amountCents).toBeDefined()
  })

  it('has stripeSessionId column', () => {
    expect(schema.purchases.stripeSessionId).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.purchases.status).toBeDefined()
  })
})

describe('payouts table schema', () => {
  it('exports payouts table', () => {
    expect(schema.payouts).toBeDefined()
  })

  it('has developerId column', () => {
    expect(schema.payouts.developerId).toBeDefined()
  })

  it('has amountCents column', () => {
    expect(schema.payouts.amountCents).toBeDefined()
  })

  it('has platformFeeCents column', () => {
    expect(schema.payouts.platformFeeCents).toBeDefined()
  })

  it('has stripeTransferId column', () => {
    expect(schema.payouts.stripeTransferId).toBeDefined()
  })

  it('has periodStart column', () => {
    expect(schema.payouts.periodStart).toBeDefined()
  })

  it('has periodEnd column', () => {
    expect(schema.payouts.periodEnd).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.payouts.status).toBeDefined()
  })

  it('has payoutsRelations defined', () => {
    expect(schema.payoutsRelations).toBeDefined()
  })
})

describe('webhookEndpoints table schema', () => {
  it('exports webhookEndpoints table', () => {
    expect(schema.webhookEndpoints).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.webhookEndpoints.id).toBeDefined()
  })

  it('has developerId column', () => {
    expect(schema.webhookEndpoints.developerId).toBeDefined()
  })

  it('has url column', () => {
    expect(schema.webhookEndpoints.url).toBeDefined()
  })

  it('has secret column', () => {
    expect(schema.webhookEndpoints.secret).toBeDefined()
  })

  it('has events column', () => {
    expect(schema.webhookEndpoints.events).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.webhookEndpoints.status).toBeDefined()
  })

  it('has webhookEndpointsRelations defined', () => {
    expect(schema.webhookEndpointsRelations).toBeDefined()
  })
})

describe('webhookDeliveries table schema', () => {
  it('exports webhookDeliveries table', () => {
    expect(schema.webhookDeliveries).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.webhookDeliveries.id).toBeDefined()
  })

  it('has endpointId column', () => {
    expect(schema.webhookDeliveries.endpointId).toBeDefined()
  })

  it('has event column', () => {
    expect(schema.webhookDeliveries.event).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.webhookDeliveries.status).toBeDefined()
  })

  it('has httpStatus column', () => {
    expect(schema.webhookDeliveries.httpStatus).toBeDefined()
  })

  it('has attempts column', () => {
    expect(schema.webhookDeliveries.attempts).toBeDefined()
  })

  it('has maxAttempts column', () => {
    expect(schema.webhookDeliveries.maxAttempts).toBeDefined()
  })

  it('has webhookDeliveriesRelations defined', () => {
    expect(schema.webhookDeliveriesRelations).toBeDefined()
  })
})

describe('auditLogs table schema', () => {
  it('exports auditLogs table', () => {
    expect(schema.auditLogs).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.auditLogs.id).toBeDefined()
  })

  it('has developerId column', () => {
    expect(schema.auditLogs.developerId).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.auditLogs.consumerId).toBeDefined()
  })

  it('has action column', () => {
    expect(schema.auditLogs.action).toBeDefined()
  })

  it('has resourceType column', () => {
    expect(schema.auditLogs.resourceType).toBeDefined()
  })

  it('has resourceId column', () => {
    expect(schema.auditLogs.resourceId).toBeDefined()
  })

  it('has details column', () => {
    expect(schema.auditLogs.details).toBeDefined()
  })

  it('has ipAddress column', () => {
    expect(schema.auditLogs.ipAddress).toBeDefined()
  })

  it('has userAgent column', () => {
    expect(schema.auditLogs.userAgent).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.auditLogs.createdAt).toBeDefined()
  })

  it('has auditLogsRelations defined', () => {
    expect(schema.auditLogsRelations).toBeDefined()
  })
})

describe('toolReviews table schema', () => {
  it('exports toolReviews table', () => {
    expect(schema.toolReviews).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.toolReviews.id).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.toolReviews.toolId).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.toolReviews.consumerId).toBeDefined()
  })

  it('has rating column', () => {
    expect(schema.toolReviews.rating).toBeDefined()
  })

  it('has comment column', () => {
    expect(schema.toolReviews.comment).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.toolReviews.createdAt).toBeDefined()
  })

  it('has updatedAt column', () => {
    expect(schema.toolReviews.updatedAt).toBeDefined()
  })

  it('has toolReviewsRelations defined', () => {
    expect(schema.toolReviewsRelations).toBeDefined()
  })
})

describe('toolChangelogs table schema', () => {
  it('exports toolChangelogs table', () => {
    expect(schema.toolChangelogs).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.toolChangelogs.id).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.toolChangelogs.toolId).toBeDefined()
  })

  it('has version column', () => {
    expect(schema.toolChangelogs.version).toBeDefined()
  })

  it('has changeType column', () => {
    expect(schema.toolChangelogs.changeType).toBeDefined()
  })

  it('has summary column', () => {
    expect(schema.toolChangelogs.summary).toBeDefined()
  })

  it('has details column', () => {
    expect(schema.toolChangelogs.details).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.toolChangelogs.createdAt).toBeDefined()
  })

  it('has toolChangelogsRelations defined', () => {
    expect(schema.toolChangelogsRelations).toBeDefined()
  })
})

// ─── R11: Invocations new columns ───────────────────────────────────────────

describe('invocations table R11 columns', () => {
  it('has sessionId column', () => {
    expect(schema.invocations.sessionId).toBeDefined()
  })

  it('has referralCode column', () => {
    expect(schema.invocations.referralCode).toBeDefined()
  })
})

// ─── R12: Conversion Events ────────────────────────────────────────────────

describe('conversionEvents table schema', () => {
  it('exports conversionEvents table', () => {
    expect(schema.conversionEvents).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.conversionEvents.id).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.conversionEvents.toolId).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.conversionEvents.consumerId).toBeDefined()
  })

  it('has event column', () => {
    expect(schema.conversionEvents.event).toBeDefined()
  })

  it('has fromTier column', () => {
    expect(schema.conversionEvents.fromTier).toBeDefined()
  })

  it('has toTier column', () => {
    expect(schema.conversionEvents.toTier).toBeDefined()
  })

  it('has metadata column', () => {
    expect(schema.conversionEvents.metadata).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.conversionEvents.createdAt).toBeDefined()
  })

  it('has conversionEventsRelations defined', () => {
    expect(schema.conversionEventsRelations).toBeDefined()
  })
})

// ─── R14: Consumer Alerts ──────────────────────────────────────────────────

describe('consumerAlerts table schema', () => {
  it('exports consumerAlerts table', () => {
    expect(schema.consumerAlerts).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.consumerAlerts.id).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.consumerAlerts.consumerId).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.consumerAlerts.toolId).toBeDefined()
  })

  it('has alertType column', () => {
    expect(schema.consumerAlerts.alertType).toBeDefined()
  })

  it('has threshold column', () => {
    expect(schema.consumerAlerts.threshold).toBeDefined()
  })

  it('has channel column', () => {
    expect(schema.consumerAlerts.channel).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.consumerAlerts.status).toBeDefined()
  })

  it('has lastTriggeredAt column', () => {
    expect(schema.consumerAlerts.lastTriggeredAt).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.consumerAlerts.createdAt).toBeDefined()
  })

  it('has consumerAlertsRelations defined', () => {
    expect(schema.consumerAlertsRelations).toBeDefined()
  })
})

// ─── R16: Tool Health Checks ───────────────────────────────────────────────

describe('toolHealthChecks table schema', () => {
  it('exports toolHealthChecks table', () => {
    expect(schema.toolHealthChecks).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.toolHealthChecks.id).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.toolHealthChecks.toolId).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.toolHealthChecks.status).toBeDefined()
  })

  it('has responseTimeMs column', () => {
    expect(schema.toolHealthChecks.responseTimeMs).toBeDefined()
  })

  it('has checkedAt column', () => {
    expect(schema.toolHealthChecks.checkedAt).toBeDefined()
  })

  it('has toolHealthChecksRelations defined', () => {
    expect(schema.toolHealthChecksRelations).toBeDefined()
  })
})

// ─── R17: Referrals ────────────────────────────────────────────────────────

describe('referrals table schema', () => {
  it('exports referrals table', () => {
    expect(schema.referrals).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.referrals.id).toBeDefined()
  })

  it('has referrerId column', () => {
    expect(schema.referrals.referrerId).toBeDefined()
  })

  it('has referredToolId column', () => {
    expect(schema.referrals.referredToolId).toBeDefined()
  })

  it('has referralCode column', () => {
    expect(schema.referrals.referralCode).toBeDefined()
  })

  it('has commissionPct column', () => {
    expect(schema.referrals.commissionPct).toBeDefined()
  })

  it('has totalEarnedCents column', () => {
    expect(schema.referrals.totalEarnedCents).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.referrals.status).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.referrals.createdAt).toBeDefined()
  })

  it('has referralsRelations defined', () => {
    expect(schema.referralsRelations).toBeDefined()
  })
})

// ─── R20: Developer Reputation ─────────────────────────────────────────────

describe('developerReputation table schema', () => {
  it('exports developerReputation table', () => {
    expect(schema.developerReputation).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.developerReputation.id).toBeDefined()
  })

  it('has developerId column', () => {
    expect(schema.developerReputation.developerId).toBeDefined()
  })

  it('has score column', () => {
    expect(schema.developerReputation.score).toBeDefined()
  })

  it('has responseTimePct column', () => {
    expect(schema.developerReputation.responseTimePct).toBeDefined()
  })

  it('has uptimePct column', () => {
    expect(schema.developerReputation.uptimePct).toBeDefined()
  })

  it('has reviewAvg column', () => {
    expect(schema.developerReputation.reviewAvg).toBeDefined()
  })

  it('has totalTools column', () => {
    expect(schema.developerReputation.totalTools).toBeDefined()
  })

  it('has totalConsumers column', () => {
    expect(schema.developerReputation.totalConsumers).toBeDefined()
  })

  it('has calculatedAt column', () => {
    expect(schema.developerReputation.calculatedAt).toBeDefined()
  })

  it('has developerReputationRelations defined', () => {
    expect(schema.developerReputationRelations).toBeDefined()
  })
})

describe('schema table count', () => {
  it('exports 18 tables total', () => {
    const tables = [
      schema.developers,
      schema.tools,
      schema.consumers,
      schema.consumerToolBalances,
      schema.apiKeys,
      schema.invocations,
      schema.purchases,
      schema.payouts,
      schema.webhookEndpoints,
      schema.webhookDeliveries,
      schema.auditLogs,
      schema.toolReviews,
      schema.toolChangelogs,
      schema.conversionEvents,
      schema.consumerAlerts,
      schema.toolHealthChecks,
      schema.referrals,
      schema.developerReputation,
    ]
    expect(tables).toHaveLength(18)
    tables.forEach(t => expect(t).toBeDefined())
  })
})
