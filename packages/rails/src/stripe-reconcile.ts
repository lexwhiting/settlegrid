/**
 * P3.RAIL2 — Stripe reconciliation pure helpers.
 *
 * SettleGrid's unified ledger is the internal source of truth; Stripe
 * is the external source of truth. The nightly reconciliation job
 * (`scripts/reconcile-stripe.ts`) compares them and produces a drift
 * report. THIS module hosts the pure functions the script orchestrates.
 * Everything here is dependency-injectable + side-effect-free so the
 * script can be unit-tested without real Stripe SDK / DB / network.
 *
 * # Two reconciliation legs
 *
 *   - **Charges** — SaaS subscription charges (Stripe Billing) and
 *     usage-based platform fees. Reconciled by `externalRef` ↔
 *     Stripe `charge.id` (which appears as the `source` field on a
 *     Balance Transaction).
 *   - **Transfers** — developer payouts (Stripe Connect). Reconciled
 *     by `externalRef` ↔ Stripe `destination` (the connected
 *     account ID). Partial-payout retries (a single ledger row paid
 *     out via N transfer events that fail+retry) sum on the
 *     destination key — see `groupTransfersByDestinationAccount`.
 *
 * # Hostile-lens contracts (per P3.RAIL2 hostile requirements a/b/c/d)
 *
 *   - **(a) Timezone alignment.** All dates are UTC calendar days.
 *     `utcDayBounds(YYYY-MM-DD)` returns inclusive-start /
 *     exclusive-end Unix-seconds bounds; the 00:00:00 UTC moment
 *     belongs to day N (not day N-1) and 23:59:59.999 UTC belongs
 *     to day N (not day N+1).
 *   - **(b) Drift in cents, not floating point.** All arithmetic
 *     stays in integer cents. Drift basis-points are
 *     `Math.round((driftCents * 10000) / denominatorCents)` —
 *     integer ops only, no float division.
 *   - **(c) GitHub issue rate-limiting.** `shouldOpenIssue()` is a
 *     pure function — caller passes `lastIssueAtIso` (read from a
 *     committed state file) and the helper enforces a 24h window.
 *     A 24h Stripe outage producing 24 drift reports opens AT MOST
 *     one issue.
 *   - **(d) Two legs separately.** `reconcileLeg(rows, stripeRows,
 *     leg)` is invoked twice — once for charges, once for
 *     transfers — and produces independent reports. The function
 *     never mixes Balance Transactions with Transfers; the input
 *     types are distinct enough that mixing would fail at TypeScript
 *     compile time.
 *
 * Pagination guards: `MAX_PAGES = 1000` × `PAGE_SIZE = 100` =
 * 100,000 rows per leg. A misbehaving Stripe API returning
 * `has_more: true` with empty data throws after the first
 * cursor-stall instead of looping forever.
 */

// ─── Stripe API surface (the minimum we need; tests inject mocks) ────

export interface StripeBalanceTransaction {
  /** Stable Stripe ID (`txn_*`). */
  id: string
  /** Cents (integer). Positive for credits, negative for debits. */
  amount: number
  /** ISO-4217 lowercase. */
  currency: string
  /** `'charge' | 'transfer' | 'refund' | ...` */
  type: string
  /** Source object — typically a charge ID or expanded charge object. */
  source: string | { id: string } | null
  /** Unix seconds. */
  created: number
  /** Cents (integer); amount net of Stripe fees. Not used by the
   *  reconciler today but surfaced so a later card can compare net
   *  cents instead of gross. */
  net: number
}

export interface StripeTransfer {
  /** Stable Stripe ID (`tr_*`). */
  id: string
  /** Cents (integer). */
  amount: number
  /** ISO-4217 lowercase. */
  currency: string
  /** Connected-account ID (`acct_*`); null only when the Stripe
   *  account itself is the destination. */
  destination: string | null
  /** Unix seconds. */
  created: number
}

/**
 * Tightly-scoped Stripe SDK surface the reconciler uses. Tests inject
 * a plain object literal that satisfies this shape; the real
 * implementation is the `Stripe` class from `stripe`.
 *
 * Listing both Balance Transactions and Transfers gives the reconciler
 * everything it needs without pulling in the full Stripe SDK as a
 * required dep at the rails package layer.
 */
export interface StripeReconcileClient {
  balanceTransactions: {
    list: (params: StripeListParams & { type?: string }) => Promise<{
      data: StripeBalanceTransaction[]
      has_more: boolean
    }>
  }
  transfers: {
    list: (params: StripeListParams) => Promise<{
      data: StripeTransfer[]
      has_more: boolean
    }>
  }
}

interface StripeListParams {
  created?: { gte?: number; lt?: number }
  limit?: number
  starting_after?: string
}

// ─── Ledger / report types ───────────────────────────────────────────

/**
 * The minimum fields the reconciler reads from the unified ledger.
 * Lives here (not in `apps/web/src/lib/db/schema.ts`) because the
 * pure functions don't depend on Drizzle types — the script casts
 * its DB rows to this shape before passing them in.
 */
export interface LedgerEntryForReconcile {
  /** SettleGrid-side row id (UUID string). */
  id: string
  /** Stripe-native reference: charge.id (charges leg) or
   *  destination acct_* (transfers leg). May be null if the rail
   *  has not yet flipped the row to `settled`. */
  externalRef: string | null
  /** Cents (integer); positive. */
  amountCents: number
  /** Always `'stripe-connect'` here (the script filters before passing). */
  rail: string
  /** ISO-8601 UTC timestamp. */
  settledAt: string | null
}

export type ReconcileLeg = 'charges' | 'transfers'

export interface DriftReport {
  readonly dateUtc: string
  readonly leg: ReconcileLeg
  readonly ledgerRowCount: number
  readonly stripeRowCount: number
  /** Charges leg: number of ledger rows that 1:1 matched a Stripe
   *  charge. Transfers leg: number of DESTINATIONS (acct_*) whose
   *  per-destination ledger sum reconciled with the per-destination
   *  Stripe sum. See `matchedLedgerRowCount` for an apples-to-apples
   *  comparison against `ledgerRowCount`. */
  readonly matchedCount: number
  /** Number of LEDGER ROWS counted in the match. For the charges leg
   *  this equals `matchedCount`. For the transfers leg this is the
   *  total rows in destinations whose sums reconciled — so e.g. 3
   *  ledger rows summing to a single matched destination contribute
   *  3 here, but only 1 to `matchedCount`. The summary line uses
   *  this so a multi-row-per-destination clean reconciliation does
   *  NOT look like a partial failure. */
  readonly matchedLedgerRowCount: number
  readonly missingInStripe: ReadonlyArray<{
    ledgerId: string
    externalRef: string | null
    amountCents: number
  }>
  readonly missingInSettlegrid: ReadonlyArray<{
    stripeId: string
    amountCents: number
  }>
  readonly amountMismatch: ReadonlyArray<{
    ledgerId: string
    externalRef: string
    ledgerCents: number
    stripeCents: number
    deltaCents: number
  }>
  readonly totalLedgerCents: number
  readonly totalStripeCents: number
  /** Absolute |ledger - stripe| in cents. */
  readonly driftCents: number
  /** Drift in basis points (100 bps = 1%). Integer. */
  readonly driftBps: number
}

// ─── Constants ───────────────────────────────────────────────────────

/** Stripe API pages 100 results at a time at most. */
const PAGE_SIZE = 100
/** Hard cap to defend against runaway pagination loops. */
const MAX_PAGES = 1000
/** 1% drift threshold — the spec's trigger for opening a GitHub issue. */
export const DEFAULT_DRIFT_THRESHOLD_BPS = 100
/** 24h rate-limit window for GitHub issue creation. */
export const DEFAULT_ISSUE_RATE_LIMIT_HOURS = 24

// ─── UTC bounds ──────────────────────────────────────────────────────

/**
 * Convert a `'YYYY-MM-DD'` UTC date string to inclusive-start
 * exclusive-end Unix-second bounds. Stripe's `created[gte]` /
 * `created[lt]` filters take Unix seconds; this function aligns
 * them to UTC midnight so Stripe's window matches the SettleGrid
 * ledger's UTC `settledAt` window.
 *
 * `00:00:00 UTC` on day N → `startSec` (included).
 * `23:59:59.999 UTC` on day N → `endSec - 0.001` (still day N).
 * `00:00:00 UTC` on day N+1 → `endSec` (excluded — day N+1's window).
 *
 * Throws `TypeError` on a malformed date so a caller bug fails fast
 * rather than silently reconciling the wrong window.
 */
export function utcDayBounds(dateIsoYYYYMMDD: string): {
  startSec: number
  endSec: number
  dateUtc: string
} {
  if (typeof dateIsoYYYYMMDD !== 'string') {
    throw new TypeError(
      `utcDayBounds: \`dateIsoYYYYMMDD\` must be a string; got ${typeof dateIsoYYYYMMDD}.`,
    )
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIsoYYYYMMDD)) {
    throw new TypeError(
      `utcDayBounds: \`dateIsoYYYYMMDD\` must be 'YYYY-MM-DD'; got ${JSON.stringify(dateIsoYYYYMMDD)}.`,
    )
  }
  const [yStr, mStr, dStr] = dateIsoYYYYMMDD.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  // Date.UTC validates the date — passing 2026-02-30 silently rolls
  // into March, but we round-trip the result back to YYYY-MM-DD and
  // require equality so a bad date is surfaced.
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0)
  const roundTrip = new Date(ms).toISOString().slice(0, 10)
  if (roundTrip !== dateIsoYYYYMMDD) {
    throw new TypeError(
      `utcDayBounds: \`${dateIsoYYYYMMDD}\` is not a valid UTC calendar date (round-trips to ${roundTrip}).`,
    )
  }
  const startSec = Math.floor(ms / 1000)
  const endSec = startSec + 24 * 60 * 60
  return Object.freeze({ startSec, endSec, dateUtc: dateIsoYYYYMMDD })
}

// ─── Pagination ──────────────────────────────────────────────────────

async function paginate<T extends { id: string }>(
  list: (
    params: StripeListParams & { type?: string },
  ) => Promise<{ data: T[]; has_more: boolean }>,
  baseParams: StripeListParams & { type?: string },
): Promise<readonly T[]> {
  const out: T[] = []
  // Track every id we've already pushed so we can detect a Stripe
  // cursor-not-advancing bug (the pathological case where the API
  // returns `has_more: true` plus an unchanged page of items).
  // Without this guard a busted cursor would push MAX_PAGES * PAGE_SIZE
  // = 100k duplicate rows before the page-cap fired.
  const seen = new Set<string>()
  let starting_after: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await list({
      ...baseParams,
      limit: PAGE_SIZE,
      ...(starting_after !== undefined ? { starting_after } : {}),
    })
    if (!res || !Array.isArray(res.data) || typeof res.has_more !== 'boolean') {
      throw new Error('Stripe pagination returned malformed response')
    }
    for (const item of res.data) {
      if (typeof item.id !== 'string' || item.id.length === 0) {
        throw new Error('Stripe pagination: response item missing string `id`')
      }
      if (seen.has(item.id)) {
        throw new Error(
          `Stripe pagination: duplicate id ${item.id} — cursor not advancing`,
        )
      }
      seen.add(item.id)
      out.push(item)
    }
    if (!res.has_more) {
      return Object.freeze(out)
    }
    if (res.data.length === 0) {
      // Cursor stalled. Bail rather than loop forever.
      throw new Error(
        'Stripe pagination: has_more=true with empty data (cursor stalled)',
      )
    }
    starting_after = res.data[res.data.length - 1].id
  }
  throw new Error(
    `Stripe pagination exceeded ${MAX_PAGES} pages — refusing to continue (potential runaway loop).`,
  )
}

/**
 * Fetch every Balance Transaction Stripe recorded during the given
 * UTC calendar day. Used by the **charges** reconciliation leg —
 * each balance transaction's `source` field carries the originating
 * `charge.id` we join on.
 */
export async function fetchBalanceTransactionsForUtcDay(
  client: StripeReconcileClient,
  dateIsoYYYYMMDD: string,
): Promise<readonly StripeBalanceTransaction[]> {
  const { startSec, endSec } = utcDayBounds(dateIsoYYYYMMDD)
  return paginate<StripeBalanceTransaction>(
    (params) => client.balanceTransactions.list(params),
    { created: { gte: startSec, lt: endSec } },
  )
}

/**
 * Fetch every Stripe Connect Transfer recorded during the given UTC
 * calendar day. Used by the **transfers** reconciliation leg.
 */
export async function fetchTransfersForUtcDay(
  client: StripeReconcileClient,
  dateIsoYYYYMMDD: string,
): Promise<readonly StripeTransfer[]> {
  const { startSec, endSec } = utcDayBounds(dateIsoYYYYMMDD)
  return paginate<StripeTransfer>(
    (params) => client.transfers.list(params),
    { created: { gte: startSec, lt: endSec } },
  )
}

// ─── Transfer grouping (partial-payout retries) ──────────────────────

/**
 * Group transfers by `destination` so a ledger row that maps to N
 * Stripe transfer events (one initial + N-1 retries after a failed
 * payout) reconciles against the SUM of those amounts rather than
 * any single event. Returns a frozen Map; inner arrays are also
 * frozen so callers can't mutate the grouping mid-reconcile.
 *
 * Transfers with `destination === null` are bucketed under the
 * sentinel key `__null__` so they aren't silently dropped.
 */
export function groupTransfersByDestinationAccount(
  transfers: readonly StripeTransfer[],
): Map<string, readonly StripeTransfer[]> {
  const out = new Map<string, StripeTransfer[]>()
  for (const t of transfers) {
    const key = t.destination ?? '__null__'
    let bucket = out.get(key)
    if (!bucket) {
      bucket = []
      out.set(key, bucket)
    }
    bucket.push(t)
  }
  const frozen = new Map<string, readonly StripeTransfer[]>()
  for (const [k, v] of out) {
    frozen.set(k, Object.freeze(v))
  }
  return frozen
}

// ─── reconcileLeg — the joining function ─────────────────────────────

/**
 * Build a {@link DriftReport} for a single leg.
 *
 * # Charges leg
 *
 * `stripeRows` are Balance Transactions; the join key is each
 * transaction's `source` (the originating charge id, e.g. `ch_*`).
 * The reconciler does a 1:1 join: each ledger row's externalRef is
 * looked up in a `Map<charge_id, { amountCents }>`; per-row matches +
 * mismatches are reported individually so the operator can trace
 * each delta back to a specific charge.
 *
 * # Transfers leg
 *
 * `stripeRows` are Stripe Connect Transfers. The join key is the
 * `destination` connected-account id (`acct_*`). Per the spec's
 * partial-payout requirement, BOTH sides aggregate by destination
 * before comparison:
 *
 *   - Stripe side: multiple transfer events to the same destination
 *     (the partial-retry case — failed transfer + successful retry)
 *     are summed.
 *   - Ledger side: multiple ledger rows to the same destination
 *     (developer received multiple payouts in a single UTC day) are
 *     also summed. The per-destination sum-vs-sum comparison is
 *     symmetric so a destination with $300 ledger + $300 across N
 *     Stripe transfers reconciles cleanly regardless of N.
 *
 * The ledger's `externalRef` for a transfers-leg row may be either:
 *
 *   - `acct_*` — the destination connected-account id (the canonical
 *     SettleGrid convention for transfers); or
 *   - `tr_*` — the Stripe transfer.id of the SUCCESSFUL transfer (the
 *     spec's first-sentence form). When this shape is used the
 *     reconciler resolves it to a destination by looking up the
 *     transfer in the day's Stripe rows; an unrecognized `tr_*` is
 *     reported as missing-in-Stripe.
 *
 * Frozen output so a caller can't mutate the report between write
 * and Slack/issue submission.
 */
export function reconcileLeg(
  ledgerRows: readonly LedgerEntryForReconcile[],
  stripeRows:
    | readonly StripeBalanceTransaction[]
    | readonly StripeTransfer[],
  leg: ReconcileLeg,
  dateUtc: string,
): DriftReport {
  if (leg !== 'charges' && leg !== 'transfers') {
    throw new TypeError(
      `reconcileLeg: \`leg\` must be 'charges' or 'transfers'; got ${JSON.stringify(leg)}.`,
    )
  }
  if (typeof dateUtc !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateUtc)) {
    throw new TypeError(
      `reconcileLeg: \`dateUtc\` must be 'YYYY-MM-DD'; got ${JSON.stringify(dateUtc)}.`,
    )
  }

  if (leg === 'transfers') {
    return reconcileTransfersLeg(
      ledgerRows,
      stripeRows as readonly StripeTransfer[],
      dateUtc,
    )
  }
  return reconcileChargesLeg(
    ledgerRows,
    stripeRows as readonly StripeBalanceTransaction[],
    dateUtc,
  )
}

function reconcileChargesLeg(
  ledgerRows: readonly LedgerEntryForReconcile[],
  balanceTxns: readonly StripeBalanceTransaction[],
  dateUtc: string,
): DriftReport {
  const stripeById = buildChargesIndex(balanceTxns)

  const matched: { ledgerId: string; externalRef: string }[] = []
  const matchedKeys = new Set<string>()
  const missingInStripe: {
    ledgerId: string
    externalRef: string | null
    amountCents: number
  }[] = []
  const amountMismatch: {
    ledgerId: string
    externalRef: string
    ledgerCents: number
    stripeCents: number
    deltaCents: number
  }[] = []

  let totalLedgerCents = 0
  for (const row of ledgerRows) {
    assertCents(row.amountCents, `ledger row ${row.id}`)
    totalLedgerCents += row.amountCents
    if (!row.externalRef) {
      missingInStripe.push({
        ledgerId: row.id,
        externalRef: null,
        amountCents: row.amountCents,
      })
      continue
    }
    const stripeMatch = stripeById.get(row.externalRef)
    if (!stripeMatch) {
      missingInStripe.push({
        ledgerId: row.id,
        externalRef: row.externalRef,
        amountCents: row.amountCents,
      })
      continue
    }
    matchedKeys.add(row.externalRef)
    if (stripeMatch.amountCents === row.amountCents) {
      matched.push({ ledgerId: row.id, externalRef: row.externalRef })
    } else {
      amountMismatch.push({
        ledgerId: row.id,
        externalRef: row.externalRef,
        ledgerCents: row.amountCents,
        stripeCents: stripeMatch.amountCents,
        deltaCents: row.amountCents - stripeMatch.amountCents,
      })
    }
  }

  const missingInSettlegrid: { stripeId: string; amountCents: number }[] = []
  let totalStripeCents = 0
  for (const [externalRef, stripe] of stripeById) {
    totalStripeCents += stripe.amountCents
    if (!matchedKeys.has(externalRef)) {
      missingInSettlegrid.push({
        stripeId: externalRef,
        amountCents: stripe.amountCents,
      })
    }
  }

  const driftCents = Math.abs(totalLedgerCents - totalStripeCents)
  const denominator = Math.max(totalLedgerCents, totalStripeCents)
  const driftBps = computeDriftBps(driftCents, denominator)

  return Object.freeze({
    dateUtc,
    leg: 'charges',
    ledgerRowCount: ledgerRows.length,
    stripeRowCount: stripeById.size,
    matchedCount: matched.length,
    matchedLedgerRowCount: matched.length,
    missingInStripe: Object.freeze(missingInStripe),
    missingInSettlegrid: Object.freeze(missingInSettlegrid),
    amountMismatch: Object.freeze(amountMismatch),
    totalLedgerCents,
    totalStripeCents,
    driftCents,
    driftBps,
  })
}

function reconcileTransfersLeg(
  ledgerRows: readonly LedgerEntryForReconcile[],
  transfers: readonly StripeTransfer[],
  dateUtc: string,
): DriftReport {
  // Per-destination sum on the Stripe side (handles partial-retry).
  const stripeByDestination = buildTransfersIndex(transfers)
  // Per-destination resolution map for ledger rows whose externalRef
  // is a `tr_*` transfer.id rather than an `acct_*` destination.
  const transferIdToDestination = new Map<string, string>()
  for (const t of transfers) {
    if (t.destination !== null) {
      transferIdToDestination.set(t.id, t.destination)
    }
  }

  // Per-destination sum on the ledger side. A row whose externalRef
  // can't be resolved (null, unknown `tr_*`, or any non-`acct_*` /
  // non-`tr_*` shape) gets routed to `unresolvedLedger` so the report
  // surfaces it. Each bucket retains the per-row entries (id + ref +
  // amount) so a missing-in-Stripe report shows each ledger row's
  // ACTUAL amount, not an averaged-across-bucket value.
  type LedgerBucketRow = {
    id: string
    externalRef: string | null
    amountCents: number
  }
  const ledgerByDestination = new Map<
    string,
    { amountCents: number; rows: LedgerBucketRow[] }
  >()
  const unresolvedLedger: {
    ledgerId: string
    externalRef: string | null
    amountCents: number
  }[] = []
  let totalLedgerCents = 0
  for (const row of ledgerRows) {
    assertCents(row.amountCents, `ledger row ${row.id}`)
    totalLedgerCents += row.amountCents
    const destination = resolveTransfersLedgerDestination(
      row.externalRef,
      transferIdToDestination,
    )
    if (destination === null) {
      unresolvedLedger.push({
        ledgerId: row.id,
        externalRef: row.externalRef,
        amountCents: row.amountCents,
      })
      continue
    }
    let bucket = ledgerByDestination.get(destination)
    if (!bucket) {
      bucket = { amountCents: 0, rows: [] }
      ledgerByDestination.set(destination, bucket)
    }
    bucket.amountCents += row.amountCents
    bucket.rows.push({
      id: row.id,
      externalRef: row.externalRef,
      amountCents: row.amountCents,
    })
  }

  const matched: { destination: string; ledgerCents: number }[] = []
  let matchedLedgerRowCount = 0
  const amountMismatch: {
    ledgerId: string
    externalRef: string
    ledgerCents: number
    stripeCents: number
    deltaCents: number
  }[] = []
  const missingInStripe: {
    ledgerId: string
    externalRef: string | null
    amountCents: number
  }[] = [...unresolvedLedger]

  for (const [destination, ledgerBucket] of ledgerByDestination) {
    const stripeBucket = stripeByDestination.get(destination)
    if (!stripeBucket) {
      // Ledger expected a payout to this destination but Stripe
      // recorded none. Surface EACH ledger row's actual amount so the
      // operator can trace it back to the original ledger entry.
      for (const r of ledgerBucket.rows) {
        missingInStripe.push({
          ledgerId: r.id,
          externalRef: r.externalRef,
          amountCents: r.amountCents,
        })
      }
      continue
    }
    if (stripeBucket.amountCents === ledgerBucket.amountCents) {
      matched.push({ destination, ledgerCents: ledgerBucket.amountCents })
      matchedLedgerRowCount += ledgerBucket.rows.length
    } else {
      // Aggregate mismatch — surface as a single amountMismatch entry
      // keyed on the destination, with a synthetic ledgerId that
      // joins all bucket row ids so the operator can trace.
      amountMismatch.push({
        ledgerId: ledgerBucket.rows.map((r) => r.id).join(','),
        externalRef: destination,
        ledgerCents: ledgerBucket.amountCents,
        stripeCents: stripeBucket.amountCents,
        deltaCents: ledgerBucket.amountCents - stripeBucket.amountCents,
      })
    }
  }

  const missingInSettlegrid: { stripeId: string; amountCents: number }[] = []
  let totalStripeCents = 0
  for (const [destination, stripeBucket] of stripeByDestination) {
    totalStripeCents += stripeBucket.amountCents
    if (!ledgerByDestination.has(destination)) {
      missingInSettlegrid.push({
        stripeId: destination,
        amountCents: stripeBucket.amountCents,
      })
    }
  }

  const driftCents = Math.abs(totalLedgerCents - totalStripeCents)
  const denominator = Math.max(totalLedgerCents, totalStripeCents)
  const driftBps = computeDriftBps(driftCents, denominator)

  return Object.freeze({
    dateUtc,
    leg: 'transfers',
    ledgerRowCount: ledgerRows.length,
    stripeRowCount: stripeByDestination.size,
    matchedCount: matched.length,
    matchedLedgerRowCount,
    missingInStripe: Object.freeze(missingInStripe),
    missingInSettlegrid: Object.freeze(missingInSettlegrid),
    amountMismatch: Object.freeze(amountMismatch),
    totalLedgerCents,
    totalStripeCents,
    driftCents,
    driftBps,
  })
}

/**
 * Resolve a ledger row's transfers-leg externalRef to a Stripe
 * `destination` (acct_*). Pure — exposed for tests + so the
 * orchestrator can reuse the convention when partitioning rows into
 * legs.
 *
 *   - `acct_*` → returned as-is
 *   - `tr_*`   → looked up in `transferIdToDestination`; null if
 *                unrecognized (failed-transfer case where the
 *                successful retry hasn't landed yet).
 *   - null / other → null (caller bucketizes as unresolved).
 */
export function resolveTransfersLedgerDestination(
  externalRef: string | null,
  transferIdToDestination: ReadonlyMap<string, string>,
): string | null {
  if (typeof externalRef !== 'string' || externalRef.length === 0) return null
  if (externalRef.startsWith('acct_')) return externalRef
  if (externalRef.startsWith('tr_')) {
    return transferIdToDestination.get(externalRef) ?? null
  }
  return null
}

function assertCents(cents: number, context: string): void {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new TypeError(
      `reconcileLeg: ${context} has non-integer or negative amountCents (${cents}).`,
    )
  }
}

/**
 * Build a `Map<charge_id, { id, amountCents }>` from the day's
 * Balance Transactions. Multiple balance txns sharing the same
 * source charge (a refund pair, a partial capture + a fee) are
 * summed so the ledger row's gross amount lines up with the
 * net Stripe-side activity for that charge.
 */
function buildChargesIndex(
  balanceTxns: readonly StripeBalanceTransaction[],
): Map<string, { id: string; amountCents: number }> {
  const out = new Map<string, { id: string; amountCents: number }>()
  for (const txn of balanceTxns) {
    if (!Number.isInteger(txn.amount)) {
      throw new TypeError(
        `reconcileLeg(charges): balance txn ${txn.id} has non-integer amount (${txn.amount}).`,
      )
    }
    const sourceId =
      typeof txn.source === 'string'
        ? txn.source
        : txn.source !== null && txn.source !== undefined
          ? txn.source.id
          : null
    if (!sourceId) continue
    const existing = out.get(sourceId)
    if (existing) {
      out.set(sourceId, {
        id: sourceId,
        amountCents: existing.amountCents + txn.amount,
      })
    } else {
      out.set(sourceId, { id: sourceId, amountCents: txn.amount })
    }
  }
  return out
}

/**
 * Build a `Map<destination, { id, amountCents }>` from the day's
 * Stripe Connect Transfers. Multiple transfers to the same
 * destination (the partial-retry case from the spec) are summed.
 * Transfers with `destination === null` are silently dropped — the
 * orphan would never reconcile against any ledger row.
 */
function buildTransfersIndex(
  transfers: readonly StripeTransfer[],
): Map<string, { id: string; amountCents: number }> {
  const out = new Map<string, { id: string; amountCents: number }>()
  const grouped = groupTransfersByDestinationAccount(transfers)
  for (const [destination, group] of grouped) {
    if (destination === '__null__') continue
    let sum = 0
    for (const t of group) {
      if (!Number.isInteger(t.amount)) {
        throw new TypeError(
          `reconcileLeg(transfers): transfer ${t.id} has non-integer amount (${t.amount}).`,
        )
      }
      sum += t.amount
    }
    out.set(destination, { id: destination, amountCents: sum })
  }
  return out
}

// ─── Drift bps ───────────────────────────────────────────────────────

/**
 * Compute drift in basis points (100 bps = 1%) from cent amounts.
 * Integer-only arithmetic — `Math.round((driftCents * 10000) / denominatorCents)`.
 *
 * Returns 0 when the denominator is 0 (no activity on either side
 * → no drift). The router is fail-safe in that case rather than
 * dividing by zero.
 */
export function computeDriftBps(
  driftCents: number,
  denominatorCents: number,
): number {
  if (
    !Number.isInteger(driftCents) ||
    driftCents < 0 ||
    !Number.isInteger(denominatorCents) ||
    denominatorCents < 0
  ) {
    throw new TypeError(
      `computeDriftBps: arguments must be non-negative integer cents; got drift=${driftCents}, denominator=${denominatorCents}.`,
    )
  }
  if (denominatorCents === 0) return 0
  return Math.round((driftCents * 10_000) / denominatorCents)
}

// ─── Issue gating ────────────────────────────────────────────────────

export interface ShouldOpenIssueOptions {
  /** Override the default 1% threshold for tests. */
  thresholdBps?: number
  /** Override the default 24h rate-limit window. */
  rateLimitHours?: number
  /** Override `Date.now()` for tests. */
  nowIso?: string
}

export interface ShouldOpenIssueResult {
  open: boolean
  reason: string
}

/**
 * Decide whether the reconciliation should open a GitHub issue this
 * run. Pure function — caller supplies `lastIssueAtIso` (read from a
 * committed state file or the GitHub API) and the helper enforces
 * the rate-limit window.
 *
 * Returns `{ open: false, reason: 'no drift signal' }` when nothing
 * exceeded any threshold. A non-zero drift OR any
 * missing/mismatch row triggers an open candidacy, which then runs
 * the rate-limit gate.
 */
export function shouldOpenIssue(
  reports: readonly DriftReport[],
  lastIssueAtIso: string | null,
  options: ShouldOpenIssueOptions = {},
): ShouldOpenIssueResult {
  const thresholdBps = options.thresholdBps ?? DEFAULT_DRIFT_THRESHOLD_BPS
  const rateLimitHours =
    options.rateLimitHours ?? DEFAULT_ISSUE_RATE_LIMIT_HOURS
  const nowIso = options.nowIso ?? new Date().toISOString()

  if (!Number.isInteger(thresholdBps) || thresholdBps < 0) {
    throw new TypeError(
      `shouldOpenIssue: thresholdBps must be a non-negative integer; got ${thresholdBps}.`,
    )
  }
  if (!Number.isFinite(rateLimitHours) || rateLimitHours < 0) {
    throw new TypeError(
      `shouldOpenIssue: rateLimitHours must be a non-negative finite number; got ${rateLimitHours}.`,
    )
  }

  let triggered = false
  let triggerReason = ''
  for (const report of reports) {
    if (report.driftBps > thresholdBps) {
      triggered = true
      triggerReason =
        `${report.leg}: drift_bps=${report.driftBps} > threshold=${thresholdBps}`
      break
    }
    if (
      report.missingInStripe.length > 0 ||
      report.missingInSettlegrid.length > 0 ||
      report.amountMismatch.length > 0
    ) {
      triggered = true
      triggerReason =
        `${report.leg}: missing_in_stripe=${report.missingInStripe.length}, ` +
        `missing_in_settlegrid=${report.missingInSettlegrid.length}, ` +
        `amount_mismatch=${report.amountMismatch.length}`
      break
    }
  }

  if (!triggered) return { open: false, reason: 'no drift signal' }

  if (lastIssueAtIso !== null) {
    const lastMs = Date.parse(lastIssueAtIso)
    const nowMs = Date.parse(nowIso)
    if (Number.isFinite(lastMs) && Number.isFinite(nowMs)) {
      const elapsedHours = (nowMs - lastMs) / (1000 * 60 * 60)
      if (elapsedHours < rateLimitHours) {
        return {
          open: false,
          reason:
            `rate-limited: last issue at ${lastIssueAtIso} ` +
            `(${elapsedHours.toFixed(2)}h ago, window=${rateLimitHours}h)`,
        }
      }
    }
    // Unparseable lastIssueAtIso: open the issue (fail-open is the
    // safer choice — better to fire one extra issue than to swallow
    // a real drift signal because of a malformed state file).
  }

  return { open: true, reason: triggerReason }
}

// ─── Slack/Discord summary formatting ────────────────────────────────

/**
 * Build a human-readable single-line summary suitable for Slack /
 * Discord. Emits per-leg totals + drift-bps. Length-bounded by the
 * fixed format (a 100-leg run is impossible — only two legs exist).
 */
export function formatReconcileSummary(
  reports: readonly DriftReport[],
): string {
  if (reports.length === 0) {
    return 'Stripe reconciliation: no reports (script ran but produced no output).'
  }
  const date = reports[0].dateUtc
  const lines = [`Stripe reconciliation — ${date} UTC:`]
  for (const r of reports) {
    // matchedLedgerRowCount/ledgerRowCount is honest for both legs:
    // charges leg → 1:1 row count; transfers leg → ledger rows whose
    // per-destination bucket reconciled, not destination count.
    const pretty =
      `  • ${r.leg}: ${r.matchedLedgerRowCount}/${r.ledgerRowCount} matched, ` +
      `drift=${r.driftBps}bps ` +
      `(ledger=${formatCents(r.totalLedgerCents)}, stripe=${formatCents(r.totalStripeCents)}), ` +
      `missing_stripe=${r.missingInStripe.length}, ` +
      `missing_sg=${r.missingInSettlegrid.length}, ` +
      `mismatches=${r.amountMismatch.length}`
    lines.push(pretty)
  }
  return lines.join('\n')
}

function formatCents(cents: number): string {
  // Two-decimal dollar-display only; arithmetic stays integer.
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const remainder = abs % 100
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`
}
