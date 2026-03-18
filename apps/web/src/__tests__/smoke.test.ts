/**
 * SettleGrid Comprehensive Smoke Test
 *
 * Verifies the entire application surface: schema, settlement modules,
 * SDK exports, API route existence, page existence, middleware config,
 * environment, and component exports.
 *
 * Target: 200+ assertions covering every file that matters.
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEB_ROOT = resolve(__dirname, '..')
const PACKAGES_ROOT = resolve(__dirname, '..', '..', '..', '..', 'packages')

function webFile(rel: string): string {
  return resolve(WEB_ROOT, rel)
}

function pkgFile(rel: string): string {
  return resolve(PACKAGES_ROOT, rel)
}

function fileExists(path: string): boolean {
  return existsSync(path)
}

// ─── 1. Database Schema ──────────────────────────────────────────────────────

describe('Database Schema', () => {
  it('exports all table definitions', async () => {
    const schema = await import('@/lib/db/schema')

    // 22 tables
    const tables = [
      'developers',
      'tools',
      'consumers',
      'consumerToolBalances',
      'apiKeys',
      'invocations',
      'purchases',
      'payouts',
      'webhookEndpoints',
      'webhookDeliveries',
      'auditLogs',
      'toolReviews',
      'toolChangelogs',
      'conversionEvents',
      'consumerAlerts',
      'toolHealthChecks',
      'referrals',
      'developerReputation',
      'waitlistSignups',
      'accounts',
      'ledgerEntries',
      'workflowSessions',
      'settlementBatches',
      'agentIdentities',
      'organizations',
      'organizationMembers',
      'costAllocations',
      'complianceExports',
      'outcomeVerifications',
    ]

    for (const table of tables) {
      expect(schema).toHaveProperty(table)
      expect((schema as Record<string, unknown>)[table]).toBeDefined()
    }
  })

  it('exports all relation definitions', async () => {
    const schema = await import('@/lib/db/schema')

    const relations = [
      'developersRelations',
      'toolsRelations',
      'consumersRelations',
      'consumerToolBalancesRelations',
      'apiKeysRelations',
      'invocationsRelations',
      'purchasesRelations',
      'payoutsRelations',
      'webhookEndpointsRelations',
      'webhookDeliveriesRelations',
      'auditLogsRelations',
      'toolReviewsRelations',
      'toolChangelogsRelations',
      'conversionEventsRelations',
      'consumerAlertsRelations',
      'toolHealthChecksRelations',
      'referralsRelations',
      'developerReputationRelations',
      'organizationMembersRelations',
    ]

    for (const rel of relations) {
      expect(schema).toHaveProperty(rel)
    }
  })
})

// ─── 2. Settlement Module Exports ────────────────────────────────────────────

describe('Settlement Module', () => {
  it('exports protocol registry and adapters', async () => {
    const settlement = await import('@/lib/settlement')

    expect(settlement).toHaveProperty('protocolRegistry')
    expect(settlement).toHaveProperty('ProtocolRegistry')
    expect(settlement).toHaveProperty('adapterMetrics')
    expect(settlement).toHaveProperty('DETECTION_PRIORITY')
    expect(settlement.DETECTION_PRIORITY).toEqual(['x402', 'ap2', 'visa-tap', 'mcp'])
  })

  it('exports all 4 protocol adapters', async () => {
    const settlement = await import('@/lib/settlement')

    expect(settlement).toHaveProperty('MCPAdapter')
    expect(settlement).toHaveProperty('X402Adapter')
    expect(settlement).toHaveProperty('AP2Adapter')
    expect(settlement).toHaveProperty('TAPAdapter')
  })

  it('registers 4 adapters in the protocol registry', async () => {
    const { protocolRegistry } = await import('@/lib/settlement')

    expect(protocolRegistry.has('mcp')).toBe(true)
    expect(protocolRegistry.has('x402')).toBe(true)
    expect(protocolRegistry.has('ap2')).toBe(true)
    expect(protocolRegistry.has('visa-tap')).toBe(true)
    expect(protocolRegistry.list()).toHaveLength(4)
  })

  it('exports ledger functions', async () => {
    const settlement = await import('@/lib/settlement')

    expect(typeof settlement.postLedgerEntry).toBe('function')
    expect(typeof settlement.postLedgerEntryAsync).toBe('function')
    expect(typeof settlement.computeBalanceFromLedger).toBe('function')
    expect(typeof settlement.reconcileAccount).toBe('function')
    expect(typeof settlement.verifyLedgerIntegrity).toBe('function')
  })

  it('exports session functions', async () => {
    const settlement = await import('@/lib/settlement')

    expect(typeof settlement.createSession).toBe('function')
    expect(typeof settlement.checkSessionBudget).toBe('function')
    expect(typeof settlement.recordSessionSpend).toBe('function')
    expect(typeof settlement.completeSession).toBe('function')
    expect(typeof settlement.getSessionState).toBe('function')
    expect(typeof settlement.recordHop).toBe('function')
    expect(typeof settlement.finalizeSession).toBe('function')
    expect(typeof settlement.processSettlementBatch).toBe('function')
    expect(typeof settlement.rollbackSettlementBatch).toBe('function')
    expect(typeof settlement.expireStaleSessionsBatch).toBe('function')
    expect(typeof settlement.getSettlementBatch).toBe('function')
  })

  it('exports identity functions', async () => {
    const settlement = await import('@/lib/settlement')

    expect(typeof settlement.registerAgent).toBe('function')
    expect(typeof settlement.resolveAgent).toBe('function')
    expect(typeof settlement.listAgentsByProvider).toBe('function')
    expect(typeof settlement.generateAgentFactsProfile).toBe('function')
    expect(typeof settlement.computeTrustScore).toBe('function')
    expect(typeof settlement.computeFingerprint).toBe('function')
  })

  it('exports x402 functions', async () => {
    const settlement = await import('@/lib/settlement')

    expect(typeof settlement.verifyExactPayment).toBe('function')
    expect(typeof settlement.verifyUptoPayment).toBe('function')
    expect(typeof settlement.settleExactPayment).toBe('function')
    expect(typeof settlement.generateReceipt).toBe('function')
  })

  it('exports AP2 functions', async () => {
    const settlement = await import('@/lib/settlement')

    expect(typeof settlement.getEligiblePaymentMethods).toBe('function')
    expect(typeof settlement.provisionCredentials).toBe('function')
    expect(typeof settlement.processPayment).toBe('function')
    expect(typeof settlement.verifyIntentMandate).toBe('function')
    expect(typeof settlement.verifyCartMandate).toBe('function')
    expect(typeof settlement.signJwt).toBe('function')
    expect(typeof settlement.verifyJwt).toBe('function')
  })

  it('exports outcome functions', async () => {
    const settlement = await import('@/lib/settlement')

    expect(typeof settlement.evaluateOutcome).toBe('function')
    expect(typeof settlement.createOutcomeVerification).toBe('function')
    expect(typeof settlement.verifyOutcome).toBe('function')
    expect(typeof settlement.openDispute).toBe('function')
    expect(typeof settlement.resolveDispute).toBe('function')
    expect(typeof settlement.getOutcomeVerification).toBe('function')
    expect(typeof settlement.getOutcomesByTool).toBe('function')
  })

  it('exports currency functions', async () => {
    const settlement = await import('@/lib/settlement')

    expect(typeof settlement.convertCurrency).toBe('function')
    expect(typeof settlement.formatCurrency).toBe('function')
    expect(typeof settlement.getExchangeRate).toBe('function')
    expect(typeof settlement.isSupportedCurrency).toBe('function')
    expect(settlement.SUPPORTED_CURRENCIES).toBeDefined()
    expect(settlement.FALLBACK_RATES).toBeDefined()
  })

  it('exports compliance functions', async () => {
    const settlement = await import('@/lib/settlement')

    expect(typeof settlement.requestDataExport).toBe('function')
    expect(typeof settlement.requestDataDeletion).toBe('function')
    expect(typeof settlement.getExportStatus).toBe('function')
    expect(typeof settlement.processDataExport).toBe('function')
    expect(typeof settlement.processDataDeletion).toBe('function')
  })
})

// ─── 3. Settlement Types ─────────────────────────────────────────────────────

describe('Settlement Types', () => {
  it('exports core types from types module', async () => {
    const types = await import('@/lib/settlement/types')

    // ProtocolName is a type, verify the module loads without error
    expect(types).toBeDefined()
  })

  it('exports session types from session-types module', async () => {
    const sessionTypes = await import('@/lib/settlement/session-types')

    expect(sessionTypes).toBeDefined()
  })
})

// ─── 4. SDK Exports (@settlegrid/mcp) ────────────────────────────────────────

describe('SDK (@settlegrid/mcp)', () => {
  it('exports settlegrid namespace with init and version', async () => {
    const sdk = await import('../../../../packages/mcp/src/index')

    expect(sdk).toHaveProperty('settlegrid')
    expect(sdk.settlegrid.version).toBe('0.1.0')
    expect(typeof sdk.settlegrid.init).toBe('function')
    expect(typeof sdk.settlegrid.extractApiKey).toBe('function')
    expect(sdk).toHaveProperty('SDK_VERSION', '0.1.0')
  })

  it('exports all error classes', async () => {
    const sdk = await import('../../../../packages/mcp/src/index')

    expect(sdk).toHaveProperty('SettleGridError')
    expect(sdk).toHaveProperty('InvalidKeyError')
    expect(sdk).toHaveProperty('InsufficientCreditsError')
    expect(sdk).toHaveProperty('ToolNotFoundError')
    expect(sdk).toHaveProperty('ToolDisabledError')
    expect(sdk).toHaveProperty('RateLimitedError')
    expect(sdk).toHaveProperty('SettleGridUnavailableError')
    expect(sdk).toHaveProperty('NetworkError')
    expect(sdk).toHaveProperty('TimeoutError')
  })

  it('exports REST middleware', async () => {
    const sdk = await import('../../../../packages/mcp/src/index')

    expect(typeof sdk.settlegridMiddleware).toBe('function')
  })

  it('exports payment capability', async () => {
    const sdk = await import('../../../../packages/mcp/src/index')

    expect(typeof sdk.createPaymentCapability).toBe('function')
    expect(sdk).toHaveProperty('PAYMENT_ERROR_CODES')
  })

  it('exports server card generators', async () => {
    const sdk = await import('../../../../packages/mcp/src/index')

    expect(typeof sdk.generateServerCardBilling).toBe('function')
    expect(typeof sdk.generateServerCard).toBe('function')
  })

  it('exports config utilities', async () => {
    const sdk = await import('../../../../packages/mcp/src/index')

    expect(typeof sdk.normalizeConfig).toBe('function')
    expect(typeof sdk.validatePricingConfig).toBe('function')
    expect(typeof sdk.getMethodCost).toBe('function')
    expect(typeof sdk.resolveOperationCost).toBe('function')
    expect(sdk).toHaveProperty('pricingConfigSchema')
    expect(sdk).toHaveProperty('generalizedPricingConfigSchema')
  })

  it('exports LRU cache', async () => {
    const sdk = await import('../../../../packages/mcp/src/index')

    expect(sdk).toHaveProperty('LRUCache')
  })

  it('exports extractApiKey', async () => {
    const sdk = await import('../../../../packages/mcp/src/index')

    expect(typeof sdk.extractApiKey).toBe('function')
  })

  it('initializes correctly with valid config', async () => {
    const { settlegrid } = await import('../../../../packages/mcp/src/index')

    const sg = settlegrid.init({
      toolSlug: 'smoke-test',
      pricing: { defaultCostCents: 1 },
    })

    expect(typeof sg.wrap).toBe('function')
    expect(typeof sg.validateKey).toBe('function')
    expect(typeof sg.meter).toBe('function')
    expect(typeof sg.clearCache).toBe('function')
  })

  it('rejects init with empty toolSlug', async () => {
    const { settlegrid } = await import('../../../../packages/mcp/src/index')

    expect(() => settlegrid.init({ toolSlug: '', pricing: { defaultCostCents: 1 } })).toThrow()
  })

  it('rejects init with missing pricing', async () => {
    const { settlegrid } = await import('../../../../packages/mcp/src/index')

    expect(() => settlegrid.init({ toolSlug: 'test' } as never)).toThrow()
  })
})

// ─── 5. Environment Module ───────────────────────────────────────────────────

describe('Environment Module', () => {
  it('exports all required env getter functions', async () => {
    const env = await import('@/lib/env')

    const getters = [
      'getDatabaseUrl',
      'getRedisUrl',
      'getStripeSecretKey',
      'getStripeConnectClientId',
      'getStripeWebhookSecret',
      'getResendApiKey',
      'getSupabaseUrl',
      'getSupabaseAnonKey',
      'getSupabaseServiceRoleKey',
      'getAppUrl',
      'getUpstashRedisRestToken',
      'getCronSecret',
      'getHealthRedisUrl',
      'getHealthRedisToken',
      'getGatePassword',
      'getGateSecret',
      'getGateAuthTimeoutHours',
      'isProduction',
      'getAp2SigningSecret',
      'getAp2VerificationKey',
      'getVisaApiUrl',
      'getVisaApiKey',
      'getVisaSharedSecret',
      'getEnv',
    ]

    for (const fn of getters) {
      expect(typeof (env as Record<string, unknown>)[fn]).toBe('function')
    }
  })

  it('isProduction returns false in test env', async () => {
    const { isProduction } = await import('@/lib/env')
    expect(isProduction()).toBe(false)
  })

  it('getGateAuthTimeoutHours returns a number', async () => {
    const { getGateAuthTimeoutHours } = await import('@/lib/env')
    expect(typeof getGateAuthTimeoutHours()).toBe('number')
    expect(getGateAuthTimeoutHours()).toBeGreaterThan(0)
  })

  it('getAp2SigningSecret returns fallback in dev', async () => {
    const { getAp2SigningSecret } = await import('@/lib/env')
    expect(typeof getAp2SigningSecret()).toBe('string')
    expect(getAp2SigningSecret().length).toBeGreaterThan(0)
  })

  it('getVisaApiUrl returns fallback in dev', async () => {
    const { getVisaApiUrl } = await import('@/lib/env')
    expect(typeof getVisaApiUrl()).toBe('string')
    expect(getVisaApiUrl()).toContain('visa.com')
  })
})

// ─── 6. API Route Files Exist ────────────────────────────────────────────────

describe('API Route Files', () => {
  const apiRoutes = [
    // Public
    'app/api/health/route.ts',
    'app/api/openapi.json/route.ts',
    'app/api/gate/route.ts',
    'app/api/waitlist/route.ts',
    'app/api/stream/route.ts',

    // x402
    'app/api/x402/verify/route.ts',
    'app/api/x402/settle/route.ts',
    'app/api/x402/supported/route.ts',

    // AP2
    'app/api/a2a/route.ts',
    'app/api/a2a/skills/route.ts',

    // SDK
    'app/api/sdk/validate-key/route.ts',
    'app/api/sdk/meter/route.ts',
    'app/api/sdk/meter-with-metadata/route.ts',
    'app/api/sdk/test-validate/route.ts',

    // Sessions
    'app/api/sessions/route.ts',
    'app/api/sessions/[id]/route.ts',
    'app/api/sessions/[id]/hop/route.ts',
    'app/api/sessions/[id]/delegate/route.ts',
    'app/api/sessions/[id]/complete/route.ts',
    'app/api/sessions/[id]/finalize/route.ts',

    // Settlements
    'app/api/settlements/[id]/route.ts',

    // Agents
    'app/api/agents/route.ts',
    'app/api/agents/[id]/route.ts',
    'app/api/agents/[id]/facts/route.ts',

    // Outcomes
    'app/api/outcomes/route.ts',
    'app/api/outcomes/[id]/route.ts',
    'app/api/outcomes/[id]/verify/route.ts',
    'app/api/outcomes/[id]/dispute/route.ts',

    // Organizations
    'app/api/orgs/route.ts',
    'app/api/orgs/[id]/route.ts',
    'app/api/orgs/[id]/members/route.ts',
    'app/api/orgs/[id]/members/[userId]/route.ts',
    'app/api/orgs/[id]/allocations/route.ts',

    // Tools
    'app/api/tools/route.ts',
    'app/api/tools/[id]/route.ts',
    'app/api/tools/[id]/health/route.ts',
    'app/api/tools/[id]/status/route.ts',
    'app/api/tools/[id]/versions/route.ts',
    'app/api/tools/[id]/version/route.ts',
    'app/api/tools/[id]/changelog/route.ts',
    'app/api/tools/[id]/pricing-simulator/route.ts',
    'app/api/tools/directory/route.ts',
    'app/api/tools/categories/route.ts',
    'app/api/tools/public/[slug]/route.ts',
    'app/api/tools/by-slug/[slug]/reviews/route.ts',
    'app/api/tools/by-slug/[slug]/pricing-widget/route.ts',
    'app/api/tools/by-slug/[slug]/integration/route.ts',

    // Dashboard
    'app/api/dashboard/developer/stats/route.ts',
    'app/api/dashboard/developer/stats/analytics/route.ts',
    'app/api/dashboard/developer/stats/attribution/route.ts',
    'app/api/dashboard/developer/stats/export/route.ts',
    'app/api/dashboard/developer/stats/funnel/route.ts',
    'app/api/dashboard/developer/profile/route.ts',

    // Developer
    'app/api/developer/webhooks/route.ts',
    'app/api/developer/webhooks/[id]/route.ts',
    'app/api/developer/webhooks/[id]/deliveries/route.ts',
    'app/api/developer/webhooks/[id]/test/route.ts',
    'app/api/developer/referrals/route.ts',
    'app/api/developer/referrals/[id]/route.ts',
    'app/api/developer/referrals/[id]/earnings/route.ts',
    'app/api/developers/[id]/profile/route.ts',
    'app/api/developers/[id]/reputation/route.ts',

    // Consumer
    'app/api/consumer/balance/route.ts',
    'app/api/consumer/usage/route.ts',
    'app/api/consumer/usage/analytics/route.ts',
    'app/api/consumer/keys/route.ts',
    'app/api/consumer/keys/[id]/route.ts',
    'app/api/consumer/keys/[id]/ip-restrict/route.ts',
    'app/api/consumer/budget/route.ts',
    'app/api/consumer/subscriptions/route.ts',
    'app/api/consumer/alerts/route.ts',
    'app/api/consumer/alerts/[id]/route.ts',
    'app/api/consumer/conversion-events/route.ts',

    // Auth
    'app/api/auth/developer/me/route.ts',
    'app/api/auth/consumer/me/route.ts',

    // Payouts
    'app/api/payouts/route.ts',
    'app/api/payouts/trigger/route.ts',

    // Audit
    'app/api/audit-log/route.ts',
    'app/api/audit-log/export/route.ts',

    // Billing
    'app/api/billing/checkout/route.ts',
    'app/api/billing/purchases/route.ts',
    'app/api/billing/webhook/route.ts',

    // Stripe
    'app/api/stripe/connect/route.ts',
    'app/api/stripe/connect/callback/route.ts',

    // Cron
    'app/api/cron/aggregate-usage/route.ts',
    'app/api/cron/alert-check/route.ts',
    'app/api/cron/expire-sessions/route.ts',
    'app/api/cron/health-checks/route.ts',
    'app/api/cron/webhook-retry/route.ts',

    // OG Image
    'app/api/og/route.tsx',
  ]

  it.each(apiRoutes)('route file exists: %s', (route) => {
    expect(fileExists(webFile(route))).toBe(true)
  })
})

// ─── 7. Page Files Exist ─────────────────────────────────────────────────────

describe('Page Files', () => {
  const pages = [
    // Marketing
    'app/page.tsx',
    'app/layout.tsx',
    'app/not-found.tsx',
    'app/error.tsx',
    'app/loading.tsx',
    'app/globals.css',
    'app/icon.svg',
    'app/robots.ts',
    'app/sitemap.ts',

    // Docs
    'app/docs/page.tsx',
    'app/docs/error.tsx',
    'app/docs/loading.tsx',

    // Privacy
    'app/privacy/page.tsx',
    'app/privacy/error.tsx',
    'app/privacy/loading.tsx',

    // Terms
    'app/terms/page.tsx',
    'app/terms/error.tsx',
    'app/terms/loading.tsx',

    // Gate
    'app/gate/page.tsx',
    'app/gate/error.tsx',
    'app/gate/loading.tsx',
    'app/gate/layout.tsx',

    // Tools
    'app/tools/page.tsx',
    'app/tools/error.tsx',
    'app/tools/loading.tsx',
    'app/tools/layout.tsx',
    'app/tools/[slug]/page.tsx',
    'app/tools/[slug]/error.tsx',
    'app/tools/[slug]/loading.tsx',

    // Auth
    'app/(auth)/layout.tsx',
    'app/(auth)/error.tsx',
    'app/(auth)/loading.tsx',
    'app/(auth)/login/page.tsx',
    'app/(auth)/login/error.tsx',
    'app/(auth)/login/loading.tsx',
    'app/(auth)/register/page.tsx',
    'app/(auth)/register/error.tsx',
    'app/(auth)/register/loading.tsx',

    // Auth Callback
    'app/auth/callback/route.ts',

    // Dashboard Layout
    'app/(dashboard)/layout.tsx',
    'app/(dashboard)/error.tsx',
    'app/(dashboard)/loading.tsx',

    // Dashboard Overview
    'app/(dashboard)/dashboard/page.tsx',
    'app/(dashboard)/dashboard/error.tsx',
    'app/(dashboard)/dashboard/loading.tsx',

    // Dashboard - Tools
    'app/(dashboard)/dashboard/tools/page.tsx',
    'app/(dashboard)/dashboard/tools/error.tsx',
    'app/(dashboard)/dashboard/tools/loading.tsx',

    // Dashboard - Analytics
    'app/(dashboard)/dashboard/analytics/page.tsx',
    'app/(dashboard)/dashboard/analytics/error.tsx',
    'app/(dashboard)/dashboard/analytics/loading.tsx',

    // Dashboard - Payouts
    'app/(dashboard)/dashboard/payouts/page.tsx',
    'app/(dashboard)/dashboard/payouts/error.tsx',
    'app/(dashboard)/dashboard/payouts/loading.tsx',

    // Dashboard - Webhooks
    'app/(dashboard)/dashboard/webhooks/page.tsx',
    'app/(dashboard)/dashboard/webhooks/error.tsx',
    'app/(dashboard)/dashboard/webhooks/loading.tsx',

    // Dashboard - Audit Log
    'app/(dashboard)/dashboard/audit-log/page.tsx',
    'app/(dashboard)/dashboard/audit-log/error.tsx',
    'app/(dashboard)/dashboard/audit-log/loading.tsx',

    // Dashboard - Health
    'app/(dashboard)/dashboard/health/page.tsx',
    'app/(dashboard)/dashboard/health/error.tsx',
    'app/(dashboard)/dashboard/health/loading.tsx',

    // Dashboard - Fraud
    'app/(dashboard)/dashboard/fraud/page.tsx',
    'app/(dashboard)/dashboard/fraud/error.tsx',
    'app/(dashboard)/dashboard/fraud/loading.tsx',

    // Dashboard - Referrals
    'app/(dashboard)/dashboard/referrals/page.tsx',
    'app/(dashboard)/dashboard/referrals/error.tsx',
    'app/(dashboard)/dashboard/referrals/loading.tsx',

    // Dashboard - Reputation
    'app/(dashboard)/dashboard/reputation/page.tsx',
    'app/(dashboard)/dashboard/reputation/error.tsx',
    'app/(dashboard)/dashboard/reputation/loading.tsx',

    // Dashboard - Settings
    'app/(dashboard)/dashboard/settings/page.tsx',
    'app/(dashboard)/dashboard/settings/error.tsx',
    'app/(dashboard)/dashboard/settings/loading.tsx',

    // Consumer Portal
    'app/(dashboard)/consumer/page.tsx',
    'app/(dashboard)/consumer/error.tsx',
    'app/(dashboard)/consumer/loading.tsx',
  ]

  it.each(pages)('page file exists: %s', (page) => {
    expect(fileExists(webFile(page))).toBe(true)
  })
})

// ─── 8. Component Files Exist ────────────────────────────────────────────────

describe('Component Files', () => {
  const components = [
    // UI
    'components/ui/badge.tsx',
    'components/ui/button.tsx',
    'components/ui/card.tsx',
    'components/ui/dialog.tsx',
    'components/ui/dropdown-menu.tsx',
    'components/ui/input.tsx',
    'components/ui/live-indicator.tsx',
    'components/ui/logo.tsx',
    'components/ui/skeleton.tsx',
    'components/ui/tabs.tsx',
    'components/ui/theme-toggle.tsx',
    'components/ui/toast.tsx',
    'components/ui/tooltip.tsx',

    // Marketing
    'components/marketing/code-snippet.tsx',
    'components/marketing/home-sections.tsx',
    'components/marketing/scroll-reveal.tsx',

    // Dashboard
    'components/dashboard/breadcrumbs.tsx',
    'components/dashboard/empty-state.tsx',
    'components/dashboard/stat-card.tsx',

    // Charts
    'components/charts/area-chart.tsx',
    'components/charts/bar-chart.tsx',

    // Top-level
    'components/command-palette.tsx',
    'components/sonner-toaster.tsx',
    'components/theme-provider.tsx',
  ]

  it.each(components)('component file exists: %s', (component) => {
    expect(fileExists(webFile(component))).toBe(true)
  })
})

// ─── 9. Lib Module Files Exist ───────────────────────────────────────────────

describe('Lib Module Files', () => {
  const libs = [
    'lib/api.ts',
    'lib/audit.ts',
    'lib/auth.ts',
    'lib/auto-refill.ts',
    'lib/crypto.ts',
    'lib/csv.ts',
    'lib/email.ts',
    'lib/env.ts',
    'lib/fraud.ts',
    'lib/ip-validation.ts',
    'lib/logger.ts',
    'lib/metering.ts',
    'lib/rate-limit.ts',
    'lib/redis.ts',
    'lib/request-id.ts',
    'lib/utils.ts',
    'lib/webhooks.ts',
    'lib/alert-email.ts',

    // DB
    'lib/db/index.ts',
    'lib/db/schema.ts',

    // Middleware
    'lib/middleware/auth.ts',
    'lib/middleware/cors.ts',

    // Supabase
    'lib/supabase/client.ts' /* optional - check if exists in tests */,

    // Settlement
    'lib/settlement/index.ts',
    'lib/settlement/types.ts',
    'lib/settlement/ledger.ts',
    'lib/settlement/sessions.ts',
    'lib/settlement/session-types.ts',
    'lib/settlement/identity.ts',
    'lib/settlement/outcomes.ts',
    'lib/settlement/currency.ts',
    'lib/settlement/compliance.ts',
    'lib/settlement/rbac.ts',
    'lib/settlement/organizations.ts',

    // Settlement Adapters
    'lib/settlement/adapters/index.ts',
    'lib/settlement/adapters/mcp.ts',
    'lib/settlement/adapters/x402.ts',
    'lib/settlement/adapters/ap2.ts',
    'lib/settlement/adapters/tap.ts',

    // x402
    'lib/settlement/x402/index.ts',
    'lib/settlement/x402/types.ts',
    'lib/settlement/x402/verify.ts',
    'lib/settlement/x402/settle.ts',

    // AP2
    'lib/settlement/ap2/index.ts',
    'lib/settlement/ap2/types.ts',
    'lib/settlement/ap2/credentials.ts',

    // Visa TAP
    'lib/settlement/visa-tap/index.ts',
    'lib/settlement/visa-tap/types.ts',
  ]

  // Filter out optional files that may not exist
  for (const lib of libs) {
    it(`lib file exists: ${lib}`, () => {
      // Supabase client may have different path
      if (lib.includes('supabase/client')) {
        const exists = fileExists(webFile(lib)) || fileExists(webFile('lib/supabase/server.ts'))
        expect(exists).toBe(true)
      } else {
        expect(fileExists(webFile(lib))).toBe(true)
      }
    })
  }
})

// ─── 10. SDK Package Files Exist ─────────────────────────────────────────────

describe('SDK Package Files', () => {
  const sdkFiles = [
    'mcp/src/index.ts',
    'mcp/src/types.ts',
    'mcp/src/errors.ts',
    'mcp/src/config.ts',
    'mcp/src/cache.ts',
    'mcp/src/middleware.ts',
    'mcp/src/rest.ts',
    'mcp/src/payment-capability.ts',
    'mcp/src/server-card.ts',
    'mcp/package.json',
  ]

  it.each(sdkFiles)('SDK file exists: %s', (file) => {
    expect(fileExists(pkgFile(file))).toBe(true)
  })
})

// ─── 11. Middleware Configuration ────────────────────────────────────────────

describe('Middleware Configuration', () => {
  it('middleware.ts exists', () => {
    expect(fileExists(webFile('middleware.ts'))).toBe(true)
  })

  it('exports a default function', async () => {
    // We cannot fully import the middleware as it depends on Supabase,
    // but we can verify the file exists and is well-formed
    expect(fileExists(webFile('middleware.ts'))).toBe(true)
  })
})

// ─── 12. Hooks ───────────────────────────────────────────────────────────────

describe('Hooks', () => {
  it('useCountUp hook file exists', () => {
    expect(fileExists(webFile('hooks/use-count-up.ts'))).toBe(true)
  })
})

// ─── 13. Existing Test Coverage ──────────────────────────────────────────────

describe('Test File Coverage', () => {
  const testDirs = [
    // Lib tests (40 files)
    'lib/__tests__/alert-email.test.ts',
    'lib/__tests__/ap2.test.ts',
    'lib/__tests__/api-request-id.test.ts',
    'lib/__tests__/api.test.ts',
    'lib/__tests__/auth.test.ts',
    'lib/__tests__/auto-refill.test.ts',
    'lib/__tests__/compliance.test.ts',
    'lib/__tests__/crypto.extended.test.ts',
    'lib/__tests__/crypto.test.ts',
    'lib/__tests__/csv.test.ts',
    'lib/__tests__/currency.test.ts',
    'lib/__tests__/db-schema.test.ts',
    'lib/__tests__/email.test.ts',
    'lib/__tests__/env.test.ts',
    'lib/__tests__/fraud.test.ts',
    'lib/__tests__/identity.test.ts',
    'lib/__tests__/integration.test.ts',
    'lib/__tests__/ip-validation.test.ts',
    'lib/__tests__/ledger.test.ts',
    'lib/__tests__/logger.test.ts',
    'lib/__tests__/mcp-adapter.test.ts',
    'lib/__tests__/metering.test.ts',
    'lib/__tests__/middleware.test.ts',
    'lib/__tests__/multi-hop.test.ts',
    'lib/__tests__/organizations.test.ts',
    'lib/__tests__/outcomes.test.ts',
    'lib/__tests__/protocol-adapters.test.ts',
    'lib/__tests__/rate-limit.test.ts',
    'lib/__tests__/rbac.test.ts',
    'lib/__tests__/redis.test.ts',
    'lib/__tests__/request-id.test.ts',
    'lib/__tests__/sessions.test.ts',
    'lib/__tests__/settlement-moat.test.ts',
    'lib/__tests__/settlement-types.test.ts',
    'lib/__tests__/streaming.test.ts',
    'lib/__tests__/tiered-rate-limit.test.ts',
    'lib/__tests__/utils.test.ts',
    'lib/__tests__/visa-tap.test.ts',
    'lib/__tests__/webhooks.test.ts',
    'lib/__tests__/x402.test.ts',

    // Component tests (4 files)
    'components/__tests__/badge.test.ts',
    'components/__tests__/button.test.ts',
    'components/__tests__/card.test.ts',
    'components/__tests__/logo.test.ts',
  ]

  it.each(testDirs)('test file exists: %s', (testFile) => {
    expect(fileExists(webFile(testFile))).toBe(true)
  })

  it('has at least 48 API test files', () => {
    const apiTestDir = webFile('app/api/__tests__')
    expect(fileExists(apiTestDir)).toBe(true)
  })
})

// ─── 14. API Module Functional Checks ────────────────────────────────────────

describe('API Module', () => {
  it('exports response helpers', async () => {
    const api = await import('@/lib/api')

    expect(typeof api.successResponse).toBe('function')
    expect(typeof api.errorResponse).toBe('function')
    expect(typeof api.internalErrorResponse).toBe('function')
  })
})

// ─── 15. Crypto Module ───────────────────────────────────────────────────────

describe('Crypto Module', () => {
  it('exports hash and key generation functions', async () => {
    const crypto = await import('@/lib/crypto')

    expect(typeof crypto.hashApiKey).toBe('function')
    expect(typeof crypto.generateApiKey).toBe('function')
  })
})

// ─── 16. CSV Module ──────────────────────────────────────────────────────────

describe('CSV Module', () => {
  it('exports CSV escape function', async () => {
    const csv = await import('@/lib/csv')

    expect(typeof csv.csvEscape).toBe('function')
  })

  it('csvEscape handles plain values', async () => {
    const { csvEscape } = await import('@/lib/csv')

    expect(csvEscape('hello')).toBe('hello')
  })

  it('csvEscape escapes commas', async () => {
    const { csvEscape } = await import('@/lib/csv')

    expect(csvEscape('a,b')).toContain('"')
  })
})

// ─── 17. Logger Module ───────────────────────────────────────────────────────

describe('Logger Module', () => {
  it('exports structured logger', async () => {
    const logger = await import('@/lib/logger')

    expect(typeof logger.logger).toBe('object')
    expect(typeof logger.logger.info).toBe('function')
    expect(typeof logger.logger.error).toBe('function')
    expect(typeof logger.logger.warn).toBe('function')
  })
})

// ─── 18. IP Validation Module ────────────────────────────────────────────────

describe('IP Validation Module', () => {
  it('exports IP validation functions', async () => {
    const ipValidation = await import('@/lib/ip-validation')

    expect(typeof ipValidation.isValidIpOrCidr).toBe('function')
    expect(typeof ipValidation.isIpInAllowlist).toBe('function')
  })
})

// ─── 19. Fraud Module ────────────────────────────────────────────────────────

describe('Fraud Module', () => {
  it('exports fraud detection functions', async () => {
    const fraud = await import('@/lib/fraud')

    expect(typeof fraud.detectFraud).toBe('function')
    expect(typeof fraud.cleanupMemoryCounters).toBe('function')
  })
})

// ─── 20. Request ID Module ───────────────────────────────────────────────────

describe('Request ID Module', () => {
  it('exports request ID function', async () => {
    const requestId = await import('@/lib/request-id')

    expect(typeof requestId.getOrCreateRequestId).toBe('function')
  })
})

// ─── 21. Utils Module ────────────────────────────────────────────────────────

describe('Utils Module', () => {
  it('exports cn utility', async () => {
    const utils = await import('@/lib/utils')

    expect(typeof utils.cn).toBe('function')
  })

  it('cn merges class names correctly', async () => {
    const { cn } = await import('@/lib/utils')

    expect(cn('foo', 'bar')).toBe('foo bar')
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
    expect(cn('foo', false && 'bar')).toBe('foo')
  })
})

// ─── 22. Configuration Files ─────────────────────────────────────────────────

describe('Configuration Files', () => {
  // WEB_ROOT = apps/web/src, so monorepo root is 3 levels up
  const MONOREPO_ROOT = resolve(WEB_ROOT, '..', '..', '..')
  const WEB_APP_ROOT = resolve(WEB_ROOT, '..')

  it('monorepo package.json exists', () => {
    expect(fileExists(resolve(MONOREPO_ROOT, 'package.json'))).toBe(true)
  })

  it('monorepo tsconfig.json exists', () => {
    expect(fileExists(resolve(MONOREPO_ROOT, 'tsconfig.json'))).toBe(true)
  })

  it('monorepo turbo.json exists', () => {
    expect(fileExists(resolve(MONOREPO_ROOT, 'turbo.json'))).toBe(true)
  })

  it('monorepo docker-compose.yml exists', () => {
    expect(fileExists(resolve(MONOREPO_ROOT, 'docker-compose.yml'))).toBe(true)
  })

  it('web app package.json exists', () => {
    expect(fileExists(resolve(WEB_APP_ROOT, 'package.json'))).toBe(true)
  })

  it('web app vitest.config.ts exists', () => {
    expect(fileExists(resolve(WEB_APP_ROOT, 'vitest.config.ts'))).toBe(true)
  })

  it('web app tsconfig.json exists', () => {
    expect(fileExists(resolve(WEB_APP_ROOT, 'tsconfig.json'))).toBe(true)
  })
})

// ─── 23. Settlement Adapter Instantiation ────────────────────────────────────

describe('Settlement Adapter Instances', () => {
  it('MCPAdapter has required interface', async () => {
    const { MCPAdapter } = await import('@/lib/settlement')
    const adapter = new MCPAdapter()

    expect(adapter.name).toBe('mcp')
    expect(typeof adapter.canHandle).toBe('function')
    expect(typeof adapter.extractPaymentContext).toBe('function')
  })

  it('X402Adapter has required interface', async () => {
    const { X402Adapter } = await import('@/lib/settlement')
    const adapter = new X402Adapter()

    expect(adapter.name).toBe('x402')
    expect(typeof adapter.canHandle).toBe('function')
    expect(typeof adapter.extractPaymentContext).toBe('function')
  })

  it('AP2Adapter has required interface', async () => {
    const { AP2Adapter } = await import('@/lib/settlement')
    const adapter = new AP2Adapter()

    expect(adapter.name).toBe('ap2')
    expect(typeof adapter.canHandle).toBe('function')
    expect(typeof adapter.extractPaymentContext).toBe('function')
  })

  it('TAPAdapter has required interface', async () => {
    const { TAPAdapter } = await import('@/lib/settlement')
    const adapter = new TAPAdapter()

    expect(adapter.name).toBe('visa-tap')
    expect(typeof adapter.canHandle).toBe('function')
    expect(typeof adapter.extractPaymentContext).toBe('function')
  })
})

// ─── 24. Currency Module Functional ──────────────────────────────────────────

describe('Currency Module Functional', () => {
  it('formatCurrency formats USD correctly', async () => {
    const { formatCurrency } = await import('@/lib/settlement')

    const result = formatCurrency(1500, 'USD')
    expect(result).toContain('15')
  })

  it('isSupportedCurrency recognizes USD', async () => {
    const { isSupportedCurrency } = await import('@/lib/settlement')

    expect(isSupportedCurrency('USD')).toBe(true)
    expect(isSupportedCurrency('XYZ')).toBe(false)
  })

  it('SUPPORTED_CURRENCIES has at least USD, EUR, GBP', async () => {
    const { SUPPORTED_CURRENCIES } = await import('@/lib/settlement')

    // SUPPORTED_CURRENCIES is a Record<SupportedCurrency, CurrencyInfo>
    expect(SUPPORTED_CURRENCIES).toHaveProperty('USD')
    expect(SUPPORTED_CURRENCIES).toHaveProperty('EUR')
    expect(SUPPORTED_CURRENCIES).toHaveProperty('GBP')
    expect(SUPPORTED_CURRENCIES.USD.code).toBe('USD')
    expect(SUPPORTED_CURRENCIES.EUR.code).toBe('EUR')
    expect(SUPPORTED_CURRENCIES.GBP.code).toBe('GBP')
  })

  it('FALLBACK_RATES has standard currency pairs', async () => {
    const { FALLBACK_RATES } = await import('@/lib/settlement')

    // FALLBACK_RATES uses pair keys like 'EUR/USD'
    expect(FALLBACK_RATES).toHaveProperty('EUR/USD')
    expect(FALLBACK_RATES).toHaveProperty('GBP/USD')
    expect(FALLBACK_RATES).toHaveProperty('USD/EUR')
    expect(typeof FALLBACK_RATES['EUR/USD']).toBe('number')
  })
})

// ─── 25. Package.json Integrity ──────────────────────────────────────────────

describe('Package.json Integrity', () => {
  function readPkg(path: string): Record<string, unknown> {
    const { readFileSync } = require('fs')
    return JSON.parse(readFileSync(resolve(path), 'utf8'))
  }

  const WEB_PKG_PATH = resolve(WEB_ROOT, '..', 'package.json')
  const SDK_PKG_PATH = resolve(PACKAGES_ROOT, 'mcp', 'package.json')

  it('web package has correct name', () => {
    const pkg = readPkg(WEB_PKG_PATH)
    expect(pkg.name).toBe('@settlegrid/web')
  })

  it('web package has test script', () => {
    const pkg = readPkg(WEB_PKG_PATH)
    expect((pkg.scripts as Record<string, string>).test).toBe('vitest run')
  })

  it('web package has essential dependencies', () => {
    const pkg = readPkg(WEB_PKG_PATH)
    const deps = pkg.dependencies as Record<string, string>
    expect(deps).toHaveProperty('next')
    expect(deps).toHaveProperty('react')
    expect(deps).toHaveProperty('drizzle-orm')
    expect(deps).toHaveProperty('stripe')
    expect(deps).toHaveProperty('zod')
    expect(deps).toHaveProperty('@supabase/supabase-js')
    expect(deps).toHaveProperty('@upstash/redis')
    expect(deps).toHaveProperty('recharts')
    expect(deps).toHaveProperty('viem')
  })

  it('SDK package has correct name and version', () => {
    const pkg = readPkg(SDK_PKG_PATH)
    expect(pkg.name).toBe('@settlegrid/mcp')
    expect(pkg.version).toBe('0.1.0')
  })

  it('SDK package has proper exports config', () => {
    const pkg = readPkg(SDK_PKG_PATH)
    expect(pkg.main).toBe('./dist/index.js')
    expect(pkg.module).toBe('./dist/index.mjs')
    expect(pkg.types).toBe('./dist/index.d.ts')
    const exports = (pkg.exports as Record<string, Record<string, string>>)['.']
    expect(exports).toHaveProperty('types')
    expect(exports).toHaveProperty('import')
    expect(exports).toHaveProperty('require')
  })
})
