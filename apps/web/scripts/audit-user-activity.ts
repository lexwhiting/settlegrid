/**
 * Production user-activity audit — READ ONLY.
 *
 * Reproduces (and extends) the 2026-06-06 / 2026-06-14 prod inventories so
 * the "is anyone actually using SettleGrid?" question can be re-answered on
 * demand instead of by hand.
 *
 * Usage (from the repo root, with DATABASE_URL in apps/web/.env.local or env):
 *   npx tsx apps/web/scripts/audit-user-activity.ts            # human report
 *   npx tsx apps/web/scripts/audit-user-activity.ts --json     # machine output
 *   npx tsx apps/web/scripts/audit-user-activity.ts --show-emails
 *
 * Safety:
 *   - Every query runs inside ONE `READ ONLY` transaction; Postgres rejects
 *     any write attempt at the server, so a typo here cannot mutate prod.
 *   - Emails are masked in the human report unless --show-emails is passed,
 *     so the output is safe to paste into chat or a doc.
 *   - No secrets are printed.
 *
 * What counts as what (see src/lib/user-activity-audit.ts):
 *   internal      founder / ops / seed / system accounts (lib/internal-accounts)
 *   test-looking  fixture-shaped emails (example.com, `test`, `+tag`, …)
 *   external      everyone else — the headline numbers
 *   real invoc.   is_test = false AND the tool's developer is external
 */

import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import {
  partitionAccounts,
  countSince,
  maskEmail,
  formatUsd,
  formatDate,
  daysAgo,
  verdict,
  type AccountRow,
} from '../src/lib/user-activity-audit'

// ── CLI flags ────────────────────────────────────────────────────────────────
const argv = new Set(process.argv.slice(2))
const JSON_OUT = argv.has('--json')
const SHOW_EMAILS = argv.has('--show-emails')
const RECENT_LIMIT = 25

// ── Load .env.local manually (no dotenv dependency; same as seed scripts) ───
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL not found in environment or apps/web/.env.local')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  prepare: false,
  idle_timeout: 10,
  connect_timeout: 15,
})

// ── Row shapes ───────────────────────────────────────────────────────────────
interface DeveloperRow extends AccountRow {
  tier: string | null
  stripeConnectStatus: string | null
  balanceCents: number
  isFoundingMember: boolean
  toolCount: number
  activeToolCount: number
  lastKeyUsedAt: Date | null
  lastAuditAt: Date | null
}
interface ConsumerRow extends AccountRow {
  globalBalanceCents: number
  hasStripeCustomer: boolean
  keyCount: number
  lastKeyUsedAt: Date | null
  lastInvocationAt: Date | null
}
interface LabelCount { label: string | null; n: string }

function num(v: string | number | null | undefined): number {
  return typeof v === 'string' ? Number(v) : v ?? 0
}

/**
 * All queries, run against `q` — a handle to ONE read-only transaction.
 * (postgres-js types its transaction handle via `Omit<Sql, …>`, which drops
 * the tagged-template call signature in TypeScript, hence the cast at the
 * call site; at runtime it is the same callable object.)
 */
async function buildReport(q: typeof sql, now: Date) {
  {
    // ── Accounts ─────────────────────────────────────────────────────────
    const developers = await q<DeveloperRow[]>`
      SELECT d.id, d.email, d.created_at AS "createdAt", d.tier,
             d.stripe_connect_status AS "stripeConnectStatus",
             d.balance_cents AS "balanceCents",
             d.is_founding_member AS "isFoundingMember",
             (SELECT count(*) FROM tools t WHERE t.developer_id = d.id)::int AS "toolCount",
             (SELECT count(*) FROM tools t WHERE t.developer_id = d.id AND t.status = 'active')::int AS "activeToolCount",
             (SELECT max(k.last_used_at) FROM developer_api_keys k WHERE k.developer_id = d.id) AS "lastKeyUsedAt",
             (SELECT max(a.created_at) FROM audit_logs a WHERE a.developer_id = d.id) AS "lastAuditAt"
      FROM developers d
      ORDER BY d.created_at DESC`
    const consumers = await q<ConsumerRow[]>`
      SELECT c.id, c.email, c.created_at AS "createdAt",
             c.global_balance_cents AS "globalBalanceCents",
             (c.stripe_customer_id IS NOT NULL) AS "hasStripeCustomer",
             (SELECT count(*) FROM api_keys k WHERE k.consumer_id = c.id)::int AS "keyCount",
             (SELECT max(k.last_used_at) FROM api_keys k WHERE k.consumer_id = c.id) AS "lastKeyUsedAt",
             (SELECT max(i.created_at) FROM invocations i WHERE i.consumer_id = c.id AND i.is_test = false) AS "lastInvocationAt"
      FROM consumers c
      ORDER BY c.created_at DESC`

    const devs = partitionAccounts(developers)
    const cons = partitionAccounts(consumers)
    const externalDevIds = devs.external.map((d) => d.id)
    const externalConsumerIds = cons.external.map((c) => c.id)

    // ── Tools ────────────────────────────────────────────────────────────
    const toolsByStatus = await q<LabelCount[]>`
      SELECT status AS label, count(*) AS n FROM tools GROUP BY status ORDER BY n DESC`
    const toolsByEcosystem = await q<LabelCount[]>`
      SELECT coalesce(source_ecosystem, '(native)') AS label, count(*) AS n
      FROM tools GROUP BY source_ecosystem ORDER BY n DESC`
    const [toolTotals] = await q<{ total: string; unclaimed: string; active: string; activeExternal: string; created30d: string; createdExternal30d: string }[]>`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE claim_token IS NOT NULL) AS unclaimed,
             count(*) FILTER (WHERE status = 'active') AS active,
             count(*) FILTER (WHERE status = 'active' AND developer_id::text = ANY(${externalDevIds}::text[])) AS "activeExternal",
             count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS created30d,
             count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND developer_id::text = ANY(${externalDevIds}::text[])) AS "createdExternal30d"
      FROM tools`

    // ── Invocations (the core "is it used" signal) ───────────────────────
    const [inv] = await q<{
      total: string; nonTest: string; real7d: string; real30d: string; real90d: string
      lastReal: Date | null; lastAny: Date | null; distinctConsumers30d: string; distinctTools30d: string
      realCostCents30d: string
    }[]>`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE i.is_test = false) AS "nonTest",
             count(*) FILTER (WHERE i.is_test = false AND t.developer_id::text = ANY(${externalDevIds}::text[]) AND i.created_at >= now() - interval '7 days')  AS real7d,
             count(*) FILTER (WHERE i.is_test = false AND t.developer_id::text = ANY(${externalDevIds}::text[]) AND i.created_at >= now() - interval '30 days') AS real30d,
             count(*) FILTER (WHERE i.is_test = false AND t.developer_id::text = ANY(${externalDevIds}::text[]) AND i.created_at >= now() - interval '90 days') AS real90d,
             max(i.created_at) FILTER (WHERE i.is_test = false AND t.developer_id::text = ANY(${externalDevIds}::text[])) AS "lastReal",
             max(i.created_at) AS "lastAny",
             count(DISTINCT i.consumer_id) FILTER (WHERE i.is_test = false AND i.created_at >= now() - interval '30 days') AS "distinctConsumers30d",
             count(DISTINCT i.tool_id) FILTER (WHERE i.is_test = false AND i.created_at >= now() - interval '30 days') AS "distinctTools30d",
             coalesce(sum(i.cost_cents) FILTER (WHERE i.is_test = false AND t.developer_id::text = ANY(${externalDevIds}::text[]) AND i.created_at >= now() - interval '30 days'), 0) AS "realCostCents30d"
      FROM invocations i JOIN tools t ON t.id = i.tool_id`
    const invocationsByMonth = await q<{ month: string; total: string; nonTest: string }[]>`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             count(*) AS total,
             count(*) FILTER (WHERE is_test = false) AS "nonTest"
      FROM invocations
      WHERE created_at >= now() - interval '12 months'
      GROUP BY 1 ORDER BY 1`

    // ── Money ────────────────────────────────────────────────────────────
    const [purchases] = await q<{ completed: string; completedCents: string; completed30d: string; completedCents30d: string; lastCompleted: Date | null; externalCompleted: string }[]>`
      SELECT count(*) FILTER (WHERE status = 'completed') AS completed,
             coalesce(sum(amount_cents) FILTER (WHERE status = 'completed'), 0) AS "completedCents",
             count(*) FILTER (WHERE status = 'completed' AND created_at >= now() - interval '30 days') AS completed30d,
             coalesce(sum(amount_cents) FILTER (WHERE status = 'completed' AND created_at >= now() - interval '30 days'), 0) AS "completedCents30d",
             max(created_at) FILTER (WHERE status = 'completed') AS "lastCompleted",
             count(*) FILTER (WHERE status = 'completed' AND consumer_id::text = ANY(${externalConsumerIds}::text[])) AS "externalCompleted"
      FROM purchases`
    const payoutsByStatus = await q<{ label: string; n: string; cents: string; last: Date | null }[]>`
      SELECT status AS label, count(*) AS n, coalesce(sum(amount_cents), 0) AS cents, max(created_at) AS last
      FROM payouts GROUP BY status ORDER BY n DESC`
    const [ledger] = await q<{ entries: string; entries30d: string; lastEntry: Date | null; fundedAccounts: string; totalBalanceCents: string }[]>`
      SELECT (SELECT count(*) FROM ledger_entries) AS entries,
             (SELECT count(*) FROM ledger_entries WHERE created_at >= now() - interval '30 days') AS entries30d,
             (SELECT max(created_at) FROM ledger_entries) AS "lastEntry",
             (SELECT count(*) FROM accounts WHERE balance_cents > 0) AS "fundedAccounts",
             (SELECT coalesce(sum(balance_cents), 0) FROM accounts) AS "totalBalanceCents"`
    const [sessions] = await q<{ total: string; total30d: string; spentCents30d: string; last: Date | null }[]>`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS total30d,
             coalesce(sum(spent_cents) FILTER (WHERE created_at >= now() - interval '30 days'), 0) AS "spentCents30d",
             max(created_at) AS last
      FROM workflow_sessions`

    // ── Keys, logins-by-proxy, engagement ────────────────────────────────
    const [keys] = await q<{ consumerKeys: string; consumerKeysUsed30d: string; consumerLastUsed: Date | null; devKeys: string; devKeysUsed30d: string; devLastUsed: Date | null }[]>`
      SELECT (SELECT count(*) FROM api_keys) AS "consumerKeys",
             (SELECT count(*) FROM api_keys WHERE last_used_at >= now() - interval '30 days') AS "consumerKeysUsed30d",
             (SELECT max(last_used_at) FROM api_keys) AS "consumerLastUsed",
             (SELECT count(*) FROM developer_api_keys) AS "devKeys",
             (SELECT count(*) FROM developer_api_keys WHERE last_used_at >= now() - interval '30 days') AS "devKeysUsed30d",
             (SELECT max(last_used_at) FROM developer_api_keys) AS "devLastUsed"`
    const auditActions30d = await q<LabelCount[]>`
      SELECT action AS label, count(*) AS n
      FROM audit_logs
      WHERE created_at >= now() - interval '30 days'
        AND (developer_id::text = ANY(${externalDevIds}::text[]) OR consumer_id::text = ANY(${externalConsumerIds}::text[]))
      GROUP BY action ORDER BY n DESC LIMIT 15`
    const [engagement] = await q<{ reviews: string; reviews30d: string; waitlist: string; waitlist30d: string; agents: string; agentsSeen30d: string; telemetry30d: string; suppressions: string }[]>`
      SELECT (SELECT count(*) FROM tool_reviews) AS reviews,
             (SELECT count(*) FROM tool_reviews WHERE created_at >= now() - interval '30 days') AS reviews30d,
             (SELECT count(*) FROM waitlist_signups) AS waitlist,
             (SELECT count(*) FROM waitlist_signups WHERE created_at >= now() - interval '30 days') AS waitlist30d,
             (SELECT count(*) FROM agent_identities) AS agents,
             (SELECT count(*) FROM agent_identities WHERE last_seen_at >= now() - interval '30 days') AS "agentsSeen30d",
             (SELECT count(*) FROM kernel_telemetry WHERE occurred_at >= now() - interval '30 days') AS telemetry30d,
             (SELECT count(*) FROM email_suppressions) AS suppressions`
    const waitlistByFeature = await q<LabelCount[]>`
      SELECT feature AS label, count(*) AS n FROM waitlist_signups GROUP BY feature ORDER BY n DESC LIMIT 10`

    // ── Assemble ─────────────────────────────────────────────────────────
    const stripeByStatus: Record<string, number> = {}
    for (const d of devs.external) {
      const k = d.stripeConnectStatus ?? 'not_started'
      stripeByStatus[k] = (stripeByStatus[k] ?? 0) + 1
    }
    const lastRealDays = daysAgo(inv.lastReal, now)
    const headline = {
      externalDevSignups30d: countSince(devs.external, 30, now),
      externalConsumerSignups30d: countSince(cons.external, 30, now),
      realInvocations30d: num(inv.real30d),
      completedPurchases30d: num(purchases.completed30d),
      lastRealInvocationDaysAgo: lastRealDays,
    }

    return {
      generatedAt: now.toISOString(),
      verdict: verdict(headline),
      developers: {
        total: developers.length,
        internal: devs.internal.length,
        testLooking: devs.testLooking.length,
        external: devs.external.length,
        externalSignups: { d7: countSince(devs.external, 7, now), d30: headline.externalDevSignups30d, d90: countSince(devs.external, 90, now) },
        externalWithTools: devs.external.filter((d) => d.toolCount > 0).length,
        externalWithActiveTools: devs.external.filter((d) => d.activeToolCount > 0).length,
        externalWithBalance: devs.external.filter((d) => num(d.balanceCents) > 0).length,
        externalFoundingMembers: devs.external.filter((d) => d.isFoundingMember).length,
        externalStripeConnect: stripeByStatus,
        externalActiveLast30d: devs.external.filter((d) => (daysAgo(d.lastAuditAt, now) ?? 1e9) <= 30 || (daysAgo(d.lastKeyUsedAt, now) ?? 1e9) <= 30).length,
        recentExternal: devs.external.slice(0, RECENT_LIMIT).map((d) => ({
          email: SHOW_EMAILS ? d.email : maskEmail(d.email),
          signedUp: formatDate(d.createdAt),
          tier: d.tier,
          stripe: d.stripeConnectStatus ?? 'not_started',
          tools: d.toolCount,
          activeTools: d.activeToolCount,
          lastActivity: formatDate(d.lastAuditAt ?? d.lastKeyUsedAt),
        })),
      },
      consumers: {
        total: consumers.length,
        internal: cons.internal.length,
        testLooking: cons.testLooking.length,
        external: cons.external.length,
        externalSignups: { d7: countSince(cons.external, 7, now), d30: headline.externalConsumerSignups30d, d90: countSince(cons.external, 90, now) },
        externalFunded: cons.external.filter((c) => num(c.globalBalanceCents) > 0).length,
        externalWithStripeCustomer: cons.external.filter((c) => c.hasStripeCustomer).length,
        externalWithKeys: cons.external.filter((c) => c.keyCount > 0).length,
        externalInvokedLast30d: cons.external.filter((c) => (daysAgo(c.lastInvocationAt, now) ?? 1e9) <= 30).length,
        recentExternal: cons.external.slice(0, RECENT_LIMIT).map((c) => ({
          email: SHOW_EMAILS ? c.email : maskEmail(c.email),
          signedUp: formatDate(c.createdAt),
          balance: formatUsd(c.globalBalanceCents),
          stripeCustomer: c.hasStripeCustomer,
          keys: c.keyCount,
          lastInvocation: formatDate(c.lastInvocationAt),
        })),
      },
      tools: {
        total: num(toolTotals.total),
        unclaimedCrawled: num(toolTotals.unclaimed),
        active: num(toolTotals.active),
        activeByExternalDevelopers: num(toolTotals.activeExternal),
        created30d: num(toolTotals.created30d),
        createdByExternal30d: num(toolTotals.createdExternal30d),
        byStatus: Object.fromEntries(toolsByStatus.map((r) => [r.label ?? '(null)', num(r.n)])),
        byEcosystem: Object.fromEntries(toolsByEcosystem.map((r) => [r.label ?? '(null)', num(r.n)])),
      },
      invocations: {
        total: num(inv.total),
        nonTest: num(inv.nonTest),
        real: { d7: num(inv.real7d), d30: num(inv.real30d), d90: num(inv.real90d) },
        realCost30d: formatUsd(inv.realCostCents30d),
        lastReal: formatDate(inv.lastReal),
        lastRealDaysAgo: lastRealDays,
        lastAny: formatDate(inv.lastAny),
        distinctConsumers30d: num(inv.distinctConsumers30d),
        distinctTools30d: num(inv.distinctTools30d),
        byMonth: invocationsByMonth.map((r) => ({ month: r.month, total: num(r.total), nonTest: num(r.nonTest) })),
      },
      money: {
        purchasesCompleted: num(purchases.completed),
        purchasesCompletedTotal: formatUsd(purchases.completedCents),
        purchasesCompleted30d: num(purchases.completed30d),
        purchasesCompletedTotal30d: formatUsd(purchases.completedCents30d),
        purchasesByExternalConsumers: num(purchases.externalCompleted),
        lastCompletedPurchase: formatDate(purchases.lastCompleted),
        payouts: payoutsByStatus.map((p) => ({ status: p.label, count: num(p.n), total: formatUsd(p.cents), last: formatDate(p.last) })),
        ledgerEntries: num(ledger.entries),
        ledgerEntries30d: num(ledger.entries30d),
        lastLedgerEntry: formatDate(ledger.lastEntry),
        fundedLedgerAccounts: num(ledger.fundedAccounts),
        ledgerTotalBalance: formatUsd(ledger.totalBalanceCents),
        workflowSessions: num(sessions.total),
        workflowSessions30d: num(sessions.total30d),
        workflowSpent30d: formatUsd(sessions.spentCents30d),
        lastWorkflowSession: formatDate(sessions.last),
      },
      keys: {
        consumerKeys: num(keys.consumerKeys),
        consumerKeysUsed30d: num(keys.consumerKeysUsed30d),
        consumerKeyLastUsed: formatDate(keys.consumerLastUsed),
        developerKeys: num(keys.devKeys),
        developerKeysUsed30d: num(keys.devKeysUsed30d),
        developerKeyLastUsed: formatDate(keys.devLastUsed),
      },
      engagement: {
        externalAuditActions30d: Object.fromEntries(auditActions30d.map((r) => [r.label ?? '(null)', num(r.n)])),
        reviews: num(engagement.reviews),
        reviews30d: num(engagement.reviews30d),
        waitlist: num(engagement.waitlist),
        waitlist30d: num(engagement.waitlist30d),
        waitlistByFeature: Object.fromEntries(waitlistByFeature.map((r) => [r.label ?? '(null)', num(r.n)])),
        agentIdentities: num(engagement.agents),
        agentsSeen30d: num(engagement.agentsSeen30d),
        kernelTelemetryEvents30d: num(engagement.telemetry30d),
        emailSuppressions: num(engagement.suppressions),
      },
    }
  }
}

type Report = Awaited<ReturnType<typeof buildReport>>

async function main() {
  const now = new Date()
  // Everything runs in ONE read-only transaction; Postgres rejects writes.
  const report: Report = await sql.begin('read only', (tx) =>
    buildReport(tx as unknown as typeof sql, now),
  )

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  printReport(report)
}

function line(label: string, value: unknown) {
  console.log(`  ${label.padEnd(44)} ${String(value)}`)
}
function section(title: string) {
  console.log(`\n${title}\n${'─'.repeat(title.length)}`)
}
function kv(obj: Record<string, unknown>) {
  const entries = Object.entries(obj)
  if (entries.length === 0) {
    console.log('  (none)')
    return
  }
  for (const [k, v] of entries) line(k, v)
}

function printReport(r: Report) {
  console.log(`SettleGrid production user-activity audit — ${r.generatedAt}`)
  console.log(`(read-only; emails ${SHOW_EMAILS ? 'SHOWN' : 'masked — pass --show-emails to reveal'})`)
  console.log(`\nVERDICT: ${r.verdict}`)

  section('Developers')
  line('total / internal / test-looking / external', `${r.developers.total} / ${r.developers.internal} / ${r.developers.testLooking} / ${r.developers.external}`)
  line('external signups 7d / 30d / 90d', `${r.developers.externalSignups.d7} / ${r.developers.externalSignups.d30} / ${r.developers.externalSignups.d90}`)
  line('external with ≥1 tool / ≥1 active tool', `${r.developers.externalWithTools} / ${r.developers.externalWithActiveTools}`)
  line('external with balance > 0', r.developers.externalWithBalance)
  line('external founding members', r.developers.externalFoundingMembers)
  line('external with any activity in 30d', r.developers.externalActiveLast30d)
  console.log('  external Stripe Connect status:')
  kv(r.developers.externalStripeConnect)
  console.log(`  newest external developers (up to ${RECENT_LIMIT}):`)
  console.table(r.developers.recentExternal)

  section('Consumers')
  line('total / internal / test-looking / external', `${r.consumers.total} / ${r.consumers.internal} / ${r.consumers.testLooking} / ${r.consumers.external}`)
  line('external signups 7d / 30d / 90d', `${r.consumers.externalSignups.d7} / ${r.consumers.externalSignups.d30} / ${r.consumers.externalSignups.d90}`)
  line('external funded (balance > 0)', r.consumers.externalFunded)
  line('external with Stripe customer', r.consumers.externalWithStripeCustomer)
  line('external with ≥1 API key', r.consumers.externalWithKeys)
  line('external that invoked a tool in 30d', r.consumers.externalInvokedLast30d)
  console.log(`  newest external consumers (up to ${RECENT_LIMIT}):`)
  console.table(r.consumers.recentExternal)

  section('Tools')
  line('total / active / active by external devs', `${r.tools.total} / ${r.tools.active} / ${r.tools.activeByExternalDevelopers}`)
  line('crawled & unclaimed', r.tools.unclaimedCrawled)
  line('created 30d / by external devs', `${r.tools.created30d} / ${r.tools.createdByExternal30d}`)
  console.log('  by status:'); kv(r.tools.byStatus)
  console.log('  by source ecosystem:'); kv(r.tools.byEcosystem)

  section('Invocations')
  line('total / non-test', `${r.invocations.total} / ${r.invocations.nonTest}`)
  line('REAL (non-test, external dev) 7d / 30d / 90d', `${r.invocations.real.d7} / ${r.invocations.real.d30} / ${r.invocations.real.d90}`)
  line('real billed cost 30d', r.invocations.realCost30d)
  line('last real invocation', `${r.invocations.lastReal} (${r.invocations.lastRealDaysAgo ?? 'n/a'} days ago)`)
  line('last invocation of any kind', r.invocations.lastAny)
  line('distinct consumers / tools with non-test calls 30d', `${r.invocations.distinctConsumers30d} / ${r.invocations.distinctTools30d}`)
  console.log('  by month (last 12):')
  console.table(r.invocations.byMonth)

  section('Money')
  line('completed purchases (all time)', `${r.money.purchasesCompleted} = ${r.money.purchasesCompletedTotal}`)
  line('completed purchases 30d', `${r.money.purchasesCompleted30d} = ${r.money.purchasesCompletedTotal30d}`)
  line('completed purchases by external consumers', r.money.purchasesByExternalConsumers)
  line('last completed purchase', r.money.lastCompletedPurchase)
  console.log('  payouts by status:')
  console.table(r.money.payouts)
  line('ledger entries all / 30d', `${r.money.ledgerEntries} / ${r.money.ledgerEntries30d}`)
  line('last ledger entry', r.money.lastLedgerEntry)
  line('funded ledger accounts / total balance', `${r.money.fundedLedgerAccounts} / ${r.money.ledgerTotalBalance}`)
  line('workflow sessions all / 30d / spent 30d', `${r.money.workflowSessions} / ${r.money.workflowSessions30d} / ${r.money.workflowSpent30d}`)
  line('last workflow session', r.money.lastWorkflowSession)

  section('API keys')
  line('consumer keys / used 30d / last used', `${r.keys.consumerKeys} / ${r.keys.consumerKeysUsed30d} / ${r.keys.consumerKeyLastUsed}`)
  line('developer keys / used 30d / last used', `${r.keys.developerKeys} / ${r.keys.developerKeysUsed30d} / ${r.keys.developerKeyLastUsed}`)

  section('Engagement')
  console.log('  external audit-log actions, last 30d:'); kv(r.engagement.externalAuditActions30d)
  line('tool reviews all / 30d', `${r.engagement.reviews} / ${r.engagement.reviews30d}`)
  line('waitlist signups all / 30d', `${r.engagement.waitlist} / ${r.engagement.waitlist30d}`)
  console.log('  waitlist by feature:'); kv(r.engagement.waitlistByFeature)
  line('agent identities / seen 30d', `${r.engagement.agentIdentities} / ${r.engagement.agentsSeen30d}`)
  line('kernel telemetry events 30d', r.engagement.kernelTelemetryEvents30d)
  line('email suppressions (bounces/unsubs)', r.engagement.emailSuppressions)
  console.log('\nTip: --json for machine-readable output; --show-emails to unmask addresses.')
}

main()
  .catch((err) => {
    console.error('Audit failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => sql.end({ timeout: 5 }))
