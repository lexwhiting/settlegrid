/**
 * V-N3-erasure — ledger payer-PII MINIMIZATION: the equivalence + non-vacuity
 * proof (handoff §9 + F1/F2/F5/F6/F7/F8).
 *
 * Strategy: the predicate (`isAnonymizationEligible`), the transform
 * (`computeAnonymizedOperationId`) and the window floor
 * (`resolveAnonymizeWindowSeconds`) are PURE — pinned directly. The DARK gate +
 * selective batch UPDATE (`runPayerAnonymization`) run against a fluent `db` mock
 * so the TS eligibility guard is proven to be the AUTHORITATIVE gate: the mock
 * returns a MIXED batch INCLUDING ineligible rows, and only the eligible ones get
 * an UPDATE. The env flag/window getters are the REAL ones (read via process.env)
 * — no mock-surface divergence (DC-05). F7 uses the REAL parseSettlementOperationId.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Fluent db mock — chain methods record args; the chain is thenable, resolving to
// the planned rows (select) / returning rows (update).
const { mockDb, plan } = vi.hoisted(() => ({
  mockDb: { select: vi.fn(), update: vi.fn() },
  plan: {
    selectBatches: [] as unknown[][],
    selectCall: 0,
    updates: [] as Array<{ set: Record<string, unknown>; where: unknown }>,
    updateReturns: [{ id: 'updated' }] as unknown[], // non-empty ⇒ anonymizeRow counts a success
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import {
  isAnonymizationEligible,
  computeAnonymizedOperationId,
  resolveAnonymizeWindowSeconds,
  ANONYMIZE_WINDOW_FLOOR_SECONDS,
  runPayerAnonymization,
  rowKeysetCursor,
  type AnonymizeCandidate,
} from '../anonymize-payer'
import { parseSettlementOperationId } from '../reconcile'
import { MAX_VALIDBEFORE_WINDOW_SECONDS } from '../x402/types'

function selectChain(rows: unknown[]) {
  const c: Record<string, unknown> = {}
  c.from = () => c
  c.where = () => c
  c.orderBy = () => c
  c.limit = () => c
  ;(c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(res, rej)
  return c
}
function updateChain() {
  const captured: { set: Record<string, unknown>; where: unknown } = { set: {}, where: undefined }
  plan.updates.push(captured)
  const c: Record<string, unknown> = {}
  c.set = (s: Record<string, unknown>) => {
    captured.set = s
    return c
  }
  c.where = (w: unknown) => {
    captured.where = w
    return c
  }
  c.returning = () => c
  ;(c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(plan.updateReturns).then(res, rej)
  return c
}

// Valid payer-bearing operation_ids (match reconcile.ts X402_OPID / CIRCLE_NANO_OPID).
const X402_PAYER_OPID = `x402:eip155:8453:0x${'a'.repeat(40)}:0x${'b'.repeat(64)}`
const CN_PAYER_OPID = `circle-nano:eip155:8453:0x${'c'.repeat(40)}:0x${'d'.repeat(64)}`

const NOW = new Date('2030-01-01T00:00:00.000Z')
const AGED = new Date('2020-01-01T00:00:00.000Z') // ≫ 2555d before NOW → past the window
const RECENT = new Date('2029-12-31T00:00:00.000Z') // 1d before NOW → INSIDE the window
const WINDOW_CUTOFF = new Date(NOW.getTime() - 2555 * 86_400 * 1000)

function candidate(over: Partial<AnonymizeCandidate>): AnonymizeCandidate {
  return {
    id: 'id-default',
    operationId: X402_PAYER_OPID,
    rail: 'x402',
    settlementStatus: 'settled',
    creditedAt: new Date('2020-02-01T00:00:00.000Z'),
    createdAt: AGED,
    hasPayerMeta: true,
    ...over,
  }
}

const ENV_KEYS = ['LEDGER_PAYER_ANONYMIZE_ENABLED', 'LEDGER_PAYER_ANONYMIZE_AFTER_DAYS'] as const
const savedEnv: Record<string, string | undefined> = {}
beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k]
  delete process.env.LEDGER_PAYER_ANONYMIZE_ENABLED
  delete process.env.LEDGER_PAYER_ANONYMIZE_AFTER_DAYS
  vi.clearAllMocks()
  plan.selectBatches = []
  plan.selectCall = 0
  plan.updates = []
  plan.updateReturns = [{ id: 'updated' }]
  mockDb.select.mockImplementation(() => selectChain(plan.selectBatches[plan.selectCall++] ?? []))
  mockDb.update.mockImplementation(() => updateChain())
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})

// ── Predicate pins (the load-bearing part — handoff §9 + F1/F2) ──────────────
describe('isAnonymizationEligible — the safe-to-anonymize predicate', () => {
  const opts = { cutoff: WINDOW_CUTOFF }

  it('settled + credited + aged x402 IS eligible', () => {
    expect(isAnonymizationEligible(candidate({}), opts)).toBe(true)
  })

  it('settled + credited + aged circle-nano IS eligible', () => {
    expect(
      isAnonymizationEligible(candidate({ rail: 'circle-nano', operationId: CN_PAYER_OPID }), opts),
    ).toBe(true)
  })

  it('failed + aged IS eligible (failed never credits → no carve-out)', () => {
    expect(isAnonymizationEligible(candidate({ settlementStatus: 'failed', creditedAt: null }), opts)).toBe(true)
  })

  // F6 — DC-05 NON-VACUITY / REVERT PROOF: this assertion is anchored to the
  // `settled ∧ credited_at IS NULL` carve-out in isAnonymizationEligible. Drop
  // that carve-out line and this flips to `true` → RED (and the runner pin below
  // then UPDATEs the uncredited-sweep row, flipping its op_id).
  it('settled + credited_at NULL (the uncredited-sweep key) is NEVER eligible (F6 carve-out)', () => {
    expect(isAnonymizationEligible(candidate({ creditedAt: null }), opts)).toBe(false)
  })

  it('pending is NEVER eligible (terminal-only)', () => {
    expect(isAnonymizationEligible(candidate({ settlementStatus: 'pending' }), opts)).toBe(false)
  })

  // F1 — a non-payer rail (ap2) terminal aged row is NEVER anonymized.
  it('a non-payer rail (ap2) is NEVER eligible (F1 rail-scope)', () => {
    expect(isAnonymizationEligible(candidate({ rail: 'ap2', operationId: 'ap2:something' }), opts)).toBe(false)
  })

  // F2 — a terminal row INSIDE the replay/retention window is NOT anonymized.
  it('inside the window (created_at ≥ cutoff) is NOT eligible (F2)', () => {
    expect(isAnonymizationEligible(candidate({ createdAt: RECENT }), opts)).toBe(false)
  })

  it('an already-anon row (no payer in op_id, no metadata.payer) is NOT eligible (idempotent re-run)', () => {
    expect(
      isAnonymizationEligible(
        candidate({ operationId: 'x402:eip155:8453:anon:id-x', hasPayerMeta: false }),
        opts,
      ),
    ).toBe(false)
  })

  it('a torn row (op_id already anon BUT metadata.payer still set) re-qualifies (F8 robustness)', () => {
    expect(
      isAnonymizationEligible(
        candidate({ operationId: 'x402:eip155:8453:anon:id-x', hasPayerMeta: true }),
        opts,
      ),
    ).toBe(true)
  })
})

// ── Keyset-cursor precision pin (F-A: ②-review correctness finding) ──────────
describe('rowKeysetCursor — the keyset anchor must NOT truncate created_at to ms', () => {
  // The postgres.js driver parses timestamptz → JS Date (MILLISECOND precision),
  // but the column stores MICROSECONDS. If the cursor anchor is built from the
  // truncated Date (createdAt.toISOString()), a row whose stored created_at carries
  // sub-ms microseconds compares STRICTLY GREATER than the anchor on the created_at
  // element alone → the keyset `(created_at,id) > (anchor::timestamptz, id)`
  // re-qualifies that row forever (id tiebreaker never engages) → the cursor
  // stalls (bounded by batch/budget caps) AND silently skips later rows. The anchor
  // must therefore carry the FULL-precision `created_at` rendered by Postgres
  // `::text` (cursorCreatedAt), not the ms-truncated Date.
  it('uses the lossless ::text created_at (cursorCreatedAt), not Date.toISOString()', () => {
    const row = {
      id: 'PK-micro',
      // What Postgres `created_at::text` returns — full microsecond precision.
      cursorCreatedAt: '2030-01-01 00:00:00.123456+00',
      // What postgres.js hands back as a JS Date — TRUNCATED to milliseconds.
      createdAt: new Date('2030-01-01T00:00:00.123Z'),
    }
    const c = rowKeysetCursor(row)
    expect(c.id).toBe('PK-micro')
    // Load-bearing: the anchor is the lossless microsecond text …
    expect(c.createdAt).toBe('2030-01-01 00:00:00.123456+00')
    // … and is NOT the millisecond-truncated Date form (the F-A regression).
    expect(c.createdAt).not.toBe(row.createdAt.toISOString()) // '2030-01-01T00:00:00.123Z'
  })
})

// ── Transform pins (handoff §9 + F7) ─────────────────────────────────────────
describe('computeAnonymizedOperationId — the op_id rewrite', () => {
  it('x402: drops payer + nonce → {rail}:{network}:anon:{id}', () => {
    const out = computeAnonymizedOperationId({ operationId: X402_PAYER_OPID, rail: 'x402', id: 'PK1' })
    expect(out).toBe('x402:eip155:8453:anon:PK1')
    expect(out).not.toContain('0x') // no payer, no nonce
  })

  it('circle-nano: drops payer + nonce → {rail}:{network}:anon:{id}', () => {
    const out = computeAnonymizedOperationId({ operationId: CN_PAYER_OPID, rail: 'circle-nano', id: 'PK2' })
    expect(out).toBe('circle-nano:eip155:8453:anon:PK2')
    expect(out).not.toContain('0x')
  })

  // F7 — the anon form FAILS the canonical reconciler parser (so an anonymized
  // row can never be parsed / re-enter reconciliation). Uses the REAL parser.
  it('the anon form FAILS parseSettlementOperationId (F7 regex-reject)', () => {
    expect(parseSettlementOperationId(X402_PAYER_OPID, 'x402')).not.toBeNull() // sanity: original parses
    const anon = computeAnonymizedOperationId({ operationId: X402_PAYER_OPID, rail: 'x402', id: 'PK1' })
    expect(parseSettlementOperationId(anon, 'x402')).toBeNull()
    const cnAnon = computeAnonymizedOperationId({ operationId: CN_PAYER_OPID, rail: 'circle-nano', id: 'PK2' })
    expect(parseSettlementOperationId(cnAnon, 'circle-nano')).toBeNull()
  })

  it('is idempotent: an already-anon op_id is returned UNCHANGED', () => {
    const anon = 'x402:eip155:8453:anon:PK1'
    expect(computeAnonymizedOperationId({ operationId: anon, rail: 'x402', id: 'PK1' })).toBe(anon)
  })
})

// ── Window-floor pins (handoff F2 — load-bearing) ────────────────────────────
describe('resolveAnonymizeWindowSeconds — the hard floor', () => {
  it('the floor is ≥ 1 day AND exceeds the replay cap', () => {
    expect(ANONYMIZE_WINDOW_FLOOR_SECONDS).toBeGreaterThanOrEqual(86_400)
    expect(ANONYMIZE_WINDOW_FLOOR_SECONDS).toBeGreaterThan(MAX_VALIDBEFORE_WINDOW_SECONDS)
  })

  it('the default (2555d, env unset) resolves above the floor', () => {
    expect(resolveAnonymizeWindowSeconds()).toBe(2555 * 86_400)
  })

  it('a sub-floor window (0.5d) THROWS', () => {
    process.env.LEDGER_PAYER_ANONYMIZE_AFTER_DAYS = '0.5'
    expect(() => resolveAnonymizeWindowSeconds()).toThrow(/safety floor/i)
  })

  it('a zero window THROWS', () => {
    process.env.LEDGER_PAYER_ANONYMIZE_AFTER_DAYS = '0'
    expect(() => resolveAnonymizeWindowSeconds()).toThrow(/safety floor/i)
  })

  it('a non-numeric window THROWS (NaN never silently passes)', () => {
    process.env.LEDGER_PAYER_ANONYMIZE_AFTER_DAYS = 'not-a-number'
    expect(() => resolveAnonymizeWindowSeconds()).toThrow()
  })
})

// ── DARK-flag + selective-UPDATE pins (handoff §9 + F6 runner-level) ─────────
describe('runPayerAnonymization — dark gate + authoritative TS guard', () => {
  it('flag OFF ⇒ ZERO rows, no DB access, enabled:false (dark pin)', async () => {
    const res = await runPayerAnonymization({ now: NOW })
    expect(res).toEqual({ enabled: false, anonymized: 0, scanned: 0, skipped: 0, batches: 0, completed: true })
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('flag ON: a MIXED batch UPDATEs ONLY the eligible rows; the uncredited-sweep op_id is byte-unchanged (F6)', async () => {
    process.env.LEDGER_PAYER_ANONYMIZE_ENABLED = 'true'
    const rows: AnonymizeCandidate[] = [
      candidate({ id: 'PK-settled', operationId: X402_PAYER_OPID }), // eligible
      candidate({ id: 'PK-failed', rail: 'circle-nano', operationId: CN_PAYER_OPID, settlementStatus: 'failed', creditedAt: null }), // eligible
      candidate({ id: 'PK-uncredited', operationId: X402_PAYER_OPID.replace(/a/g, 'e'), creditedAt: null }), // carve-out
      candidate({ id: 'PK-pending', settlementStatus: 'pending' }), // not terminal
      candidate({ id: 'PK-ap2', rail: 'ap2', operationId: 'ap2:foo', hasPayerMeta: false }), // F1 rail
      candidate({ id: 'PK-inwindow', createdAt: RECENT }), // F2 age
      candidate({ id: 'PK-anon', operationId: 'x402:eip155:8453:anon:PK-anon', hasPayerMeta: false }), // already anon
    ]
    plan.selectBatches = [rows] // one short batch (< BATCH_SIZE) ⇒ loop drains after it

    const res = await runPayerAnonymization({ now: NOW, label: 'test' })

    expect(res.enabled).toBe(true)
    expect(res.scanned).toBe(7)
    expect(res.anonymized).toBe(2) // ONLY the two eligible rows
    expect(res.skipped).toBe(5)
    expect(res.completed).toBe(true)

    // Exactly the two eligible rows were UPDATEd, with the anon op_id form.
    expect(plan.updates).toHaveLength(2)
    const writtenOpIds = plan.updates.map((u) => u.set.operationId)
    expect(writtenOpIds).toContain('x402:eip155:8453:anon:PK-settled')
    expect(writtenOpIds).toContain('circle-nano:eip155:8453:anon:PK-failed')

    // F6 byte-unchanged proof: the uncredited-sweep row's op_id NEVER appears in
    // any UPDATE (neither rewritten nor matched) — its runbook closure key survives.
    const uncreditedOpId = X402_PAYER_OPID.replace(/a/g, 'e')
    for (const u of plan.updates) {
      expect(u.set.operationId).not.toBe(uncreditedOpId)
    }
  })

  it('flag ON, empty table ⇒ enabled:true, zero anonymized, no UPDATE', async () => {
    process.env.LEDGER_PAYER_ANONYMIZE_ENABLED = 'true'
    plan.selectBatches = [[]]
    const res = await runPayerAnonymization({ now: NOW })
    expect(res.enabled).toBe(true)
    expect(res.anonymized).toBe(0)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  // F-A projection guard: the candidate SELECT must project the full-precision
  // ::text keyset anchor (cursorCreatedAt). Removing it would leave rowKeysetCursor
  // reading `undefined` at runtime → a silent cursor stall on a sub-ms created_at
  // bucket (the rowKeysetCursor unit pin alone wouldn't catch a dropped projection).
  it('the candidate SELECT projects the full-precision ::text keyset anchor (F-A)', async () => {
    process.env.LEDGER_PAYER_ANONYMIZE_ENABLED = 'true'
    plan.selectBatches = [[]] // one (empty) batch ⇒ exactly one candidate SELECT
    await runPayerAnonymization({ now: NOW })
    expect(mockDb.select).toHaveBeenCalledTimes(1)
    const projection = mockDb.select.mock.calls[0]?.[0] as Record<string, unknown>
    expect(projection).toHaveProperty('cursorCreatedAt')
  })
})

// ── F5/F8 source-text guard: surgical key-removal in ONE atomic UPDATE ────────
describe('F5/F8 — metadata is removed SURGICALLY (never object-overwrite) in a single UPDATE', () => {
  const SRC = readFileSync(resolve(__dirname, '../anonymize-payer.ts'), 'utf8')

  it('the UPDATE .set rewrites operation_id AND `metadata - \'payer\'` together (one statement)', () => {
    // F8: a single .set carrying BOTH fields ⇒ no torn row. F5: the metadata value
    // is the surgical jsonb key-removal operator, NOT a {…}/null object overwrite.
    expect(SRC).toMatch(
      /\.set\(\{\s*operationId: newOperationId,\s*metadata: sql`\$\{ledgerEntries\.metadata\} - 'payer'`,?\s*\}\)/,
    )
  })

  it('never object-overwrites or nulls the whole metadata column', () => {
    expect(SRC).not.toMatch(/metadata:\s*\{/) // no metadata: { ... } overwrite
    expect(SRC).not.toMatch(/metadata:\s*null/) // no whole-column clobber
  })
})
