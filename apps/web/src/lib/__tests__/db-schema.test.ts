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

// ─── Waitlist Signups ────────────────────────────────────────────────────────

describe('waitlistSignups table schema', () => {
  it('exports waitlistSignups table', () => {
    expect(schema.waitlistSignups).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.waitlistSignups.id).toBeDefined()
  })

  it('has email column', () => {
    expect(schema.waitlistSignups.email).toBeDefined()
  })

  it('has feature column', () => {
    expect(schema.waitlistSignups.feature).toBeDefined()
  })

  it('has metadata column', () => {
    expect(schema.waitlistSignups.metadata).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.waitlistSignups.createdAt).toBeDefined()
  })
})

// ─── Settlement Layer: Accounts ──────────────────────────────────────────────

describe('accounts table schema', () => {
  it('exports accounts table', () => {
    expect(schema.accounts).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.accounts.id).toBeDefined()
  })

  it('has type column', () => {
    expect(schema.accounts.type).toBeDefined()
  })

  it('has entityId column', () => {
    expect(schema.accounts.entityId).toBeDefined()
  })

  it('has label column', () => {
    expect(schema.accounts.label).toBeDefined()
  })

  it('has balanceCents column', () => {
    expect(schema.accounts.balanceCents).toBeDefined()
  })

  it('has pendingDebitCents column', () => {
    expect(schema.accounts.pendingDebitCents).toBeDefined()
  })

  it('has pendingCreditCents column', () => {
    expect(schema.accounts.pendingCreditCents).toBeDefined()
  })

  it('has currencyCode column', () => {
    expect(schema.accounts.currencyCode).toBeDefined()
  })

  it('has version column', () => {
    expect(schema.accounts.version).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.accounts.createdAt).toBeDefined()
  })

  it('has updatedAt column', () => {
    expect(schema.accounts.updatedAt).toBeDefined()
  })
})

// ─── Settlement Layer: Ledger Entries ────────────────────────────────────────

describe('ledgerEntries table schema', () => {
  it('exports ledgerEntries table', () => {
    expect(schema.ledgerEntries).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.ledgerEntries.id).toBeDefined()
  })

  it('has accountId column', () => {
    expect(schema.ledgerEntries.accountId).toBeDefined()
  })

  it('has entryType column', () => {
    expect(schema.ledgerEntries.entryType).toBeDefined()
  })

  it('has amountCents column', () => {
    expect(schema.ledgerEntries.amountCents).toBeDefined()
  })

  it('has currencyCode column', () => {
    expect(schema.ledgerEntries.currencyCode).toBeDefined()
  })

  it('has category column', () => {
    expect(schema.ledgerEntries.category).toBeDefined()
  })

  it('has operationId column', () => {
    expect(schema.ledgerEntries.operationId).toBeDefined()
  })

  it('has batchId column', () => {
    expect(schema.ledgerEntries.batchId).toBeDefined()
  })

  it('has counterpartyAccountId column', () => {
    expect(schema.ledgerEntries.counterpartyAccountId).toBeDefined()
  })

  it('has description column', () => {
    expect(schema.ledgerEntries.description).toBeDefined()
  })

  it('has metadata column', () => {
    expect(schema.ledgerEntries.metadata).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.ledgerEntries.createdAt).toBeDefined()
  })
})

// ─── Settlement Layer: Workflow Sessions ─────────────────────────────────────

describe('workflowSessions table schema', () => {
  it('exports workflowSessions table', () => {
    expect(schema.workflowSessions).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.workflowSessions.id).toBeDefined()
  })

  it('has customerId column', () => {
    expect(schema.workflowSessions.customerId).toBeDefined()
  })

  it('has parentSessionId column', () => {
    expect(schema.workflowSessions.parentSessionId).toBeDefined()
  })

  it('has budgetCents column', () => {
    expect(schema.workflowSessions.budgetCents).toBeDefined()
  })

  it('has spentCents column', () => {
    expect(schema.workflowSessions.spentCents).toBeDefined()
  })

  it('has reservedCents column', () => {
    expect(schema.workflowSessions.reservedCents).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.workflowSessions.status).toBeDefined()
  })

  it('has settlementMode column', () => {
    expect(schema.workflowSessions.settlementMode).toBeDefined()
  })

  it('has protocol column', () => {
    expect(schema.workflowSessions.protocol).toBeDefined()
  })

  it('has hops column', () => {
    expect(schema.workflowSessions.hops).toBeDefined()
  })

  it('has atomicSettlementId column', () => {
    expect(schema.workflowSessions.atomicSettlementId).toBeDefined()
  })

  it('has metadata column', () => {
    expect(schema.workflowSessions.metadata).toBeDefined()
  })

  it('has expiresAt column', () => {
    expect(schema.workflowSessions.expiresAt).toBeDefined()
  })

  it('has completedAt column', () => {
    expect(schema.workflowSessions.completedAt).toBeDefined()
  })

  it('has finalizedAt column', () => {
    expect(schema.workflowSessions.finalizedAt).toBeDefined()
  })

  it('has settledAt column', () => {
    expect(schema.workflowSessions.settledAt).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.workflowSessions.createdAt).toBeDefined()
  })

  it('has updatedAt column', () => {
    expect(schema.workflowSessions.updatedAt).toBeDefined()
  })
})

// ─── Settlement Batches ──────────────────────────────────────────────────────

describe('settlementBatches table schema', () => {
  it('exports settlementBatches table', () => {
    expect(schema.settlementBatches).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.settlementBatches.id).toBeDefined()
  })

  it('has sessionId column', () => {
    expect(schema.settlementBatches.sessionId).toBeDefined()
  })

  it('has totalAmountCents column', () => {
    expect(schema.settlementBatches.totalAmountCents).toBeDefined()
  })

  it('has platformFeeCents column', () => {
    expect(schema.settlementBatches.platformFeeCents).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.settlementBatches.status).toBeDefined()
  })

  it('has disbursements column', () => {
    expect(schema.settlementBatches.disbursements).toBeDefined()
  })

  it('has rollbackReason column', () => {
    expect(schema.settlementBatches.rollbackReason).toBeDefined()
  })

  it('has processedAt column', () => {
    expect(schema.settlementBatches.processedAt).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.settlementBatches.createdAt).toBeDefined()
  })
})

// ─── Agent Identities ────────────────────────────────────────────────────────

describe('agentIdentities table schema', () => {
  it('exports agentIdentities table', () => {
    expect(schema.agentIdentities).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.agentIdentities.id).toBeDefined()
  })

  it('has providerId column', () => {
    expect(schema.agentIdentities.providerId).toBeDefined()
  })

  it('has agentName column', () => {
    expect(schema.agentIdentities.agentName).toBeDefined()
  })

  it('has identityType column', () => {
    expect(schema.agentIdentities.identityType).toBeDefined()
  })

  it('has publicKey column', () => {
    expect(schema.agentIdentities.publicKey).toBeDefined()
  })

  it('has fingerprint column', () => {
    expect(schema.agentIdentities.fingerprint).toBeDefined()
  })

  it('has verificationLevel column', () => {
    expect(schema.agentIdentities.verificationLevel).toBeDefined()
  })

  it('has capabilities column', () => {
    expect(schema.agentIdentities.capabilities).toBeDefined()
  })

  it('has spendingLimitCents column', () => {
    expect(schema.agentIdentities.spendingLimitCents).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.agentIdentities.status).toBeDefined()
  })

  it('has metadata column', () => {
    expect(schema.agentIdentities.metadata).toBeDefined()
  })

  it('has lastSeenAt column', () => {
    expect(schema.agentIdentities.lastSeenAt).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.agentIdentities.createdAt).toBeDefined()
  })
})

// ─── Organizations ───────────────────────────────────────────────────────────

describe('organizations table schema', () => {
  it('exports organizations table', () => {
    expect(schema.organizations).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.organizations.id).toBeDefined()
  })

  it('has name column', () => {
    expect(schema.organizations.name).toBeDefined()
  })

  it('has slug column', () => {
    expect(schema.organizations.slug).toBeDefined()
  })

  it('has plan column', () => {
    expect(schema.organizations.plan).toBeDefined()
  })

  it('has billingEmail column', () => {
    expect(schema.organizations.billingEmail).toBeDefined()
  })

  it('has stripeCustomerId column', () => {
    expect(schema.organizations.stripeCustomerId).toBeDefined()
  })

  it('has stripeSubscriptionId column', () => {
    expect(schema.organizations.stripeSubscriptionId).toBeDefined()
  })

  it('has settings column', () => {
    expect(schema.organizations.settings).toBeDefined()
  })

  it('has monthlyBudgetCents column', () => {
    expect(schema.organizations.monthlyBudgetCents).toBeDefined()
  })

  it('has currentMonthSpendCents column', () => {
    expect(schema.organizations.currentMonthSpendCents).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.organizations.createdAt).toBeDefined()
  })

  it('has updatedAt column', () => {
    expect(schema.organizations.updatedAt).toBeDefined()
  })
})

// ─── Organization Members ───────────────────────────────────────────────────

describe('organizationMembers table schema', () => {
  it('exports organizationMembers table', () => {
    expect(schema.organizationMembers).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.organizationMembers.id).toBeDefined()
  })

  it('has orgId column', () => {
    expect(schema.organizationMembers.orgId).toBeDefined()
  })

  it('has userId column', () => {
    expect(schema.organizationMembers.userId).toBeDefined()
  })

  it('has role column', () => {
    expect(schema.organizationMembers.role).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.organizationMembers.createdAt).toBeDefined()
  })

  it('has organizationMembersRelations defined', () => {
    expect(schema.organizationMembersRelations).toBeDefined()
  })
})

// ─── Cost Allocations ───────────────────────────────────────────────────────

describe('costAllocations table schema', () => {
  it('exports costAllocations table', () => {
    expect(schema.costAllocations).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.costAllocations.id).toBeDefined()
  })

  it('has orgId column', () => {
    expect(schema.costAllocations.orgId).toBeDefined()
  })

  it('has departmentTag column', () => {
    expect(schema.costAllocations.departmentTag).toBeDefined()
  })

  it('has serviceId column', () => {
    expect(schema.costAllocations.serviceId).toBeDefined()
  })

  it('has periodStart column', () => {
    expect(schema.costAllocations.periodStart).toBeDefined()
  })

  it('has periodEnd column', () => {
    expect(schema.costAllocations.periodEnd).toBeDefined()
  })

  it('has totalCents column', () => {
    expect(schema.costAllocations.totalCents).toBeDefined()
  })

  it('has operationCount column', () => {
    expect(schema.costAllocations.operationCount).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.costAllocations.createdAt).toBeDefined()
  })
})

// ─── Compliance Exports ─────────────────────────────────────────────────────

describe('complianceExports table schema', () => {
  it('exports complianceExports table', () => {
    expect(schema.complianceExports).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.complianceExports.id).toBeDefined()
  })

  it('has requestType column', () => {
    expect(schema.complianceExports.requestType).toBeDefined()
  })

  it('has entityType column', () => {
    expect(schema.complianceExports.entityType).toBeDefined()
  })

  it('has entityId column', () => {
    expect(schema.complianceExports.entityId).toBeDefined()
  })

  it('has status column', () => {
    expect(schema.complianceExports.status).toBeDefined()
  })

  it('has resultUrl column', () => {
    expect(schema.complianceExports.resultUrl).toBeDefined()
  })

  it('has completedAt column', () => {
    expect(schema.complianceExports.completedAt).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.complianceExports.createdAt).toBeDefined()
  })
})

// ─── Outcome Verifications ──────────────────────────────────────────────────

describe('outcomeVerifications table schema', () => {
  it('exports outcomeVerifications table', () => {
    expect(schema.outcomeVerifications).toBeDefined()
  })

  it('has id column', () => {
    expect(schema.outcomeVerifications.id).toBeDefined()
  })

  it('has invocationId column', () => {
    expect(schema.outcomeVerifications.invocationId).toBeDefined()
  })

  it('has toolId column', () => {
    expect(schema.outcomeVerifications.toolId).toBeDefined()
  })

  it('has consumerId column', () => {
    expect(schema.outcomeVerifications.consumerId).toBeDefined()
  })

  it('has outcomeType column', () => {
    expect(schema.outcomeVerifications.outcomeType).toBeDefined()
  })

  it('has successCriteria column', () => {
    expect(schema.outcomeVerifications.successCriteria).toBeDefined()
  })

  it('has fullPriceCents column', () => {
    expect(schema.outcomeVerifications.fullPriceCents).toBeDefined()
  })

  it('has failurePriceCents column', () => {
    expect(schema.outcomeVerifications.failurePriceCents).toBeDefined()
  })

  it('has actualOutcome column', () => {
    expect(schema.outcomeVerifications.actualOutcome).toBeDefined()
  })

  it('has outcomeScore column', () => {
    expect(schema.outcomeVerifications.outcomeScore).toBeDefined()
  })

  it('has passed column', () => {
    expect(schema.outcomeVerifications.passed).toBeDefined()
  })

  it('has settledPriceCents column', () => {
    expect(schema.outcomeVerifications.settledPriceCents).toBeDefined()
  })

  it('has verifiedAt column', () => {
    expect(schema.outcomeVerifications.verifiedAt).toBeDefined()
  })

  it('has disputeStatus column', () => {
    expect(schema.outcomeVerifications.disputeStatus).toBeDefined()
  })

  it('has disputeReason column', () => {
    expect(schema.outcomeVerifications.disputeReason).toBeDefined()
  })

  it('has disputeResolvedAt column', () => {
    expect(schema.outcomeVerifications.disputeResolvedAt).toBeDefined()
  })

  it('has disputeDeadline column', () => {
    expect(schema.outcomeVerifications.disputeDeadline).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(schema.outcomeVerifications.createdAt).toBeDefined()
  })
})

// ─── Consumer Tool Balances: createdAt ──────────────────────────────────────

describe('consumerToolBalances createdAt column', () => {
  it('has createdAt column', () => {
    expect(schema.consumerToolBalances.createdAt).toBeDefined()
  })
})

// ─── Schema Table Count (All 24 Tables) ─────────────────────────────────────

describe('schema table count', () => {
  it('exports all 24 tables', () => {
    const tables = [
      // Core marketplace (18 original)
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
      // Settlement layer + Enterprise (6 additional)
      schema.waitlistSignups,
      schema.accounts,
      schema.ledgerEntries,
      schema.workflowSessions,
      schema.settlementBatches,
      schema.agentIdentities,
      schema.organizations,
      schema.organizationMembers,
      schema.costAllocations,
      schema.complianceExports,
      schema.outcomeVerifications,
    ]
    expect(tables).toHaveLength(29)
    tables.forEach(t => expect(t).toBeDefined())
  })
})
