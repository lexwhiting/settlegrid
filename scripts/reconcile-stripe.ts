#!/usr/bin/env tsx
/**
 * P3.RAIL2 — Stripe reconciliation orchestrator.
 *
 * Runs nightly via `.github/workflows/stripe-reconciliation.yml` at
 * 08:00 UTC and:
 *
 *   1. Loads the SettleGrid unified ledger rows (rail =
 *      'stripe-connect') for the given UTC calendar day, both legs
 *      (charges + transfers).
 *   2. Pages through Stripe Balance Transactions and Stripe Connect
 *      Transfers for the same UTC window via the bounded-pagination
 *      helpers in `@settlegrid/rails`.
 *   3. Calls `reconcileLeg()` for each leg, producing two frozen
 *      `DriftReport`s.
 *   4. Writes the combined report to
 *      `data/reconciliation/stripe/{YYYY-MM-DD}.json`. The file is
 *      append-only — the script refuses to overwrite an existing
 *      file unless `--force` is passed.
 *   5. Posts a one-line summary to Slack/Discord (if webhook env vars
 *      are present).
 *   6. Calls `shouldOpenIssue()` against the reports + the last
 *      issue timestamp from `.reconcile-state.json`. If the gate
 *      says open AND we are not rate-limited, opens a GitHub issue
 *      via `gh` and updates the state file.
 *
 * # Hostile contracts (per P3.RAIL2 hostile a/b/c/d)
 *
 *   - **(a) Drift threshold**: 1% (100 bps) by default, override
 *     with `--threshold-bps`. Below → no GitHub issue (still
 *     written to disk).
 *   - **(b) Cents arithmetic only.** All comparison happens via the
 *     `@settlegrid/rails` pure helpers. The orchestrator never does
 *     float math.
 *   - **(c) GitHub issue rate-limited** to one per 24h via
 *     `.reconcile-state.json` + `shouldOpenIssue()`. A 24h Stripe
 *     outage producing 24 drift reports opens at most one issue.
 *   - **(d) Two legs reconciled separately**: charges (Balance
 *     Transactions) and transfers (Connect Transfers) never mix.
 *
 * # Usage
 *
 *   npx tsx scripts/reconcile-stripe.ts                          # yesterday UTC
 *   npx tsx scripts/reconcile-stripe.ts --date 2026-04-23
 *   npx tsx scripts/reconcile-stripe.ts --dry-run                # no DB / Stripe / disk
 *   npx tsx scripts/reconcile-stripe.ts --force                  # overwrite same-day report
 *
 * Env vars (orchestration; pure helpers don't read env):
 *   - DATABASE_URL                — read-only Postgres URL (script never writes)
 *   - STRIPE_RECONCILE_KEY        — Stripe restricted key with
 *                                   rak_balance_transaction_read +
 *                                   rak_transfer_read (preferred)
 *   - STRIPE_SECRET_KEY           — fallback for local dev only
 *   - SLACK_RECONCILE_WEBHOOK     — optional, posts the summary
 *   - DISCORD_RECONCILE_WEBHOOK   — optional, posts the summary
 *   - GH_TOKEN / GITHUB_TOKEN     — for `gh issue create`
 *   - RECONCILE_REPO_SLUG         — owner/name (default 'settlegrid/settlegrid')
 *
 * NOTE: This file is IMPORT-SAFE — it does not run anything at module
 * load. The CLI entry-point gate at the bottom invokes `main()` only
 * when the script is run directly, so unit tests under
 * `scripts/__tests__/reconcile-stripe.test.ts` can import + mock the
 * exported helpers without triggering DB / Stripe calls.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

import {
  DEFAULT_DRIFT_THRESHOLD_BPS,
  DEFAULT_ISSUE_RATE_LIMIT_HOURS,
  fetchBalanceTransactionsForUtcDay,
  fetchTransfersForUtcDay,
  formatReconcileSummary,
  reconcileLeg,
  shouldOpenIssue,
  utcDayBounds,
  type DriftReport,
  type LedgerEntryForReconcile,
  type StripeReconcileClient,
} from '@settlegrid/rails'

// ─── Repo path constants ─────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const REPORTS_DIR = join(REPO_ROOT, 'data', 'reconciliation', 'stripe')
const STATE_FILE = join(REPO_ROOT, 'data', 'reconciliation', '.reconcile-state.json')

// ─── CLI args ────────────────────────────────────────────────────────

export interface CliArgs {
  /** UTC calendar day to reconcile, 'YYYY-MM-DD'. Defaults to yesterday. */
  dateUtc: string
  /** When set: do not touch DB, Stripe, disk, or webhooks. Print only. */
  dryRun: boolean
  /** Allow overwriting an existing report file for the same date. */
  force: boolean
  /** Override the default 100 bps (1%) drift threshold. */
  thresholdBps: number
  /** Override the default 24h issue rate-limit window. */
  rateLimitHours: number
  /** Print help and exit cleanly. The exit lives in `main()`, not
   *  `parseArgs()`, so importing tests don't kill the test runner. */
  help: boolean
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    dateUtc: yesterdayUtcIso(),
    dryRun: false,
    force: false,
    thresholdBps: DEFAULT_DRIFT_THRESHOLD_BPS,
    rateLimitHours: DEFAULT_ISSUE_RATE_LIMIT_HOURS,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--date') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        throw new Error('--date requires a YYYY-MM-DD value')
      }
      // Validate up-front via utcDayBounds — surfaces malformed
      // input before we go to the DB.
      utcDayBounds(v)
      args.dateUtc = v
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--force') {
      args.force = true
    } else if (arg === '--threshold-bps') {
      const v = argv[++i]
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0) {
        throw new Error(`--threshold-bps requires a non-negative integer; got ${v}`)
      }
      args.thresholdBps = n
    } else if (arg === '--rate-limit-hours') {
      const v = argv[++i]
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`--rate-limit-hours requires a non-negative number; got ${v}`)
      }
      args.rateLimitHours = n
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return args
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage: npx tsx scripts/reconcile-stripe.ts [flags]',
      '',
      'Flags:',
      '  --date YYYY-MM-DD         UTC day to reconcile (default: yesterday UTC)',
      '  --dry-run                 Skip DB/Stripe/disk/webhook calls; print plan',
      '  --force                   Overwrite existing report for the same day',
      '  --threshold-bps N         Drift threshold in bps (default 100 = 1%)',
      '  --rate-limit-hours N      GitHub issue rate-limit window (default 24)',
      '  -h, --help                Show this help',
    ].join('\n'),
  )
}

/** UTC date for "yesterday" in 'YYYY-MM-DD'. Pure given the clock. */
export function yesterdayUtcIso(nowMs: number = Date.now()): string {
  const d = new Date(nowMs - 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

// ─── DB query (lazy-loaded so dry-run never opens a connection) ──────

/**
 * Defaults to a real Postgres + Drizzle ledger query against
 * `apps/web/src/lib/db`. Tests inject a mock that returns the same
 * shape so the orchestrator can be exercised without a live DB.
 */
export type LedgerQueryFn = (
  dateUtc: string,
) => Promise<readonly LedgerEntryForReconcile[]>

async function defaultLedgerQuery(
  dateUtc: string,
): Promise<readonly LedgerEntryForReconcile[]> {
  // Raw postgres-js query — keeps the script independent of the
  // apps/web Drizzle build (which pulls in Next env validation +
  // a heavyweight schema graph). The reconciler only needs five
  // columns; a parameterized SELECT is simpler and lets the dry-run
  // path skip the DB module entirely.
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required (or pass --dry-run)')
  }
  const postgresMod = await import('postgres')
  // postgres-js publishes the constructor as both the default export and
  // the namespace's call signature; pick the default-shape explicitly.
  const postgres =
    (postgresMod as unknown as { default: typeof import('postgres') }).default ??
    postgresMod
  const sql = postgres(dbUrl, {
    max: 2,
    ssl: { rejectUnauthorized: false },
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 10,
  })
  try {
    const { startSec, endSec } = utcDayBounds(dateUtc)
    const startIso = new Date(startSec * 1000).toISOString()
    const endIso = new Date(endSec * 1000).toISOString()
    const rows = (await sql`
      SELECT
        id::text          AS id,
        external_ref      AS "externalRef",
        amount_cents      AS "amountCents",
        rail              AS rail,
        settled_at        AS "settledAt"
      FROM ledger_entries
      WHERE rail = 'stripe-connect'
        AND settled_at >= ${startIso}
        AND settled_at <  ${endIso}
    `) as ReadonlyArray<{
      id: string
      externalRef: string | null
      amountCents: number
      rail: string | null
      settledAt: Date | string | null
    }>
    return rows.map((r) => ({
      id: r.id,
      externalRef: r.externalRef,
      amountCents: r.amountCents,
      rail: r.rail ?? 'stripe-connect',
      settledAt:
        r.settledAt instanceof Date
          ? r.settledAt.toISOString()
          : (r.settledAt ?? null),
    }))
  } finally {
    await sql.end({ timeout: 5 })
  }
}

// ─── Stripe client (lazy-loaded too) ─────────────────────────────────

export type StripeClientFactory = () => StripeReconcileClient | Promise<StripeReconcileClient>

async function defaultStripeClient(): Promise<StripeReconcileClient> {
  // Per spec: prefer a restricted key with `rak_balance_transaction_read`
  // + `rak_transfer_read` scopes (least-privilege; can't initiate
  // charges or transfers). Falls back to the platform STRIPE_SECRET_KEY
  // for local development where rotating a separate restricted key is
  // overkill.
  const secret =
    process.env.STRIPE_RECONCILE_KEY ?? process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error(
      'STRIPE_RECONCILE_KEY (or STRIPE_SECRET_KEY) is required (or pass --dry-run)',
    )
  }
  const StripeMod = (await import('stripe')) as typeof import('stripe')
  const Stripe = StripeMod.default
  // Pinned to the codebase-wide apiVersion (see apps/web/src/lib/rails.ts).
  // The type literal is the pinned version; the bracketed cast is the
  // SDK-published `LatestApiVersion` brand so a future SDK bump compiles
  // without code-churn here.
  const stripe = new Stripe(
    secret,
    { apiVersion: '2025-02-24.acacia' } as ConstructorParameters<typeof Stripe>[1],
  )
  // Stripe's typed signatures match StripeReconcileClient's shape;
  // the explicit cast keeps the orchestrator dependency-free of the
  // full Stripe types.
  return {
    balanceTransactions: stripe.balanceTransactions as unknown as StripeReconcileClient['balanceTransactions'],
    transfers: stripe.transfers as unknown as StripeReconcileClient['transfers'],
  }
}

// ─── Combined report ─────────────────────────────────────────────────

export interface CombinedReport {
  readonly schemaVersion: 1
  readonly dateUtc: string
  readonly generatedAtIso: string
  readonly thresholdBps: number
  readonly charges: DriftReport
  readonly transfers: DriftReport
}

// ─── State file (last GitHub issue timestamp) ────────────────────────

export interface ReconcileState {
  /** ISO-8601 UTC timestamp of the last GitHub issue created by this
   *  script, or null if no issue has been opened yet. Used by
   *  `shouldOpenIssue()` to enforce the 24h rate-limit window. */
  lastIssueAtIso: string | null
}

export type ReadStateResult =
  | { ok: true; state: ReconcileState }
  | { ok: false; reason: 'corrupt-json' | 'invalid-shape'; raw: string }

/**
 * Read the rate-limit state file.
 *
 * Returns a discriminated union so the orchestrator can FAIL-CLOSED
 * on corruption (refuse to open an issue) instead of the previous
 * silent "treat as never-issued" behaviour, which would have caused a
 * persistent-drift run to open a fresh issue every day until the
 * file was repaired — the exact spam scenario hostile (c) forbids.
 */
export function readState(file: string = STATE_FILE): ReadStateResult {
  if (!existsSync(file)) {
    return { ok: true, state: { lastIssueAtIso: null } }
  }
  let text = ''
  try {
    text = readFileSync(file, 'utf-8')
  } catch {
    return { ok: false, reason: 'corrupt-json', raw: '<read error>' }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'corrupt-json', raw: text.slice(0, 200) }
  }
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'lastIssueAtIso' in raw &&
    ((raw as { lastIssueAtIso: unknown }).lastIssueAtIso === null ||
      typeof (raw as { lastIssueAtIso: unknown }).lastIssueAtIso === 'string')
  ) {
    return {
      ok: true,
      state: {
        lastIssueAtIso:
          (raw as { lastIssueAtIso: string | null }).lastIssueAtIso ?? null,
      },
    }
  }
  return { ok: false, reason: 'invalid-shape', raw: text.slice(0, 200) }
}

export function writeState(state: ReconcileState, file: string = STATE_FILE): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(state, null, 2) + '\n', 'utf-8')
}

// ─── Webhook posting ─────────────────────────────────────────────────

/** Hard cap on a single webhook call. A slow Slack/Discord endpoint
 *  must NOT eat into the workflow's overall 15-minute timeout. */
const WEBHOOK_TIMEOUT_MS = 5_000

/**
 * Best-effort post to Slack and/or Discord webhooks. A failed webhook
 * never aborts the script — reconciliation must not be blocked by an
 * unrelated downstream outage. Each call is bounded by
 * `WEBHOOK_TIMEOUT_MS` via AbortController so a hung endpoint returns
 * `'failed'` after 5 seconds rather than stalling the workflow.
 */
export async function postSummaryWebhooks(
  summary: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ slack: 'sent' | 'skipped' | 'failed'; discord: 'sent' | 'skipped' | 'failed' }> {
  const result = { slack: 'skipped' as const, discord: 'skipped' as const } as {
    slack: 'sent' | 'skipped' | 'failed'
    discord: 'sent' | 'skipped' | 'failed'
  }
  result.slack = await postOne(
    env.SLACK_RECONCILE_WEBHOOK,
    JSON.stringify({ text: summary }),
    fetchImpl,
  )
  result.discord = await postOne(
    env.DISCORD_RECONCILE_WEBHOOK,
    JSON.stringify({ content: summary }),
    fetchImpl,
  )
  return result
}

async function postOne(
  url: string | undefined,
  body: string,
  fetchImpl: typeof fetch,
): Promise<'sent' | 'skipped' | 'failed'> {
  if (!url || !/^https:\/\//.test(url)) return 'skipped'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: controller.signal,
    })
    return res.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  } finally {
    clearTimeout(timer)
  }
}

// ─── GitHub issue creation ───────────────────────────────────────────

export interface IssueCreateOptions {
  title: string
  body: string
  labels?: readonly string[]
  /** Override `gh issue create`. Tests inject a recorder. */
  invoke?: (cmd: string, args: readonly string[]) => {
    status: number | null
    stdout: string
    stderr: string
  }
  /** owner/name. Defaults to env RECONCILE_REPO_SLUG or
   *  'settlegrid/settlegrid'. */
  repo?: string
}

export function openGitHubIssue(opts: IssueCreateOptions): {
  ok: boolean
  detail: string
} {
  const invoke =
    opts.invoke ??
    ((cmd, args) => spawnSync(cmd, [...args], { encoding: 'utf-8' }))
  const repo = opts.repo ?? process.env.RECONCILE_REPO_SLUG ?? 'settlegrid/settlegrid'
  const labels = opts.labels && opts.labels.length > 0 ? ['--label', opts.labels.join(',')] : []
  const args = [
    'issue',
    'create',
    '--repo',
    repo,
    '--title',
    opts.title,
    '--body',
    opts.body,
    ...labels,
  ]
  const res = invoke('gh', args)
  if (res.status === 0) {
    return { ok: true, detail: (res.stdout ?? '').trim() }
  }
  return {
    ok: false,
    detail: `gh exit=${res.status}; stderr=${(res.stderr ?? '').slice(0, 500)}`,
  }
}

// ─── Report writer ───────────────────────────────────────────────────

export function writeCombinedReport(
  report: CombinedReport,
  options: { force?: boolean; reportsDir?: string } = {},
): { written: boolean; path: string; reason: string } {
  // Defence in depth: even though the CLI parseArgs validates the
  // date via `utcDayBounds`, this exported helper accepts a raw
  // string from the caller; re-validate so a buggy or untrusted
  // caller can't pass `'../../etc/passwd'` and escape the reports
  // dir.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(report.dateUtc)) {
    throw new TypeError(
      `writeCombinedReport: report.dateUtc must be 'YYYY-MM-DD'; got ${JSON.stringify(report.dateUtc)}.`,
    )
  }
  const dir = options.reportsDir ?? REPORTS_DIR
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${report.dateUtc}.json`)
  if (existsSync(path) && !options.force) {
    return {
      written: false,
      path,
      reason: 'report already exists; pass --force to overwrite',
    }
  }
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n', 'utf-8')
  return { written: true, path, reason: 'wrote' }
}

// ─── Orchestrator (the function `main` calls) ────────────────────────

export interface ReconcileDeps {
  ledgerQuery?: LedgerQueryFn
  stripeClient?: StripeClientFactory
  fetchImpl?: typeof fetch
  invokeGh?: IssueCreateOptions['invoke']
  reportsDir?: string
  stateFile?: string
  /** Stable now() for deterministic tests. */
  nowIso?: string
  /** Pretty-print a single line; defaults to console.log. */
  log?: (msg: string) => void
}

export interface ReconcileResult {
  reports: { charges: DriftReport; transfers: DriftReport }
  combined: CombinedReport
  reportPath: string
  reportWritten: boolean
  webhookResult: { slack: string; discord: string }
  issue: {
    decision: ReturnType<typeof shouldOpenIssue>
    opened: boolean
    detail: string
  }
}

export async function runReconcile(
  args: CliArgs,
  deps: ReconcileDeps = {},
): Promise<ReconcileResult> {
  const log = deps.log ?? ((m: string) => console.log(m))

  if (args.dryRun) {
    log(`[dry-run] would reconcile ${args.dateUtc} (charges + transfers)`)
  }

  const ledgerQuery = deps.ledgerQuery ?? defaultLedgerQuery
  const stripeClient =
    deps.stripeClient ?? (() => defaultStripeClient())

  // Even in dry-run we still execute the pure-function pipeline so the
  // operator sees what would have happened — but we substitute empty
  // arrays for the side-effecty fetchers so no DB / Stripe call fires.
  const ledgerRows = args.dryRun
    ? []
    : await ledgerQuery(args.dateUtc)
  log(`fetched ${ledgerRows.length} ledger row(s) for ${args.dateUtc}`)

  let chargesStripeRows: Awaited<ReturnType<typeof fetchBalanceTransactionsForUtcDay>> = []
  let transfersStripeRows: Awaited<ReturnType<typeof fetchTransfersForUtcDay>> = []
  if (!args.dryRun) {
    const client = await stripeClient()
    chargesStripeRows = await fetchBalanceTransactionsForUtcDay(client, args.dateUtc)
    transfersStripeRows = await fetchTransfersForUtcDay(client, args.dateUtc)
  }
  log(
    `fetched ${chargesStripeRows.length} balance txn(s) + ` +
      `${transfersStripeRows.length} transfer(s) from Stripe`,
  )

  // (d) — partition by leg before reconciling. The transfers leg
  // accepts both spec forms: `acct_*` (the canonical SettleGrid
  // convention) and `tr_*` (Stripe transfer.id, the spec's first-
  // sentence form). The charges leg accepts `ch_*` / `py_*` charge
  // ids; null externalRefs default to the charges leg so they
  // surface as missing-in-stripe rather than silently dropped.
  const chargesLedger: LedgerEntryForReconcile[] = []
  const transfersLedger: LedgerEntryForReconcile[] = []
  for (const r of ledgerRows) {
    const ref = r.externalRef
    if (
      typeof ref === 'string' &&
      (ref.startsWith('acct_') || ref.startsWith('tr_'))
    ) {
      transfersLedger.push(r)
    } else {
      chargesLedger.push(r)
    }
  }

  const charges = reconcileLeg(chargesLedger, chargesStripeRows, 'charges', args.dateUtc)
  const transfers = reconcileLeg(
    transfersLedger,
    transfersStripeRows,
    'transfers',
    args.dateUtc,
  )

  const combined: CombinedReport = Object.freeze({
    schemaVersion: 1,
    dateUtc: args.dateUtc,
    generatedAtIso: deps.nowIso ?? new Date().toISOString(),
    thresholdBps: args.thresholdBps,
    charges,
    transfers,
  })

  // Write report (skip in dry-run).
  let reportPath = ''
  let reportWritten = false
  if (!args.dryRun) {
    const w = writeCombinedReport(combined, {
      force: args.force,
      reportsDir: deps.reportsDir,
    })
    reportPath = w.path
    reportWritten = w.written
    log(`${w.reason}: ${w.path}`)
  } else {
    reportPath = `${deps.reportsDir ?? REPORTS_DIR}/${args.dateUtc}.json`
    log(`[dry-run] would write: ${reportPath}`)
  }

  // Post webhook summary (skip in dry-run; failures non-fatal).
  const summary = formatReconcileSummary([charges, transfers])
  log(summary)
  let webhookResult: { slack: string; discord: string } = {
    slack: 'skipped',
    discord: 'skipped',
  }
  if (!args.dryRun) {
    webhookResult = await postSummaryWebhooks(
      summary,
      process.env,
      deps.fetchImpl ?? fetch,
    )
  }

  // Decide on GitHub issue. A corrupt/invalid state file fails CLOSED
  // (no issue) rather than open — opening daily on a permanent file
  // corruption would violate hostile (c)'s "24h Stripe outage = at
  // most one issue" cap.
  const stateFile = deps.stateFile ?? STATE_FILE
  let stateForDecision: { lastIssueAtIso: string | null } = { lastIssueAtIso: null }
  let stateOk = true
  let stateError: string | null = null
  if (!args.dryRun) {
    const sr = readState(stateFile)
    if (sr.ok) {
      stateForDecision = sr.state
    } else {
      stateOk = false
      stateError = sr.reason
      log(
        `state file ${sr.reason} (${stateFile}); refusing to open GitHub ` +
          `issue this run. Repair or delete the file to re-enable.`,
      )
    }
  }
  const decision = stateOk
    ? shouldOpenIssue([charges, transfers], stateForDecision.lastIssueAtIso, {
        thresholdBps: args.thresholdBps,
        rateLimitHours: args.rateLimitHours,
        nowIso: deps.nowIso,
      })
    : ({
        open: false,
        reason: `state file ${stateError ?? 'unreadable'} — fail-closed`,
      } as ReturnType<typeof shouldOpenIssue>)
  log(`issue decision: ${decision.open ? 'OPEN' : 'SKIP'} — ${decision.reason}`)

  let issueOpened = false
  let issueDetail = decision.reason
  if (decision.open && !args.dryRun) {
    const created = openGitHubIssue({
      title: `Stripe reconciliation drift — ${args.dateUtc} UTC`,
      body: buildIssueBody(combined, decision.reason),
      labels: ['reconciliation', 'P0'],
      invoke: deps.invokeGh,
    })
    issueOpened = created.ok
    issueDetail = created.detail
    if (created.ok) {
      writeState(
        { lastIssueAtIso: deps.nowIso ?? new Date().toISOString() },
        stateFile,
      )
      log(`opened GitHub issue: ${created.detail}`)
    } else {
      log(`failed to open GitHub issue: ${created.detail}`)
    }
  }

  return {
    reports: { charges, transfers },
    combined,
    reportPath,
    reportWritten,
    webhookResult,
    issue: { decision, opened: issueOpened, detail: issueDetail },
  }
}

export function buildIssueBody(combined: CombinedReport, reason: string): string {
  const { charges, transfers } = combined
  const lines = [
    `**Trigger**: ${reason}`,
    '',
    `Reconciliation date (UTC): ${combined.dateUtc}`,
    `Generated at: ${combined.generatedAtIso}`,
    `Drift threshold: ${combined.thresholdBps} bps`,
    '',
    '## Charges leg',
    `- Ledger rows: ${charges.ledgerRowCount}`,
    `- Stripe balance txns (deduped by source charge): ${charges.stripeRowCount}`,
    `- Matched: ${charges.matchedCount}`,
    `- Missing in Stripe: ${charges.missingInStripe.length}`,
    `- Missing in SettleGrid: ${charges.missingInSettlegrid.length}`,
    `- Amount mismatches: ${charges.amountMismatch.length}`,
    `- Drift: ${charges.driftCents}¢ (${charges.driftBps} bps)`,
    '',
    '## Transfers leg',
    `- Ledger rows: ${transfers.ledgerRowCount}`,
    `- Stripe transfer destinations (summed for partial-retry): ${transfers.stripeRowCount}`,
    `- Matched: ${transfers.matchedCount}`,
    `- Missing in Stripe: ${transfers.missingInStripe.length}`,
    `- Missing in SettleGrid: ${transfers.missingInSettlegrid.length}`,
    `- Amount mismatches: ${transfers.amountMismatch.length}`,
    `- Drift: ${transfers.driftCents}¢ (${transfers.driftBps} bps)`,
    '',
    `Full report: \`data/reconciliation/stripe/${combined.dateUtc}.json\``,
    '',
    'Runbook: `docs/reconciliation/reconcile-runbook.md`',
  ]
  return lines.join('\n')
}

// ─── CLI entry-point ─────────────────────────────────────────────────

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  let args: CliArgs
  try {
    args = parseArgs(argv)
  } catch (err) {
    console.error(`Argument error: ${(err as Error).message}`)
    printHelp()
    return 2
  }
  if (args.help) {
    printHelp()
    return 0
  }
  try {
    const result = await runReconcile(args)
    // Non-zero exit only if the operator-facing artifacts failed
    // (couldn't write report when not dry-run). Drift itself is not
    // a script failure — it's reported via the GitHub issue.
    if (!args.dryRun && !result.reportWritten) {
      // Existing-file refusal: explicit non-zero so a re-run sees it.
      console.error(
        `report not written; pass --force to overwrite ${result.reportPath}`,
      )
      return 3
    }
    return 0
  } catch (err) {
    console.error(`Reconciliation failed: ${(err as Error).message}`)
    if ((err as Error).stack) console.error((err as Error).stack)
    return 1
  }
}

// Run only when invoked directly. Required so unit tests can import
// + mock without triggering DB/Stripe connections at module load.
const isDirectInvocation =
  import.meta.url === `file://${process.argv[1]}` ||
  // tsx wraps the script; argv[1] may end with a transient .ts path.
  (process.argv[1] && process.argv[1].endsWith('reconcile-stripe.ts'))
if (isDirectInvocation) {
  main().then((code) => process.exit(code))
}
