/**
 * V-N3-invocations-min — the minimizer + backfill equivalence / non-vacuity proof
 * (handoff §9). The PURE transform (`minimizeInvocationMetadata`) is pinned
 * directly per rail; the DARK gate + the surgical batch UPDATE
 * (`runInvocationsPayerMinimization`) run against a fluent `db` mock so the flag is
 * proven to be the authoritative gate (OFF ⇒ zero DB access) and the keyset loop
 * is proven to page + count correctly. The env flag is the REAL one (read via
 * process.env). The SQL surgical-subtraction shape (F5: NEVER an object-overwrite)
 * + the write-path wiring are pinned by source-text guards.
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
    updateCalls: 0,
    updateReturns: [{ id: 'updated' }] as unknown[], // non-empty ⇒ minimizeRow counts a success
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import {
  minimizeInvocationMetadata,
  runInvocationsPayerMinimization,
  rowKeysetCursor,
  INVOCATIONS_EVM_PAYER_KEYS,
  EVM_PAYER_RAILS,
  RAIL_GATED_PAYER_KEY,
  DRAIN_RAIL,
  DRAIN_EVM_PAYER_KEYS,
} from '../invocations-payer-min'

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
  plan.updateCalls++
  const c: Record<string, unknown> = {}
  c.set = () => c
  c.where = () => c
  c.returning = () => c
  ;(c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(plan.updateReturns).then(res, rej)
  return c
}

const ENV_KEY = 'INVOCATIONS_PAYER_MINIMIZE_ENABLED'
let savedEnv: string | undefined
beforeEach(() => {
  savedEnv = process.env[ENV_KEY]
  delete process.env[ENV_KEY]
  vi.clearAllMocks()
  plan.selectBatches = []
  plan.selectCall = 0
  plan.updateCalls = 0
  plan.updateReturns = [{ id: 'updated' }]
  mockDb.select.mockImplementation(() => selectChain(plan.selectBatches[plan.selectCall++] ?? []))
  mockDb.update.mockImplementation(() => updateChain())
})
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY]
  else process.env[ENV_KEY] = savedEnv
})

// ── The shared key constants (single source of truth — §6/§9) ────────────────
describe('the minimizer key constants', () => {
  it('the unconditional EVM-payer key set is exactly the four by-name keys', () => {
    expect([...INVOCATIONS_EVM_PAYER_KEYS]).toEqual(['payer', 'payerAddress', 'drainNonce', 'drainChannelId'])
  })
  it('the EVM-payer rails are exactly x402 / circle-nano / drain', () => {
    expect([...EVM_PAYER_RAILS]).toEqual(['x402', 'circle-nano', 'drain'])
  })
  it('the rail-gated union key is payerIdentifier', () => {
    expect(RAIL_GATED_PAYER_KEY).toBe('payerIdentifier')
  })
  it('the drain-gated EVM key set is exactly [paymentId] (the EVM channel address on drain only)', () => {
    expect(DRAIN_RAIL).toBe('drain')
    expect([...DRAIN_EVM_PAYER_KEYS]).toEqual(['paymentId'])
  })
})

// ── Pure minimizer pins (the load-bearing transform — §5#1/§5#2 + §9) ─────────
describe('minimizeInvocationMetadata — per-rail EVM-payer removal', () => {
  const EVM_ADDR = `0x${'a'.repeat(40)}`
  const ATTACKER_CASED = '0xAbCd000000000000000000000000000000001234' // mixed case → FAILS strict EIP-55

  it('x402 (payerIdentifier = EVM from): rail-gated payerIdentifier REMOVED, correlation kept', () => {
    const merged = {
      proxy: true, paymentMethod: 'x402', paymentId: '0xtx', payerIdentifier: EVM_ADDR,
      toolSlug: 'sum', upstreamStatus: 200, network: 'eip155:8453', scheme: 'exact', amountUsdc: '1000',
    }
    const out = minimizeInvocationMetadata(merged)
    expect(out).not.toHaveProperty('payerIdentifier')
    expect(out).toMatchObject({
      proxy: true, paymentMethod: 'x402', paymentId: '0xtx', toolSlug: 'sum',
      upstreamStatus: 200, network: 'eip155:8453', scheme: 'exact', amountUsdc: '1000',
    })
  })

  it('x402 with an ATTACKER-CASED (non-checksum) payer is STILL removed (rail-gate, not a value-shape test)', () => {
    const out = minimizeInvocationMetadata({ paymentMethod: 'x402', payerIdentifier: ATTACKER_CASED, toolSlug: 's' })
    expect(out).not.toHaveProperty('payerIdentifier')
  })

  it('circle-nano PAID (payerIdentifier + payer): BOTH removed', () => {
    const out = minimizeInvocationMetadata({
      paymentMethod: 'circle-nano', payerIdentifier: EVM_ADDR, payer: EVM_ADDR,
      network: 'eip155:8453', amountUsdc: '500', toolSlug: 's',
    })
    expect(out).not.toHaveProperty('payerIdentifier')
    expect(out).not.toHaveProperty('payer')
    expect(out).toMatchObject({ paymentMethod: 'circle-nano', network: 'eip155:8453', amountUsdc: '500', toolSlug: 's' })
  })

  it('circle-nano FREE (payerIdentifier + payerAddress): BOTH removed', () => {
    const out = minimizeInvocationMetadata({
      paymentMethod: 'circle-nano', payerIdentifier: EVM_ADDR, payerAddress: EVM_ADDR,
      circleNanoConfirmationId: 'conf_1', toolSlug: 's',
    })
    expect(out).not.toHaveProperty('payerIdentifier')
    expect(out).not.toHaveProperty('payerAddress')
    expect(out).toMatchObject({ circleNanoConfirmationId: 'conf_1' })
  })

  it('drain (payerIdentifier + drainChannelId + NUMBER drainNonce): all three removed, drainAmountUsdc kept', () => {
    const out = minimizeInvocationMetadata({
      paymentMethod: 'drain', payerIdentifier: EVM_ADDR,
      drainChannelId: `0x${'c'.repeat(40)}`, drainNonce: 42, drainAmountUsdc: '250', toolSlug: 's',
    })
    expect(out).not.toHaveProperty('payerIdentifier')
    expect(out).not.toHaveProperty('drainChannelId')
    expect(out).not.toHaveProperty('drainNonce')
    expect(out).toMatchObject({ paymentMethod: 'drain', drainAmountUsdc: '250', toolSlug: 's' })
  })

  it('drain: paymentId (= the EVM channel address, route.ts:2465 paymentId=result.channelId) is REMOVED — value-provenance, not name-shape', () => {
    // ③ DEEP-AUDIT FIX: for drain the proxy routes the raw EVM channel contract
    // address (voucher.channelAddress) into BOTH drainChannelId AND the generic
    // paymentId key. Removing only drainChannelId left the identical address in
    // paymentId — a value-provenance leak the name-shape census guard cannot see.
    const CHANNEL = `0x${'c'.repeat(40)}`
    const out = minimizeInvocationMetadata({
      paymentMethod: 'drain', payerIdentifier: EVM_ADDR,
      paymentId: CHANNEL, drainChannelId: CHANNEL, drainNonce: 42, drainAmountUsdc: '250', toolSlug: 's',
    })
    expect(out).not.toHaveProperty('paymentId') // the leak this fix closes
    expect(out).not.toHaveProperty('drainChannelId')
    expect(out).not.toHaveProperty('payerIdentifier')
    expect(out).toMatchObject({ paymentMethod: 'drain', drainAmountUsdc: '250', toolSlug: 's' })
  })

  it('NON-drain rails RETAIN paymentId (it is a settlement tx-hash / opaque ref, NOT an EVM address — no over-minimization)', () => {
    // x402/circle-nano paymentId is a settlement tx hash; ap2/ucp/etc a session/ref id.
    // paymentId is EVM-address-valued ONLY on drain, so removal is drain-gated.
    expect(minimizeInvocationMetadata({ paymentMethod: 'x402', paymentId: '0xTXHASH', payerIdentifier: EVM_ADDR }))
      .toHaveProperty('paymentId', '0xTXHASH')
    expect(minimizeInvocationMetadata({ paymentMethod: 'circle-nano', paymentId: '0xTXHASH', payerIdentifier: EVM_ADDR }))
      .toHaveProperty('paymentId', '0xTXHASH')
    expect(minimizeInvocationMetadata({ paymentMethod: 'ap2', paymentId: 'txn_123', payerIdentifier: 'consumer_abc' }))
      .toHaveProperty('paymentId', 'txn_123')
  })

  it('a NUMBER drainNonce is removed by NAME (a value-shape string redactor would miss it — the B1 seam)', () => {
    const out = minimizeInvocationMetadata({ paymentMethod: 'drain', drainNonce: 7 })
    expect(out).not.toHaveProperty('drainNonce')
  })

  // ── R2: non-EVM rails keep their payerIdentifier (value-shape independence) ──
  it('ap2 (non-EVM payerIdentifier = consumerId): payerIdentifier KEPT', () => {
    const out = minimizeInvocationMetadata({
      paymentMethod: 'ap2', payerIdentifier: 'consumer_abc', ap2MandateType: 'intent', toolSlug: 's',
    })
    expect(out).toHaveProperty('payerIdentifier', 'consumer_abc')
  })

  it('kyapay/visa-tap with a 40-HEX non-EVM payerIdentifier is KEPT (not over-minimized)', () => {
    // A kyapay principalId / visa-tap tokenReferenceId can be 40 hex chars yet is
    // NOT an EVM address — `{strict:false} isAddress` would over-minimize it; the
    // rail-gate leaves it untouched.
    const hex40 = 'deadbeef'.repeat(5) // 40 hex chars, no 0x
    expect(minimizeInvocationMetadata({ paymentMethod: 'kyapay', payerIdentifier: hex40 }))
      .toHaveProperty('payerIdentifier', hex40)
    expect(minimizeInvocationMetadata({ paymentMethod: 'visa-tap', payerIdentifier: `0x${hex40}` }))
      .toHaveProperty('payerIdentifier', `0x${hex40}`)
  })

  it('a non-EVM rail that somehow carries a stray `payer` key still drops it (unconditional by-name)', () => {
    // The unconditional set is by NAME and EVM-only in practice; removing it on any
    // rail is safe (no non-EVM rail writes it). Defends a future collision.
    const out = minimizeInvocationMetadata({ paymentMethod: 'ap2', payerIdentifier: 'consumer_abc', payer: 'x' })
    expect(out).not.toHaveProperty('payer')
    expect(out).toHaveProperty('payerIdentifier', 'consumer_abc') // rail-gate still keeps the union key
  })

  // ── Purity / idempotency / defensive ────────────────────────────────────────
  it('does NOT mutate its input', () => {
    const merged = { paymentMethod: 'circle-nano', payerIdentifier: EVM_ADDR, payer: EVM_ADDR, toolSlug: 's' }
    const snapshot = JSON.parse(JSON.stringify(merged))
    minimizeInvocationMetadata(merged)
    expect(merged).toEqual(snapshot) // original untouched
  })

  it('is idempotent: applying twice equals applying once', () => {
    const merged = { paymentMethod: 'drain', payerIdentifier: EVM_ADDR, drainChannelId: '0xc', drainNonce: 1, toolSlug: 's' }
    const once = minimizeInvocationMetadata(merged)
    const twice = minimizeInvocationMetadata(once)
    expect(twice).toEqual(once)
  })

  it('a missing / non-string paymentMethod keeps payerIdentifier (defensive — never throws)', () => {
    expect(minimizeInvocationMetadata({ payerIdentifier: EVM_ADDR })).toHaveProperty('payerIdentifier', EVM_ADDR)
    expect(minimizeInvocationMetadata({ paymentMethod: 123 as unknown as string, payerIdentifier: EVM_ADDR }))
      .toHaveProperty('payerIdentifier', EVM_ADDR)
  })

  it('the four unconditional keys are removed on EVERY rail (matches the constant)', () => {
    const withAll: Record<string, unknown> = { paymentMethod: 'x402' }
    for (const k of INVOCATIONS_EVM_PAYER_KEYS) withAll[k] = 'v'
    const out = minimizeInvocationMetadata(withAll)
    for (const k of INVOCATIONS_EVM_PAYER_KEYS) expect(out).not.toHaveProperty(k)
  })
})

// ── rowKeysetCursor precision pin (the ::text microsecond anchor) ─────────────
describe('rowKeysetCursor — lossless microsecond anchor (not ms-truncated)', () => {
  it('uses the ::text cursorCreatedAt, carrying sub-millisecond microseconds', () => {
    const c = rowKeysetCursor({ id: 'PK-x', cursorCreatedAt: '2030-01-01 00:00:00.123456+00' })
    expect(c).toEqual({ createdAt: '2030-01-01 00:00:00.123456+00', id: 'PK-x' })
  })
})

// ── DARK gate + keyset-loop pins (the runner — §9) ───────────────────────────
describe('runInvocationsPayerMinimization — dark gate + surgical batch loop', () => {
  it('flag OFF ⇒ ZERO rows, no DB access, enabled:false (dark pin)', async () => {
    const res = await runInvocationsPayerMinimization()
    expect(res).toEqual({ enabled: false, minimized: 0, scanned: 0, skipped: 0, batches: 0, completed: true })
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('flag ON: every candidate is minimized in one short batch (scanned == minimized)', async () => {
    process.env[ENV_KEY] = 'true'
    plan.selectBatches = [[
      { id: 'PK-1', cursorCreatedAt: '2025-01-01 00:00:00.000001+00' },
      { id: 'PK-2', cursorCreatedAt: '2025-01-02 00:00:00.000002+00' },
      { id: 'PK-3', cursorCreatedAt: '2025-01-03 00:00:00.000003+00' },
    ]]
    const res = await runInvocationsPayerMinimization({ label: 'test' })
    expect(res).toMatchObject({ enabled: true, minimized: 3, scanned: 3, skipped: 0, batches: 1, completed: true })
    expect(plan.updateCalls).toBe(3) // one surgical UPDATE per candidate
  })

  it('flag ON: a candidate whose UPDATE matches 0 (concurrently cleaned) counts as skipped, not minimized', async () => {
    process.env[ENV_KEY] = 'true'
    plan.updateReturns = [] // UPDATE returns no row ⇒ skipped
    plan.selectBatches = [[{ id: 'PK-gone', cursorCreatedAt: '2025-01-01 00:00:00.000001+00' }]]
    const res = await runInvocationsPayerMinimization()
    expect(res).toMatchObject({ enabled: true, minimized: 0, scanned: 1, skipped: 1 })
  })

  it('flag ON, empty table ⇒ enabled:true, zero minimized, no UPDATE', async () => {
    process.env[ENV_KEY] = 'true'
    plan.selectBatches = [[]]
    const res = await runInvocationsPayerMinimization()
    expect(res).toMatchObject({ enabled: true, minimized: 0, scanned: 0, batches: 0, completed: true })
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('flag ON: pages MULTIPLE batches via the keyset cursor (full batch ⇒ continue; short batch ⇒ drain)', async () => {
    process.env[ENV_KEY] = 'true'
    plan.selectBatches = [
      [ // a FULL batch (== batchSize 2) ⇒ loop continues
        { id: 'PK-1', cursorCreatedAt: '2025-01-01 00:00:00.000001+00' },
        { id: 'PK-2', cursorCreatedAt: '2025-01-02 00:00:00.000002+00' },
      ],
      [ // a SHORT batch (< batchSize) ⇒ loop drains
        { id: 'PK-3', cursorCreatedAt: '2025-01-03 00:00:00.000003+00' },
      ],
    ]
    const res = await runInvocationsPayerMinimization({ batchSize: 2 })
    expect(res).toMatchObject({ enabled: true, minimized: 3, scanned: 3, batches: 2, completed: true })
    expect(mockDb.select).toHaveBeenCalledTimes(2)
  })

  it('the candidate SELECT projects the full-precision ::text keyset anchor (cursorCreatedAt)', async () => {
    process.env[ENV_KEY] = 'true'
    plan.selectBatches = [[]]
    await runInvocationsPayerMinimization()
    expect(mockDb.select).toHaveBeenCalledTimes(1)
    const projection = mockDb.select.mock.calls[0]?.[0] as Record<string, unknown>
    expect(projection).toHaveProperty('cursorCreatedAt')
    expect(projection).not.toHaveProperty('metadata') // never project the payer VALUE
  })
})

// ── Source-text guards: surgical jsonb subtraction + the write-path wiring ────
describe('F5 — backfill is SURGICAL jsonb subtraction (NEVER an object-overwrite)', () => {
  const SRC = readFileSync(resolve(__dirname, '../invocations-payer-min.ts'), 'utf8')

  it('the UPDATE .set hands a CASE/subtraction SQL expression, not an object/null literal', () => {
    expect(SRC).toMatch(/\.set\(\{ metadata: setExpr \}\)/)
    // surgical key subtraction present (the `metadata - 'key'` operator chain) …
    expect(SRC).toMatch(/\$\{stripped\} - \$\{key\}::text/)
    // … and NO whole-column object-overwrite / null-clobber in any .set
    expect(SRC).not.toMatch(/\.set\(\{\s*metadata:\s*\{/)
    expect(SRC).not.toMatch(/\.set\(\{\s*metadata:\s*null/)
  })

  it('the EVM-rail CASE branch subtracts payerIdentifier; the drain branch ALSO subtracts the drain EVM keys (paymentId)', () => {
    // evmStripped subtracts the rail-gated union key …
    expect(SRC).toContain('const evmStripped = sql`(${stripped} - ${RAIL_GATED_PAYER_KEY}::text)`')
    // … drainStripped additionally subtracts DRAIN_EVM_PAYER_KEYS (paymentId) …
    expect(SRC).toContain('for (const key of DRAIN_EVM_PAYER_KEYS) drainStripped = sql`(${drainStripped} - ${key}::text)`')
    // … and the CASE routes drain → drainStripped (most specific first), the other
    // EVM rails → evmStripped, everything else → the unchanged stripped.
    expect(SRC).toContain("'paymentMethod' = ${DRAIN_RAIL}::text THEN ${drainStripped}")
    expect(SRC).toContain("'paymentMethod' IN (${railList}) THEN ${evmStripped}")
  })

  it('the candidate condition rail-gates the drain paymentId presence (converges — never unconditional)', () => {
    // paymentId is written `?? null` on every protocol row, so an unconditional
    // presence test would never converge; gating on the drain rail is what lets the
    // scan terminate after the paymentId key is subtracted.
    expect(SRC).toContain("'paymentMethod' = ${DRAIN_RAIL}::text AND")
  })

  it('the candidate condition rail-gates payerIdentifier presence (converges — never the bare ?| includes it)', () => {
    // payerIdentifier presence is tested ONLY under the rail IN-list, never as a
    // standalone `?|` element (which would never converge — see candidateMetaCondition).
    expect(SRC).toMatch(/IN \(\$\{railList\}\)[\s\S]*\?\s*\$\{RAIL_GATED_PAYER_KEY\}/)
  })
})

describe('write-path — recordProtocolInvocation gates the minimizer on the merged object', () => {
  const ROUTE = readFileSync(
    resolve(__dirname, '../../../app/api/proxy/[slug]/route.ts'),
    'utf8',
  )

  it('minimizes the fully-MERGED metadata, gated by the flag; OFF passes it through (identity)', () => {
    expect(ROUTE).toMatch(
      /isInvocationsPayerMinimizeEnabled\(\)\s*\?\s*minimizeInvocationMetadata\(mergedMetadata\)\s*:\s*mergedMetadata/,
    )
    // the merged object spreads extraMetadata BEFORE minimization (no bypass)
    expect(ROUTE).toMatch(/mergedMetadata[\s\S]*\.\.\.params\.extraMetadata/)
  })
})
