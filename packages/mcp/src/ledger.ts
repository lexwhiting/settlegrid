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
  /**
   * P3.K6 — Authorization signals captured at dispatch time. Each
   * entry records which built-in check (ofac / rate_limit / budget /
   * fraud / aup) or plugin ran and its verdict. Reconciliation +
   * compliance audits read this array for evidence that the gate
   * executed. Hostile-review requirement (e) says the 403 HTTP
   * response must NOT expose this array to callers — only the
   * top-level denial reason. Callers consume `signals` via ledger
   * reads, not response bodies.
   *
   * Optional on the type so pre-P3.K6 callers (constructing
   * LedgerEntry directly in tests) continue to compile. The
   * canonical `recordLedgerEntry` helper always populates it
   * (defaults to null).
   */
  authorizationSignals?: ReadonlyArray<{
    check: string
    passed: boolean
    detail?: string
  }> | null
  /**
   * P3.K6 — Optional cryptographic artifact returned by an
   * authorization plugin (e.g., a signed approval token from an
   * enterprise policy engine). Opaque string; preserved for audit.
   *
   * Optional on the type for the same reason as
   * `authorizationSignals` — keeps existing test fixtures
   * compiling while new callers get the full field set.
   */
  authorizationArtifact?: string | null
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
  /** P3.K6 — Authorization signals captured at dispatch time. */
  authorizationSignals?: ReadonlyArray<{
    check: string
    passed: boolean
    detail?: string
  }> | null
  /** P3.K6 — Optional plugin-returned cryptographic artifact. */
  authorizationArtifact?: string | null
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

/**
 * Maximum `amountCents` value accepted. One trillion cents = $10
 * billion — well above any legitimate single-invocation transaction.
 * Hostile fix H5: caps the `amountCents * takeBps` product so the
 * computation can't escape Number.MAX_SAFE_INTEGER (2^53-1 ≈ 9e15),
 * which would produce garbage values from Math.floor. Callers
 * dealing with genuinely larger sums should split across multiple
 * entries.
 */
export const LEDGER_ENTRY_MAX_AMOUNT_CENTS = 1_000_000_000_000

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
  // Hostile fix H1/H3 — every string field that could end up in a
  // downstream description / log / header line is sanitized against
  // CR/LF/NUL. The existing ledger_entries.description column has no
  // format constraint, so without this guard a poisoned invocationId
  // would silently land in logs unescaped.
  requireSafeHeaderValue(invocationId, 'invocationId')
  requireSafeHeaderValue(rail, 'rail')
  requireSafeHeaderValue(protocol, 'protocol')
  requireSafeHeaderValue(currency, 'currency')

  const amountCents = requireCents(input.amountCents, 'amountCents')
  // Hostile fix H6 — align SDK with the DB's `amount_positive`
  // check constraint. A 0-amount write would pass the SDK and then
  // hit a constraint-violation SQLSTATE at insert; surfacing the
  // violation here gives the caller a much more actionable error.
  if (amountCents === 0) {
    throw new RangeError(
      'recordLedgerEntry: `amountCents` must be positive (DB check ' +
        'constraint `ledger_entries_amount_positive` rejects rows with ' +
        'amount=0; for a free-tool invocation, record it as a spend ' +
        'entry with metadata rather than a 0-amount ledger row).',
    )
  }
  // Hostile fix H5 — cap the amount so the downstream BigInt
  // computation can always return a safely-representable Number.
  if (amountCents > LEDGER_ENTRY_MAX_AMOUNT_CENTS) {
    throw new RangeError(
      `recordLedgerEntry: \`amountCents\` (${amountCents}) exceeds the ` +
        `${LEDGER_ENTRY_MAX_AMOUNT_CENTS}-cent cap — settlements above ` +
        `this threshold must be split into multiple entries.`,
    )
  }
  const takeBps = requireBps(input.takeBps, 'takeBps')

  // Hostile fix H5 — use BigInt for the product to avoid Number
  // MAX_SAFE_INTEGER overflow on large amounts. Because takeBps ≤
  // BPS_DENOMINATOR, the result is bounded by amountCents (which is
  // already capped above), so Number() conversion is safe.
  const takeCents =
    input.takeCents !== undefined
      ? requireCents(input.takeCents, 'takeCents')
      : Number(
          (BigInt(amountCents) * BigInt(takeBps)) / BigInt(BPS_DENOMINATOR),
        )
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
  if (sessionId !== null) {
    if (typeof sessionId !== 'string') {
      throw new TypeError(
        'recordLedgerEntry: `sessionId` must be a string or null.',
      )
    }
    // Hostile fix H1 — sessionId passes through to logs and the
    // ledger_entries.session_id column; same control-char guard as
    // every other string field.
    requireSafeHeaderValue(sessionId, 'sessionId')
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

  // P3.K6 — validate authorization fields. Signals array is
  // bounded to prevent a caller from stuffing an unbounded audit
  // trail into a single ledger row. Artifact is length-capped via
  // the metadata cap to keep downstream row sizes predictable.
  const authorizationSignals = input.authorizationSignals ?? null
  if (authorizationSignals !== null) {
    if (!Array.isArray(authorizationSignals)) {
      throw new TypeError(
        'recordLedgerEntry: `authorizationSignals`, when present, must be an array.',
      )
    }
    if (authorizationSignals.length > 64) {
      throw new RangeError(
        `recordLedgerEntry: \`authorizationSignals\` array has ${authorizationSignals.length} entries; cap is 64.`,
      )
    }
    for (const entry of authorizationSignals) {
      if (entry === null || typeof entry !== 'object') {
        throw new TypeError(
          'recordLedgerEntry: each `authorizationSignals` entry must be an object.',
        )
      }
      if (typeof entry.check !== 'string' || entry.check.length === 0) {
        throw new TypeError(
          'recordLedgerEntry: each `authorizationSignals` entry must have a non-empty `check` string.',
        )
      }
      requireSafeHeaderValue(entry.check, 'authorizationSignals[].check')
      if (typeof entry.passed !== 'boolean') {
        throw new TypeError(
          'recordLedgerEntry: each `authorizationSignals` entry must have a boolean `passed`.',
        )
      }
      if (entry.detail !== undefined && typeof entry.detail !== 'string') {
        throw new TypeError(
          'recordLedgerEntry: `authorizationSignals[].detail`, when present, must be a string.',
        )
      }
    }
  }
  const authorizationArtifact = input.authorizationArtifact ?? null
  if (authorizationArtifact !== null) {
    if (typeof authorizationArtifact !== 'string' || authorizationArtifact.length === 0) {
      throw new TypeError(
        'recordLedgerEntry: `authorizationArtifact`, when present, must be a non-empty string.',
      )
    }
    if (authorizationArtifact.length > LEDGER_ENTRY_METADATA_MAX_BYTES) {
      throw new RangeError(
        `recordLedgerEntry: \`authorizationArtifact\` length ${authorizationArtifact.length} exceeds ${LEDGER_ENTRY_METADATA_MAX_BYTES}-char cap.`,
      )
    }
    requireSafeHeaderValue(authorizationArtifact, 'authorizationArtifact')
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

  // Hostile fix H10 — validate caller-supplied `id` is a UUID. The
  // ledger_entries.id column is `uuid`; a non-UUID would be rejected
  // by Postgres with a cryptic SQLSTATE, so we reject here with a
  // clearer message.
  if (input.id !== undefined) {
    if (typeof input.id !== 'string' || !UUID_PATTERN.test(input.id)) {
      throw new TypeError(
        `recordLedgerEntry: \`id\`, when provided, must be a UUID; got ${JSON.stringify(
          input.id,
        )}.`,
      )
    }
  }
  // Hostile fix H12 — validate caller-supplied `createdAt` is an
  // ISO-8601 timestamp. Same reasoning as settledAt: Postgres would
  // reject a malformed value at insert time with a cryptic error.
  if (input.createdAt !== undefined) {
    requireIsoTimestamp(input.createdAt, 'createdAt')
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
    authorizationSignals,
    authorizationArtifact,
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
 *
 * Hostile fix H11 — serializes via JSON.stringify with a fixed key
 * order instead of a `|`-joined string. A field value containing
 * `|` would otherwise collide with a different field arrangement
 * (`rail='a|b',protocol='c'` vs `rail='a',protocol='b|c'`). JSON
 * escaping makes every value unambiguously bounded.
 */
export function fingerprintLedgerEntry(entry: LedgerEntry): string {
  const canonical = JSON.stringify({
    invocationId: entry.invocationId,
    sessionId: entry.sessionId,
    rail: entry.rail,
    protocol: entry.protocol,
    amountCents: entry.amountCents,
    currency: entry.currency,
    takeBps: entry.takeBps,
    takeCents: entry.takeCents,
    status: entry.status,
    settledAt: entry.settledAt,
    externalRef: entry.externalRef,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

// ─── Internal guards ─────────────────────────────────────────────────

const HEADER_FORBIDDEN_CHARS = /[\x00\r\n]/
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/
/** RFC 4122 UUID format (case-insensitive). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
