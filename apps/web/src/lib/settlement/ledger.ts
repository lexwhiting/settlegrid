/**
 * Double-entry ledger for the settlement engine.
 *
 * All balance changes MUST go through postLedgerEntry().
 * Entries are immutable — corrections via compensating entries only.
 *
 * P3.K4 adds recordSettlementEntry(), a writer for the per-invocation
 * settlement records that every rail adapter produces. Settlement
 * rows carry the new rail/protocol/takeBps/takeCents/settlement_status
 * columns added by migrations/0005_unified_ledger.sql — the existing
 * double-entry balance rows leave those NULL so reconciliation tools
 * (P3.RAIL2) can join BOTH record kinds from a single table without
 * ambiguity. See packages/mcp/src/ledger.ts for the canonical
 * LedgerEntry type + validator.
 */

import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { accounts, ledgerEntries } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  recordLedgerEntry as canonicalRecordLedgerEntry,
  type LedgerEntry,
} from '@settlegrid/mcp'
import type { LedgerCategory } from './types'

export interface PostEntryParams {
  debitAccountId: string
  creditAccountId: string
  amountCents: number
  currencyCode?: string
  category: LedgerCategory
  operationId?: string
  batchId?: string
  description: string
  metadata?: Record<string, unknown>
  /**
   * P2.TAX1 — tax portion of this entry in minor currency units.
   * Defaults to 0 for non-tax entries (metering, payouts, transfers).
   * SaaS subscription charges SHOULD pass the tax amount extracted
   * from the Stripe Invoice via `extractTaxFromInvoice()`.
   */
  taxCents?: number
  /**
   * ISO-3166 alpha-2 country code for non-US; 'US-<state>' for US.
   * REQUIRED when `taxCents > 0` — the DB check constraint rejects
   * tax-without-jurisdiction so reconciliation can always trace a
   * collected tax amount back to its authority.
   */
  taxJurisdiction?: string
}

/**
 * Post a balanced double-entry to the ledger.
 *
 * Creates two entries (one debit, one credit) and updates both account balances
 * in a single database transaction with optimistic locking.
 *
 * @returns The IDs of the two ledger entries created
 * @throws Error if optimistic lock fails (concurrent modification)
 */
export async function postLedgerEntry(params: PostEntryParams): Promise<{
  debitEntryId: string
  creditEntryId: string
}> {
  const {
    debitAccountId,
    creditAccountId,
    amountCents,
    currencyCode = 'USD',
    category,
    operationId,
    batchId,
    description,
    metadata,
    taxCents = 0,
    taxJurisdiction,
  } = params

  if (amountCents <= 0) {
    throw new Error(`Ledger entry amount must be positive, got ${amountCents}`)
  }

  if (debitAccountId === creditAccountId) {
    throw new Error('Debit and credit accounts must be different')
  }

  // P2.TAX1 — fail fast at the application layer on tax/jurisdiction
  // mismatch. The DB check constraint is the last line of defense;
  // this surfaces the error with context rather than a cryptic
  // constraint-violation SQLSTATE to the caller.
  if (!Number.isInteger(taxCents) || taxCents < 0) {
    throw new Error(
      `Ledger entry taxCents must be a non-negative integer, got ${taxCents}`,
    )
  }
  if (taxCents > 0 && !taxJurisdiction) {
    throw new Error(
      `Ledger entry has taxCents=${taxCents} but no taxJurisdiction — collected tax must be traceable to an authority`,
    )
  }
  // Hostile-review fix: tax is a PORTION of the total charge, so
  // taxCents MUST be <= amountCents. An entry with amountCents=100
  // and taxCents=500 is meaningless — a corrupt Stripe response or
  // an upstream bug that passes the wrong field. Catch it at the
  // application layer instead of writing garbage to the ledger.
  if (taxCents > amountCents) {
    throw new Error(
      `Ledger entry taxCents=${taxCents} exceeds amountCents=${amountCents} — tax cannot exceed the total charge`,
    )
  }

  return await db.transaction(async (tx) => {
    // 1. Read both accounts with current versions
    const [debitAccount] = await tx
      .select({ id: accounts.id, version: accounts.version, balanceCents: accounts.balanceCents })
      .from(accounts)
      .where(eq(accounts.id, debitAccountId))
      .limit(1)

    const [creditAccount] = await tx
      .select({ id: accounts.id, version: accounts.version, balanceCents: accounts.balanceCents })
      .from(accounts)
      .where(eq(accounts.id, creditAccountId))
      .limit(1)

    if (!debitAccount) throw new Error(`Debit account not found: ${debitAccountId}`)
    if (!creditAccount) throw new Error(`Credit account not found: ${creditAccountId}`)

    // 2. Create the two ledger entries
    const [debitEntry] = await tx
      .insert(ledgerEntries)
      .values({
        accountId: debitAccountId,
        entryType: 'debit',
        amountCents,
        currencyCode,
        operationId: operationId ?? null,
        batchId: batchId ?? null,
        category,
        counterpartyAccountId: creditAccountId,
        description,
        metadata: metadata ?? null,
        taxCents,
        taxJurisdiction: taxJurisdiction ?? null,
      })
      .returning({ id: ledgerEntries.id })

    const [creditEntry] = await tx
      .insert(ledgerEntries)
      .values({
        accountId: creditAccountId,
        entryType: 'credit',
        amountCents,
        currencyCode,
        operationId: operationId ?? null,
        batchId: batchId ?? null,
        category,
        counterpartyAccountId: debitAccountId,
        description,
        metadata: metadata ?? null,
        taxCents,
        taxJurisdiction: taxJurisdiction ?? null,
      })
      .returning({ id: ledgerEntries.id })

    // 3. Update account balances with optimistic locking
    const [updatedDebit] = await tx
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} - ${amountCents}`,
        version: sql`${accounts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, debitAccountId), eq(accounts.version, debitAccount.version)))
      .returning({ id: accounts.id })

    if (!updatedDebit) {
      throw new Error(`Optimistic lock failed on debit account ${debitAccountId} — concurrent modification`)
    }

    const [updatedCredit] = await tx
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} + ${amountCents}`,
        version: sql`${accounts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, creditAccountId), eq(accounts.version, creditAccount.version)))
      .returning({ id: accounts.id })

    if (!updatedCredit) {
      throw new Error(`Optimistic lock failed on credit account ${creditAccountId} — concurrent modification`)
    }

    return {
      debitEntryId: debitEntry.id,
      creditEntryId: creditEntry.id,
    }
  })
}

/**
 * Post a ledger entry asynchronously (fire-and-forget).
 * Used for the hot path where we don't want to block on DB writes.
 */
export function postLedgerEntryAsync(params: PostEntryParams): void {
  postLedgerEntry(params).catch((err) => {
    logger.error('ledger.post_entry_failed', {
      debitAccountId: params.debitAccountId,
      creditAccountId: params.creditAccountId,
      amountCents: params.amountCents,
      category: params.category,
    }, err)
  })
}

/**
 * Compute the balance for an account from ledger entries.
 * Used for reconciliation — compare with cached balanceCents.
 */
export async function computeBalanceFromLedger(accountId: string): Promise<number> {
  const result = await db
    .select({
      totalCredits: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'credit' THEN ${ledgerEntries.amountCents} ELSE 0 END), 0)`,
      totalDebits: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'debit' THEN ${ledgerEntries.amountCents} ELSE 0 END), 0)`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountId))

  const { totalCredits, totalDebits } = result[0]
  return Number(totalCredits) - Number(totalDebits)
}

/**
 * Reconcile an account's cached balance with the ledger.
 * Returns the discrepancy (positive = cache higher than ledger).
 */
export async function reconcileAccount(accountId: string): Promise<{
  cachedBalance: number
  ledgerBalance: number
  discrepancy: number
}> {
  const [account] = await db
    .select({ balanceCents: accounts.balanceCents })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!account) throw new Error(`Account not found: ${accountId}`)

  const ledgerBalance = await computeBalanceFromLedger(accountId)

  return {
    cachedBalance: account.balanceCents,
    ledgerBalance,
    discrepancy: account.balanceCents - ledgerBalance,
  }
}

// ─── Ledger Integrity Verification ──────────────────────────────────────────

export interface LedgerIntegrityResult {
  balanced: boolean
  totalDebits: number
  totalCredits: number
  discrepancy: number
  entryCount: number
}

/**
 * Verify global ledger integrity: total debits MUST equal total credits
 * across all accounts. Any discrepancy indicates a bug in the posting logic
 * or data corruption. This is the gold-standard financial audit check.
 */
export async function verifyLedgerIntegrity(): Promise<LedgerIntegrityResult> {
  const result = await db
    .select({
      totalDebits: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'debit' THEN ${ledgerEntries.amountCents} ELSE 0 END), 0)`,
      totalCredits: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'credit' THEN ${ledgerEntries.amountCents} ELSE 0 END), 0)`,
      entryCount: sql<number>`COUNT(*)`,
    })
    .from(ledgerEntries)

  const totalDebits = Number(result[0].totalDebits)
  const totalCredits = Number(result[0].totalCredits)
  const entryCount = Number(result[0].entryCount)
  const discrepancy = totalDebits - totalCredits

  if (discrepancy !== 0) {
    logger.error('ledger.integrity_failure', {
      totalDebits,
      totalCredits,
      discrepancy,
      entryCount,
    })
  }

  return {
    balanced: discrepancy === 0,
    totalDebits,
    totalCredits,
    discrepancy,
    entryCount,
  }
}

// ─── P3.K4 — Unified settlement ledger writer ───────────────────────
//
// Every rail adapter's settlement event lands in `ledger_entries` via
// this writer. The shape is defined in packages/mcp/src/ledger.ts —
// we adapt it here to the Drizzle row shape and fill in the
// double-entry legacy columns with inert placeholders (the settlement
// record leaves accountId / counterpartyAccountId / entryType at
// "settlement sentinel" values; reconciliation queries filter on
// `settlement_status IS NOT NULL` to isolate settlement rows from
// balance rows).
//
// The writer is idempotent by the settlement `id`, DERIVED
// deterministically from `invocationId` (see settlementEntryId): a
// retry with the same invocationId maps to the same primary key and
// the INSERT uses ON CONFLICT DO NOTHING, so the second write is a
// no-op (FIRST-WRITE-WINS — it does NOT update in place). Adapters
// that produce a stable invocation-rooted id (e.g. circle-nano's
// network:from:nonce, AP2's VDC transactionId) therefore get
// exactly-once ledger rows; a caller needing to MUTATE a row (flip
// `pending`→`settled` on on-chain confirmation) must issue an explicit
// UPDATE, not re-call this writer (the conflict-guard would skip it).

export interface RailSettlementRow {
  invocationId: string
  sessionId?: string | null
  rail: string
  protocol: string
  amountCents: number
  currency: string
  takeBps: number
  takeCents?: number
  status?: 'pending' | 'settled' | 'voided' | 'failed' | 'reversed'
  settledAt?: string | null
  externalRef?: string | null
  metadata?: Record<string, unknown> | null
  /**
   * P3.K6 — per-check audit trail from authorizeInvocation(). When
   * provided, written to the jsonb `authorization_signals` column
   * for compliance queries (OFAC strict-liability evidence
   * especially). Never exposed on the 403 HTTP body.
   */
  authorizationSignals?: ReadonlyArray<{
    check: string
    passed: boolean
    detail?: string
  }> | null
  /** P3.K6 — optional plugin-returned cryptographic authorization artifact. */
  authorizationArtifact?: string | null
  /**
   * Account the settlement belongs to (usually the developer's
   * provider account). Populates the legacy `account_id` NOT NULL
   * column so the insert satisfies the existing schema constraints.
   */
  accountId: string
  /**
   * Currency code override — defaults to `currency.toUpperCase()`
   * because the legacy `currency_code` column is `varchar(3)` and
   * historically holds ISO-4217 uppercase alpha-3. L402's
   * 'btc-lightning' doesn't fit the 3-char legacy column, so
   * settlement rows for btc-lightning pass `currencyCode: 'BTC'`
   * for the legacy column while keeping the richer value in the
   * unified `currency` column.
   */
  currencyCode?: string
  /**
   * Human-readable description — populates the legacy `description`
   * NOT NULL column.
   */
  description?: string
}

/**
 * Deterministic UUID (v5-format) derived from the invocation-rooted
 * settlement key, so a re-settled authorization (same invocationId)
 * maps to the SAME primary key and the writer's ON CONFLICT DO NOTHING
 * yields exactly-once ledger rows (honoring the LedgerWriter idempotency
 * contract). A per-call random invocationId (e.g. recordHop's hopId)
 * derives a unique id and is never deduped — correct, since each such
 * call is a distinct event.
 */
function settlementEntryId(invocationId: string): string {
  const h = createHash('sha256').update(`settlement:${invocationId}`).digest('hex')
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/**
 * Insert a unified-ledger settlement row. Delegates field
 * validation to the canonical recordLedgerEntry helper from
 * @settlegrid/mcp, then writes the resulting entry to Postgres
 * alongside the legacy double-entry columns required by the
 * existing ledger_entries NOT NULL constraints.
 *
 * Returns the inserted {@link LedgerEntry}.
 */
export async function recordSettlementEntry(
  input: RailSettlementRow,
): Promise<LedgerEntry> {
  const description =
    input.description ??
    `${input.rail}/${input.protocol} settlement for invocation ${input.invocationId}`
  const legacyCurrencyCode =
    input.currencyCode ?? input.currency.slice(0, 3).toUpperCase()

  return canonicalRecordLedgerEntry(
    {
      invocationId: input.invocationId,
      // Deterministic, invocation-rooted PK → idempotent writes (see above).
      id: settlementEntryId(input.invocationId),
      sessionId: input.sessionId ?? null,
      rail: input.rail,
      protocol: input.protocol,
      amountCents: input.amountCents,
      currency: input.currency,
      takeBps: input.takeBps,
      takeCents: input.takeCents,
      status: input.status,
      settledAt: input.settledAt,
      externalRef: input.externalRef,
      metadata: input.metadata,
      authorizationSignals: input.authorizationSignals,
      authorizationArtifact: input.authorizationArtifact,
    },
    async (entry) => {
      await db.insert(ledgerEntries).values({
        id: entry.id,
        // Legacy double-entry columns — inert for settlement rows.
        accountId: input.accountId,
        entryType: 'credit', // settlement credits the provider's account
        amountCents: entry.amountCents,
        currencyCode: legacyCurrencyCode,
        category: 'metering',
        operationId: entry.invocationId,
        batchId: null,
        counterpartyAccountId: null,
        description,
        metadata: entry.metadata ?? null,
        taxCents: 0,
        taxJurisdiction: null,
        // P3.K4 settlement columns.
        sessionId: entry.sessionId,
        rail: entry.rail,
        protocol: entry.protocol,
        takeBps: entry.takeBps,
        takeCents: entry.takeCents,
        settlementStatus: entry.status,
        settledAt: entry.settledAt !== null ? new Date(entry.settledAt) : null,
        externalRef: entry.externalRef,
        // P3.K6 authorization gate columns.
        authorizationSignals: entry.authorizationSignals,
        authorizationArtifact: entry.authorizationArtifact,
        createdAt: new Date(entry.createdAt),
      }).onConflictDoNothing()
    },
  )
}

/**
 * Fire-and-forget variant. Logs on failure without bubbling the
 * error so a ledger-write hiccup doesn't break a successful hop
 * record. Callers that need write confirmation should use
 * {@link recordSettlementEntry} directly.
 */
export function recordSettlementEntryAsync(input: RailSettlementRow): void {
  recordSettlementEntry(input).catch((err) => {
    logger.error(
      'settlement.ledger_write_failed',
      {
        invocationId: input.invocationId,
        rail: input.rail,
        protocol: input.protocol,
      },
      err,
    )
  })
}
