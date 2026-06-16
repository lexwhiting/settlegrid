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
import { eq, and, or, isNull, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  recordLedgerEntry as canonicalRecordLedgerEntry,
  type LedgerEntry,
} from '@settlegrid/mcp'
import type { LedgerCategory } from './types'
// (V-N2b) — the in-request recovery credit re-reads the recorded settled value
// via the SAME key the broadcast/settled writers persist it under (no split-brain).
import { SETTLED_VALUE_BASE_UNITS_KEY } from './settled-value'

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
   * For settlement rows this is the OWNING DEVELOPER's id — the
   * PERMANENT semantic (B4, 2026-06-04), NOT an accounts.id (the
   * double-entry accounts table is dormant/unprovisioned). The
   * reconciler credits real money from this column
   * (reconcile.ts creditSettlement: developers.id = account_id),
   * so it MUST stay a developer id. Populates the legacy
   * `account_id` NOT NULL column.
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

// ─── P3.K4 A2 — on-chain settlement state transitions ───────────────────────
//
// A2 makes circle-nano actually settle USDC on-chain. The row recordSettlementEntry
// wrote as 'pending' (a write-ahead INTENT record) is flipped to its terminal
// state by an explicit UPDATE keyed on the stable `operation_id` + `rail` —
// NOT by re-calling recordSettlementEntry (whose ON CONFLICT DO NOTHING is
// FIRST-WRITE-WINS and would SILENTLY SKIP a re-insert, so you'd think you
// settled and you didn't).
//
// Every flip is guarded `WHERE settlement_status = 'pending'`, which makes
// 'settled' terminal (no double-flip) and prevents a concurrent loser from
// clobbering a winner. Each returns whether a pending row was actually matched
// so the caller can react to a no-op (already settled / failed / absent).
//
// DB CHECK `ledger_entries_settled_at_shape` requires: settled ⟹ settled_at NOT
// NULL; any non-settled status ⟹ settled_at NULL. So markSettlementSettled sets
// settled_at and the others MUST NOT (they keep the row non-settled).

export interface SettlementRowState {
  id: string
  settlementStatus: string | null
  externalRef: string | null
  /**
   * (V-N2) — the frozen first-write cost in cents. The broadcast-seam divergence
   * detector compares the value being collected (the broadcasting proof, P2)
   * against this (P1) to flag a price-changed-during-pending settlement.
   */
  amountCents: number | null
  /**
   * (V-N2b) — the ACTUALLY-collected value (USDC base units, recorded at the
   * settling tx's broadcast keyed to external_ref), read back so the in-request
   * RECOVERY-confirm credit can pay it rather than this request's (possibly
   * re-signed-at-a-changed-price) costCents. NULL when never recorded (legacy /
   * swallowed onBroadcast) → the in-request reader DEFERS. Read via the SAME
   * SETTLED_VALUE_BASE_UNITS_KEY the writers persist (no split-brain).
   */
  settledValueBaseUnits: string | null
}

/**
 * Read a settlement row by its stable `operation_id` + `rail`. Used for
 * idempotency (already-settled → return the recorded txHash) and crash/timeout
 * recovery (a 'pending' row carrying a broadcast txHash in external_ref).
 */
export async function findSettlementRow(
  operationId: string,
  rail: string,
): Promise<SettlementRowState | null> {
  const [row] = await db
    .select({
      id: ledgerEntries.id,
      settlementStatus: ledgerEntries.settlementStatus,
      externalRef: ledgerEntries.externalRef,
      // (V-N2) — the frozen amountCents for the broadcast-seam detector.
      amountCents: ledgerEntries.amountCents,
      // (V-N2b) — the recorded settled value for the in-request recovery credit.
      // Extracted from the metadata JSONB via `->>` keyed off the SHARED constant
      // (a bound param), so the reader can never drift from the writers' key.
      settledValueBaseUnits: sql<
        string | null
      >`${ledgerEntries.metadata} ->> ${SETTLED_VALUE_BASE_UNITS_KEY}`,
    })
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.operationId, operationId), eq(ledgerEntries.rail, rail)),
    )
    .limit(1)
  return row ?? null
}

/**
 * Flip a 'pending' settlement row to 'settled' + the confirmed on-chain txHash.
 * Sets settled_at (required by the settled_at_shape CHECK). Guarded
 * `WHERE settlement_status='pending'` so 'settled' is terminal. Returns true iff
 * a row was flipped (false ⇒ no pending row matched — already terminal/absent).
 */
export async function markSettlementSettled(
  operationId: string,
  rail: string,
  txHash: string,
  /**
   * (V-N2) — the actually-collected value (base units = proof.authorization.value)
   * of THIS settling tx. OPTIONAL: supplied ONLY by the in-request submit→confirm
   * path (proof in scope, txHash == the tx whose value this is), so value and
   * external_ref stay atomically paired even if the broadcast-time
   * markSettlementBroadcast CAS-rejected. OMITTED by the reconciler tail (no
   * proof in scope — it READS the value recorded at broadcast) and by the
   * recovery confirm path (the settling tx is the PRIOR broadcast, whose value
   * was recorded at ITS broadcast — must not be overwritten with this request's
   * possibly-resigned value). When omitted the SET is byte-identical to pre-V-N2.
   */
  settledValueBaseUnits?: string,
): Promise<boolean> {
  const updated = await db
    .update(ledgerEntries)
    .set(
      settledValueBaseUnits !== undefined
        ? {
            settlementStatus: 'settled',
            settledAt: new Date(),
            externalRef: txHash,
            // NULL-safe jsonb merge (a bare `metadata ||` is NULL-strict in PG).
            // Keyed distinctly from the frozen authorizedValueBaseUnits — see
            // SETTLED_VALUE_BASE_UNITS_KEY in settled-value.ts (keep in sync).
            metadata: sql`COALESCE(${ledgerEntries.metadata}, '{}'::jsonb) || jsonb_build_object('settledValueBaseUnits', ${settledValueBaseUnits}::text)`,
          }
        : {
            settlementStatus: 'settled',
            settledAt: new Date(),
            externalRef: txHash,
          },
    )
    .where(
      and(
        eq(ledgerEntries.operationId, operationId),
        eq(ledgerEntries.rail, rail),
        eq(ledgerEntries.settlementStatus, 'pending'),
      ),
    )
    .returning({ id: ledgerEntries.id })
  return updated.length > 0
}

/**
 * Mark a 'pending' settlement row 'failed' — a CONFIRMED on-chain revert with
 * the EIP-3009 nonce still free, i.e. the USDC did NOT move. Keeps settled_at
 * NULL (CHECK-safe) and stores the reverted txHash as forensic evidence.
 * Guarded `WHERE settlement_status='pending'`.
 *
 * (T) CAS — `txHash` is REQUIRED and the WHERE additionally demands
 * `external_ref = txHash`: a terminal 'failed' flip lands ONLY when the hash
 * whose revert the caller just confirmed is still the hash bound to the row.
 * A reconciler holding a STALE external_ref from its batch SELECT (the live
 * path's recovery resubmitted and markSettlementBroadcast re-pointed the row),
 * or a Redis-down sibling request racing a resubmit, can no longer terminally
 * fail a row whose CURRENT tx may settle on-chain — previously that ended as
 * "USDC collected, developer never credited, ledger wrong, zero alerts"
 * (③ register P2). A CAS reject returns false with the row still 'pending';
 * the reconciler re-examines it next rotation with a fresh ref. No legitimate
 * caller is blockable: every caller confirms a hash the write-ahead
 * onBroadcast bound to the row before any flip, and confirmSettlementTx
 * returns its input hash in every branch. 'settled' flips deliberately carry
 * NO CAS — a success receipt is per-hash evidence that THAT tx moved the
 * funds, and a settled-CAS would create a permanent-pending zombie class in
 * the swallowed-onBroadcast edge (see the (T) trace §3).
 *
 * NOTE: callers must NOT use this when a revert is accompanied by the nonce
 * already being consumed on-chain (a concurrent settler moved the funds) — that
 * is NOT a failure; use markSettlementBroadcast to leave it 'pending' for
 * reconciliation instead.
 */
export async function markSettlementFailed(
  operationId: string,
  rail: string,
  txHash: string,
): Promise<boolean> {
  const updated = await db
    .update(ledgerEntries)
    .set({
      settlementStatus: 'failed',
      externalRef: txHash,
    })
    .where(
      and(
        eq(ledgerEntries.operationId, operationId),
        eq(ledgerEntries.rail, rail),
        eq(ledgerEntries.settlementStatus, 'pending'),
        // (T) the CAS conjunct — see the function doc. NULL never equals, so a
        // never-broadcast row is unflippable here (safe: no caller does that).
        eq(ledgerEntries.externalRef, txHash),
      ),
    )
    .returning({ id: ledgerEntries.id })
  return updated.length > 0
}

/**
 * Persist the broadcast txHash onto a still-'pending' row WITHOUT changing
 * status (timeout, RPC error after broadcast, or revert-with-nonce-consumed),
 * so the tx is never lost and a retry/reconciler can re-wait on it. Status stays
 * 'pending' (settled_at stays NULL — CHECK-safe). A pending row carrying an
 * external_ref is the signal "broadcast on-chain, confirmation outstanding."
 * Guarded `WHERE settlement_status='pending'`.
 *
 * (V) P8-e — the no-clobber CAS (③-(U) register addendum (e)): `expectedPriorRef`
 * is REQUIRED (no default — a defaulted arg would leave un-migrated callers
 * silently unprotected). The write lands only when the row's current ref is
 *   NULL (first broadcast) OR txHash itself (own-hash idempotent rewrite) OR
 *   expectedPriorRef (the ref THIS actor read before acting — the same-actor
 *   T1→T2 crash-recovery re-point).
 * A lock-less loser whose snapshot is stale against a DIFFERENT live ref
 * matches nothing and returns false — previously it silently OVERWROTE a
 * known-good winner ref (if the winner then died pre-flip, the row looped
 * pending-nonce-consumed forever and auto-credit became impossible). A
 * rejected write keeps the caller's existing (T) broadcast-evidence/no-op
 * handling; every surviving race stays DETECTED. Accepted-unreachable: a
 * corrupted ''-ref row would be wiring-absent (?? null) but CAS-real — no
 * prod writer can produce ''.
 */
export async function markSettlementBroadcast(
  operationId: string,
  rail: string,
  txHash: string,
  expectedPriorRef: string | null,
  /**
   * (V-N2) — the actually-collected value (base units = proof.authorization.value)
   * of the tx being broadcast (txHash). Recorded in the SAME UPDATE that sets
   * external_ref, so value and tx-hash are atomically paired (a same-actor
   * T1→T2 recovery re-point updates both together). OPTIONAL — supplied ONLY by
   * the orchestrators' onBroadcast (the moment THIS request broadcasts txHash);
   * the applyOutcome reverted-nonce-consumed / broadcast-unconfirmed calls OMIT
   * it (they do not re-point to a new tx, so the value already paired with the
   * existing ref stands). When omitted the SET is byte-identical to pre-V-N2.
   */
  settledValueBaseUnits?: string,
): Promise<boolean> {
  const updated = await db
    .update(ledgerEntries)
    .set(
      settledValueBaseUnits !== undefined
        ? {
            externalRef: txHash,
            // NULL-safe jsonb merge — see SETTLED_VALUE_BASE_UNITS_KEY in
            // settled-value.ts (keep the inline 'settledValueBaseUnits' in sync).
            metadata: sql`COALESCE(${ledgerEntries.metadata}, '{}'::jsonb) || jsonb_build_object('settledValueBaseUnits', ${settledValueBaseUnits}::text)`,
          }
        : { externalRef: txHash },
    )
    .where(
      and(
        eq(ledgerEntries.operationId, operationId),
        eq(ledgerEntries.rail, rail),
        eq(ledgerEntries.settlementStatus, 'pending'),
        or(
          isNull(ledgerEntries.externalRef),
          eq(ledgerEntries.externalRef, txHash),
          ...(expectedPriorRef !== null ? [eq(ledgerEntries.externalRef, expectedPriorRef)] : []),
        ),
      ),
    )
    .returning({ id: ledgerEntries.id })
  return updated.length > 0
}

/**
 * (V) P5-ii — terminalize a NEVER-BROADCAST pending row whose authorization the
 * expiry pass has PROVEN dead: chain-expired (safe-head block timestamp past the
 * stored validBefore) AND nonce-unconsumed-now. Callers own that proof (LB-1);
 * this writer enforces the preconditions structurally with TWO CAS conjuncts:
 *   - external_ref IS NULL — defeats any broadcast whose onBroadcast committed
 *     (a row that just acquired a live tx is untouchable here);
 *   - metadata->>'validBefore' = provedValidBefore — defeats any re-sign whose
 *     refresh committed (the pass proved expiry against the bound it READ; a
 *     concurrently-raised bound means the proof no longer covers the row — the
 *     DC-06 lesson: a terminal flip must CAS on the evidence it was keyed to).
 * 0 rows ⇒ do-nothing; the next run re-proves against the raised bound
 * (refreshPendingValidBefore is monotone, so this converges — no immortal rows).
 * The terminalization evidence merges in the SAME statement. settled_at stays
 * NULL (CHECK-safe: failed ⇒ NULL); external_ref stays NULL (no hash exists).
 */
export async function markSettlementExpiredNoBroadcast(
  operationId: string,
  rail: string,
  provedValidBefore: string,
  evidence: { chainTs: number; checkedAt: string },
): Promise<boolean> {
  const updated = await db
    .update(ledgerEntries)
    .set({
      settlementStatus: 'failed',
      metadata: sql`COALESCE(${ledgerEntries.metadata}, '{}'::jsonb) || jsonb_build_object('expiredTerminalized', jsonb_build_object('validBefore', ${provedValidBefore}::text, 'chainTs', ${evidence.chainTs}::numeric, 'checkedAt', ${evidence.checkedAt}::text))`,
    })
    .where(
      and(
        eq(ledgerEntries.operationId, operationId),
        eq(ledgerEntries.rail, rail),
        eq(ledgerEntries.settlementStatus, 'pending'),
        isNull(ledgerEntries.externalRef),
        // The evidence CAS — PG-faithful: a NULL metadata or absent key yields
        // NULL on ->> and NULL = $x is never true, so legacy/unbound rows are
        // structurally unflippable here (they quarantine in the pass instead).
        sql`${ledgerEntries.metadata}->>'validBefore' = ${provedValidBefore}`,
      ),
    )
    .returning({ id: ledgerEntries.id })
  return updated.length > 0
}

/**
 * (V) P5-i companion — RAISE the stored validBefore bound on a pending row to
 * cover a re-signed authorization (EIP-3009 permits re-signing the same
 * (from,nonce) with a later validBefore; recordSettlementEntry is
 * first-write-wins, so the INSERT alone would hold the stale bound and the
 * expiry pass would prove expiry against the WRONG value). RAISE-ONLY, never
 * CREATE: a legacy pre-(V) row without a stored bound keeps NONE — a bound
 * minted from a retry proof provably cannot cover the row's ORIGINAL
 * authorization (unknowable, buyer-controlled, unbounded above), and the pass
 * quarantines such rows instead of guessing. `validBefore` must be the
 * canonical decimal-seconds string (BigInt(...).toString(10) — callers
 * normalize; hex/octal forms would break the ::numeric casts).
 *
 * Returns rows>0: `false` ⇒ the row went TERMINAL between the caller's read
 * and this write (including the expiry flip landing in that sliver) — callers
 * MUST re-read and abort the submit (no broadcast onto a terminal row).
 */
export async function refreshPendingValidBefore(
  operationId: string,
  rail: string,
  validBefore: string,
): Promise<boolean> {
  const updated = await db
    .update(ledgerEntries)
    .set({
      // RAISE-only: the CASE presence-guard (metadata ? 'validBefore') makes a
      // legacy row a metadata no-op — NULL ? 'k' is NULL ⇒ ELSE arm (the row
      // still counts toward the boolean, which only reports WHERE-pending).
      // ② seal S2 (the plan Batch-1c promised guard): the STORED value's
      // ::numeric cast is regex-guarded — a corrupt non-numeric bound (no prod
      // writer mints one; out-of-band only) degrades like a legacy row
      // (metadata no-op; the expiry pass quarantines it 'unparseable') instead
      // of 22P02-throwing every live settle for that operation forever.
      metadata: sql`CASE WHEN ${ledgerEntries.metadata} ? 'validBefore' AND ${ledgerEntries.metadata}->>'validBefore' ~ '^[0-9]+$' THEN COALESCE(${ledgerEntries.metadata}, '{}'::jsonb) || jsonb_build_object('validBefore', GREATEST((${ledgerEntries.metadata}->>'validBefore')::numeric, ${validBefore}::numeric)::text) ELSE ${ledgerEntries.metadata} END`,
    })
    .where(
      and(
        eq(ledgerEntries.operationId, operationId),
        eq(ledgerEntries.rail, rail),
        eq(ledgerEntries.settlementStatus, 'pending'),
      ),
    )
    .returning({ id: ledgerEntries.id })
  return updated.length > 0
}
