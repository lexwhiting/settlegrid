/**
 * P3.K4 — Unified settlement ledger types + writer helper.
 *
 * Every rail adapter's settlement event (MPP card charge, L402 preimage
 * acceptance, x402 authorization capture, Stripe webhook-confirmed
 * payout) writes ONE row to the unified ledger via
 * {@link recordLedgerEntry}. Reconciliation tools (P3.RAIL2) then read
 * from a single source of truth rather than joining five per-rail
 * tables.
 *
 * The row shape is defined here in @settlegrid/mcp (framework-agnostic,
 * zero DB dependency) so adapters can produce a correctly-shaped entry
 * even in environments where the DB is remote. The actual Postgres
 * write lives in apps/web/src/lib/settlement/ledger.ts — callers pass
 * a `LedgerWriter` function (dependency-injected) so unit tests can
 * assert on the recorded entry without spinning up a real DB.
 *
 * D-note: The P3.K4 card specified a "unified LedgerEntry table" with
 * a fixed column list. The repo's existing `ledger_entries` table is
 * a double-entry balance ledger (accountId / entryType / counterparty)
 * that predates this card. Rather than create a parallel
 * `settlement_ledger_entries` table (which would make the "unified"
 * claim hollow), the migration in apps/web/drizzle/0005_unified_ledger.sql
 * adds the settlement-record columns to `ledger_entries` as nullable,
 * and adapters populate only the settlement subset. See migration
 * header for the full compatibility rationale.
 */

import { createHash, randomUUID } from 'crypto'

// ─── Public types ────────────────────────────────────────────────────

/**
 * Settlement outcome tracked in the ledger. Distinct from
 * {@link SettlementStatus} in `adapters/types.ts` (which models the
 * adapter-level status) — a ledger row's `status` is the
 * reconciliation-relevant state tracked over time.
 *
 *   - `pending`   — reservation recorded; external rail has not yet
 *                   confirmed the settlement.
 *   - `settled`   — external rail confirmed. `settledAt` set,
 *                   `externalRef` populated with the rail-native
 *                   settlement ID.
 *   - `voided`    — reservation cancelled before settlement. Typically
 *                   the buyer aborted or the server returned an error
 *                   after the 402 but before the capture.
 *   - `failed`    — external rail rejected the settlement. `externalRef`
 *                   carries the rail's error code in `metadata.error_code`
 *                   when available.
 *   - `reversed`  — rail confirmed a chargeback / refund. A separate
 *                   ledger row is written per reversal — the original
 *                   `settled` row is NOT mutated (append-only).
 */
export type LedgerEntryStatus =
  | 'pending'
  | 'settled'
  | 'voided'
  | 'failed'
  | 'reversed'

/**
 * The unified per-invocation settlement record. Fields track the spec
 * card verbatim with one addition (`metadata`) and one clarification
 * (`currency` is ISO-4217 alpha-3, matching the rest of the codebase's
 * currency typing).
 */
export interface LedgerEntry {
  /** UUID; server-assigned at insert. */
  id: string
  /**
   * The invocation this settlement backs. UUID that also appears on the
   * `operation_id` column of the legacy `ledger_entries` balance rows
   * so a single invocation can be queried across both record kinds.
   */
  invocationId: string
  /**
   * Optional parent workflow session. Multi-hop flows populate this
   * with the workflow's root session so a single workflow's ledger
   * rows can be fetched via `WHERE session_id = ?`. Single-hop
   * invocations leave this null.
   */
  sessionId: string | null
  /**
   * The rail (router-layer identifier) that produced the settlement.
   * Distinct from {@link protocol}: a single rail can accept multiple
   * protocols (stripe-connect rail accepts mpp/ap2/direct-card etc.).
   */
  rail: string
  /**
   * The protocol-level scheme used for the settlement. Matches the
   * `scheme` field on an `AcceptEntry` at the manifest layer
   * ('mpp', 'l402', 'exact', 'ap2', 'sg-balance', ...).
   */
  protocol: string
  /** Gross amount settled, in the smallest currency unit. */
  amountCents: number
  /** ISO-4217 currency. For `l402`, conventionally 'btc-lightning'. */
  currency: string
  /** SettleGrid's platform take in basis points (10000 = 100%). */
  takeBps: number
  /** SettleGrid's platform take in cents (derived; rounded down). */
  takeCents: number
  /** Settlement outcome. See {@link LedgerEntryStatus}. */
  status: LedgerEntryStatus
  /** ISO timestamp when the ledger row was inserted. */
  createdAt: string
  /**
   * ISO timestamp when the rail confirmed the settlement. Null for
   * `pending` rows; populated on flip to `settled`.
   */
  settledAt: string | null
  /**
   * Rail-native reference (Stripe `pi_*`, L402 `<payment_hash>`, x402
   * on-chain tx hash, etc.). Opaque to @settlegrid/mcp — surfaced for
   * reconciliation + debugging.
   */
  externalRef: string | null
  /**
   * Free-form metadata the rail wants to preserve. Keys are caller-
   * controlled; the helper validates the value is JSON-serializable
   * but does not inspect semantics.
   */
  metadata: Record<string, unknown> | null
}

/**
 * Input to {@link recordLedgerEntry}. `id` and `createdAt` are
 * server-assigned when omitted. `status` defaults to `'pending'`.
 */
export interface RecordLedgerEntryInput {
  invocationId: string
  sessionId?: string | null
  rail: string
  protocol: string
  amountCents: number
  currency: string
  takeBps: number
  takeCents?: number
  status?: LedgerEntryStatus
  settledAt?: string | null
  externalRef?: string | null
  metadata?: Record<string, unknown> | null
  /** Override the server-assigned id. Rarely needed; used by tests. */
  id?: string
  /** Override the server-assigned createdAt. Rarely needed. */
  createdAt?: string
}

/**
 * Dependency-injected writer. Implementations persist the entry to
 * durable storage (Postgres via apps/web/src/lib/settlement/ledger.ts,
 * or an in-memory store for unit tests). The writer MUST be
 * idempotent on `entry.id` — a retry with the same id returns
 * successfully without a second row.
 */
export type LedgerWriter = (entry: LedgerEntry) => Promise<void>

// ─── Public helpers ──────────────────────────────────────────────────

/**
 * Maximum bytes of JSON we'll accept for `metadata` after
 * serialization. Protects downstream storage from a caller that
 * accidentally stuffs the entire request body into `metadata` — a
 * realistic scaffolding mistake that would otherwise inflate the
 * ledger table without notice.
 */
export const LEDGER_ENTRY_METADATA_MAX_BYTES = 16 * 1024

/** Basis-point unit. `10000 = 100%`. */
const BPS_DENOMINATOR = 10_000

/**
 * Construct and persist a settlement ledger entry. Validates input at
 * the SDK boundary (every field the writer would otherwise accept
 * silently), fills in defaults (`id`, `createdAt`, `status`,
 * derived `takeCents`), and hands the resulting canonical
 * {@link LedgerEntry} to the injected writer.
 *
 * Hostile-lens guards applied at scaffold:
 *   - `amountCents` / `takeBps` / `takeCents` must be non-negative
 *     finite integers (BigInt-safe comparisons).
 *   - `takeCents` must not exceed `amountCents` — the platform take
 *     cannot be larger than the gross amount.
 *   - `currency` is normalized to lowercase for stable matching
 *     across adapters (some emit 'USD', others 'usd').
 *   - `metadata`, when present, must JSON-serialize to at most
 *     {@link LEDGER_ENTRY_METADATA_MAX_BYTES} bytes.
 *   - `rail` / `protocol` / `currency` must be non-empty strings
 *     containing no CR/LF/NUL (same constraint class the client-SDK
 *     requireString enforces on wallet credentials).
 */
export async function recordLedgerEntry(
  input: RecordLedgerEntryInput,
  writer: LedgerWriter,
): Promise<LedgerEntry> {
  if (input === null || typeof input !== 'object') {
    throw new TypeError(
      'recordLedgerEntry: `input` must be a non-null object.',
    )
  }
  if (typeof writer !== 'function') {
    throw new TypeError(
      'recordLedgerEntry: `writer` must be a function.',
    )
  }

  const invocationId = requireNonEmpty(input.invocationId, 'invocationId')
  const rail = requireNonEmpty(input.rail, 'rail')
  const protocol = requireNonEmpty(input.protocol, 'protocol')
  const currencyRaw = requireNonEmpty(input.currency, 'currency')
  const currency = currencyRaw.toLowerCase()
  requireSafeHeaderValue(rail, 'rail')
  requireSafeHeaderValue(protocol, 'protocol')
  requireSafeHeaderValue(currency, 'currency')

  const amountCents = requireCents(input.amountCents, 'amountCents')
  const takeBps = requireBps(input.takeBps, 'takeBps')

  const takeCents =
    input.takeCents !== undefined
      ? requireCents(input.takeCents, 'takeCents')
      : Math.floor((amountCents * takeBps) / BPS_DENOMINATOR)
  if (takeCents > amountCents) {
    throw new RangeError(
      `recordLedgerEntry: \`takeCents\` (${takeCents}) cannot exceed ` +
        `\`amountCents\` (${amountCents}).`,
    )
  }

  const status: LedgerEntryStatus = input.status ?? 'pending'
  if (!isValidStatus(status)) {
    throw new TypeError(
      `recordLedgerEntry: \`status\` must be one of pending/settled/voided/failed/reversed; got ${JSON.stringify(
        status,
      )}.`,
    )
  }

  const settledAt = input.settledAt ?? null
  if (settledAt !== null) {
    requireIsoTimestamp(settledAt, 'settledAt')
  }
  // A status=settled row MUST carry settledAt (audit requirement:
  // reconciliation cannot distinguish "settled but un-timestamped" from
  // "missed the settlement callback"); a status!=settled row MUST NOT
  // carry settledAt (the value would be a lie about terminal state).
  if (status === 'settled' && settledAt === null) {
    throw new RangeError(
      'recordLedgerEntry: `status=settled` requires a non-null `settledAt`.',
    )
  }
  if (status !== 'settled' && settledAt !== null) {
    throw new RangeError(
      `recordLedgerEntry: \`settledAt\` is only allowed on status=settled rows; got status=${status}.`,
    )
  }

  const sessionId = input.sessionId ?? null
  if (sessionId !== null && typeof sessionId !== 'string') {
    throw new TypeError('recordLedgerEntry: `sessionId` must be a string or null.')
  }

  const externalRef = input.externalRef ?? null
  if (externalRef !== null) {
    if (typeof externalRef !== 'string' || externalRef.length === 0) {
      throw new TypeError(
        'recordLedgerEntry: `externalRef`, when present, must be a non-empty string.',
      )
    }
    requireSafeHeaderValue(externalRef, 'externalRef')
  }

  const metadata = input.metadata ?? null
  if (metadata !== null) {
    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new TypeError(
        'recordLedgerEntry: `metadata`, when present, must be a non-null non-array object.',
      )
    }
    let serialized: string
    try {
      serialized = JSON.stringify(metadata)
    } catch (err) {
      throw new TypeError(
        `recordLedgerEntry: \`metadata\` must be JSON-serializable (got ${
          err instanceof Error ? err.message : String(err)
        }).`,
      )
    }
    if (serialized.length > LEDGER_ENTRY_METADATA_MAX_BYTES) {
      throw new RangeError(
        `recordLedgerEntry: \`metadata\` serializes to ${serialized.length} bytes, ` +
          `exceeds ${LEDGER_ENTRY_METADATA_MAX_BYTES}-byte cap.`,
      )
    }
  }

  const entry: LedgerEntry = {
    id: input.id ?? randomUUID(),
    invocationId,
    sessionId,
    rail,
    protocol,
    amountCents,
    currency,
    takeBps,
    takeCents,
    status,
    createdAt: input.createdAt ?? new Date().toISOString(),
    settledAt,
    externalRef,
    metadata,
  }

  await writer(entry)
  return entry
}

/**
 * Stable fingerprint of a ledger entry's semantic contents, used by
 * reconciliation tooling (P3.RAIL2) to dedup a row against an
 * external rail's view. Hashes the canonicalized subset of fields
 * that define the settlement — id/createdAt/metadata are NOT
 * included because they vary per-write-retry but don't change the
 * settled fact.
 */
export function fingerprintLedgerEntry(entry: LedgerEntry): string {
  const canonical = [
    entry.invocationId,
    entry.sessionId ?? '',
    entry.rail,
    entry.protocol,
    String(entry.amountCents),
    entry.currency,
    String(entry.takeBps),
    String(entry.takeCents),
    entry.status,
    entry.settledAt ?? '',
    entry.externalRef ?? '',
  ].join('|')
  return createHash('sha256').update(canonical).digest('hex')
}

// ─── Internal guards ─────────────────────────────────────────────────

const HEADER_FORBIDDEN_CHARS = /[\x00\r\n]/
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/

const VALID_STATUSES: ReadonlySet<LedgerEntryStatus> = new Set<LedgerEntryStatus>([
  'pending',
  'settled',
  'voided',
  'failed',
  'reversed',
])

function isValidStatus(s: string): s is LedgerEntryStatus {
  return VALID_STATUSES.has(s as LedgerEntryStatus)
}

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(
      `recordLedgerEntry: \`${field}\` must be a non-empty string.`,
    )
  }
  return value
}

function requireSafeHeaderValue(value: string, field: string): void {
  if (HEADER_FORBIDDEN_CHARS.test(value)) {
    throw new TypeError(
      `recordLedgerEntry: \`${field}\` contains forbidden control characters ` +
        `(CR/LF/NUL). These would corrupt downstream log + header writes.`,
    )
  }
}

function requireCents(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new TypeError(
      `recordLedgerEntry: \`${field}\` must be a non-negative integer (cents); got ${JSON.stringify(
        value,
      )}.`,
    )
  }
  return value
}

function requireBps(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > BPS_DENOMINATOR
  ) {
    throw new TypeError(
      `recordLedgerEntry: \`${field}\` must be an integer in [0, 10000] (basis points); got ${JSON.stringify(
        value,
      )}.`,
    )
  }
  return value
}

function requireIsoTimestamp(value: string, field: string): void {
  if (!ISO_TIMESTAMP_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new TypeError(
      `recordLedgerEntry: \`${field}\` must be an ISO-8601 timestamp; got ${JSON.stringify(
        value,
      )}.`,
    )
  }
}
