/**
 * Charge-idempotency regression test (launch-gate G3-3, DC-02 / DC-24).
 *
 * Guarantee under test: a client RETRY of a timed-out metered proxy call is
 * charged AT MOST ONCE within the retry window. The gate (a tri-state Redis
 * SET-NX claim placed BEFORE the cache check + upstream forward) guards the
 * atomic CAS debit — the money move — not the fire-and-forget `invocations`
 * record (LBD-1), and one claim governs all three debiting paths (FOLD 1).
 *
 * Teeth (DC-24): the behavioral suite drives the REAL exported POST →
 * handleProxy TWICE with a byte-identical body against a mocked Redis+db and
 * asserts EXACTLY ONE consumer debit + EXACTLY ONE developer credit. Deleting
 * the claim in route.ts makes the second request debit again → these assertions
 * go RED (reproduce fail-then-pass at build time). A source-scan alone (the
 * billing-credits.test.ts style) cannot catch that, so it only supplements.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { NextRequest } from 'next/server'

const H = vi.hoisted(() => {
  const redisState = { store: new Map<string, string>(), down: false, claimUnavailable: false }

  const selectLimit = vi.fn()
  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    limit: selectLimit,
  }

  const updateReturning = vi.fn()
  // The result of `db.update(...).set(...).where(...)`: a thenable (so an
  // awaited non-returning UPDATE resolves) that ALSO carries `.returning()`
  // (the debit path). Debit = the ONLY update that calls `.returning()`, so
  // `updateReturning`'s call count == the number of consumer money-moves.
  const whereResult = {
    returning: updateReturning,
    then: (onFulfilled?: (v: unknown) => unknown) =>
      Promise.resolve(undefined).then(onFulfilled),
    catch: (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).catch(onRejected),
  }
  const dbUpdate = vi.fn((_table?: unknown) => {
    const chain = { set: () => chain, where: () => whereResult }
    return chain
  })

  const insertValues = vi.fn(() => Promise.resolve(undefined))

  const db = {
    select: () => selectChain,
    update: dbUpdate,
    insert: () => ({ values: insertValues }),
  }

  return {
    redisState,
    selectLimit,
    updateReturning,
    dbUpdate,
    insertValues,
    db,
    safeFetch: vi.fn(),
    findFallbackTool: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    delSpy: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ db: H.db }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    set: async (k: string, v: string, opts?: { nx?: boolean; ex?: number }) => {
      if (H.redisState.down) throw new Error('redis down')
      // Redis down at CLAIM time only (the SET-NX throws → 'unavailable'/fail-open),
      // while del/get still work — models an outage that recovers by release time.
      if (opts?.nx && H.redisState.claimUnavailable) throw new Error('redis down (claim)')
      if (opts?.nx && H.redisState.store.has(k)) return null
      H.redisState.store.set(k, v)
      return 'OK'
    },
    get: async (k: string) => {
      if (H.redisState.down) throw new Error('redis down')
      // Mirror @upstash/redis .get<T>(): a JSON-serialized value is auto-deserialized
      // on read (the proxy caches via set(JSON.stringify(...)) and reads get<T>()).
      const raw = H.redisState.store.get(k)
      if (raw === undefined) return null
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    },
    del: async (k: string) => {
      if (H.redisState.down) throw new Error('redis down')
      H.delSpy(k)
      H.redisState.store.delete(k)
      return 1
    },
  }),
  tryRedis: async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn()
    } catch {
      return null
    }
  },
}))
vi.mock('@/lib/logger', () => ({ logger: H.logger }))
vi.mock('@/lib/crypto', () => ({ apiKeyHashCandidates: () => ['hash-candidate'] }))
vi.mock('@/lib/fraud', () => ({
  isIpBlocked: async () => false,
  trackFailedAuth: async () => {},
  detectFraud: async () => ({ flagged: false, riskScore: 0, signals: [], reasons: [] }),
}))
vi.mock('@/lib/safe-egress', () => ({
  safeFetch: H.safeFetch,
  assertSafeUrlSync: () => {},
  SsrfBlockedError: class SsrfBlockedError extends Error {},
}))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  sdkLimiter: {},
  checkRateLimit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: 0 })),
}))
// Keep the REAL shouldAttemptFailover (its true 500/502/503/504 status set) so the
// non-failover tests are unaffected; only stub the two DB-touching lookups so a 503
// can drive the behavioral SLA-failover debit path (site #6).
vi.mock('@/lib/failover', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/failover')>()
  return {
    ...actual,
    findFallbackTool: H.findFallbackTool,
    consumerCanAffordFailover: async () => true,
  }
})

// Real helper (the thing under test) + real schema (for update-table identity)
import { claimCharge, releaseCharge, chargeIdemKey, CHARGE_IDEM_TTL_SECONDS } from '@/lib/proxy-idempotency'
import { developers } from '@/lib/db/schema'
import { POST } from '../route'

const SLUG = 'demo'
const API_KEY = 'sk_live_' + 'a'.repeat(40)

const KEY_ROW = {
  keyId: 'key-1',
  keyStatus: 'active',
  consumerId: 'consumer-1',
  toolId: 'tool-1',
  isTestKey: false,
  ipAllowlist: null,
  keyCreatedAt: new Date('2026-01-01T00:00:00Z'),
  keyLastUsedAt: new Date('2026-01-01T00:00:00Z'),
  toolName: 'Demo Tool',
  toolSlug: SLUG,
  toolStatus: 'active',
  proxyEndpoint: 'https://upstream.example/api',
  developerId: 'dev-1',
  // cacheTtlSeconds:0 isolates the gate from the edge cache for the main path.
  pricingConfig: { defaultCostCents: 50, cacheTtlSeconds: 0 },
}
const BALANCE_ROW = { id: 'ctb-1', balanceCents: 100_000 }
// A cacheable variant (cacheTtl>0) to exercise the cache-HIT debit site (#1).
const CACHEABLE_KEY_ROW = {
  ...KEY_ROW,
  pricingConfig: { defaultCostCents: 50, cacheTtlSeconds: 300 },
}

/** Prime the two SELECTs (auth join, then balance pre-check) each request makes. */
function primeRequests(count: number) {
  for (let i = 0; i < count; i++) {
    H.selectLimit.mockResolvedValueOnce([KEY_ROW]).mockResolvedValueOnce([BALANCE_ROW])
  }
}

/** Prime a cacheable tool's SELECTs (auth join, then balance pre-check). */
function primeCacheable(count: number) {
  for (let i = 0; i < count; i++) {
    H.selectLimit.mockResolvedValueOnce([CACHEABLE_KEY_ROW]).mockResolvedValueOnce([BALANCE_ROW])
  }
}

/** Prime the failover path's THREE SELECTs (auth, balance, getToolCategory). */
function primeFailover(count: number) {
  for (let i = 0; i < count; i++) {
    H.selectLimit
      .mockResolvedValueOnce([KEY_ROW])
      .mockResolvedValueOnce([BALANCE_ROW])
      .mockResolvedValueOnce([{ category: 'search' }])
  }
}

/** Let a fire-and-forget write (e.g. the cache set) settle before the next request. */
const flush = () => new Promise((r) => setTimeout(r, 0))

function upstream200() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function makeReq(body: unknown, extraHeaders: Record<string, string> = {}): NextRequest {
  return new Request(`https://settlegrid.ai/api/proxy/${SLUG}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, ...extraHeaders },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function callPost(req: NextRequest) {
  return POST(req, { params: Promise.resolve({ slug: SLUG }) })
}

/** How many times a real consumer debit (per-tool CAS UPDATE) fired. */
function consumerDebits() {
  return H.updateReturning.mock.calls.length
}
/** How many times the developer balance was credited. */
function developerCredits() {
  return H.dbUpdate.mock.calls.filter((c) => c[0] === developers).length
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks resets call records but NOT the mockResolvedValueOnce queue;
  // reset it so a test whose deduped 2nd request consumes fewer SELECTs than it
  // primed cannot leak a leftover row into the next test's auth (③ test-hygiene).
  H.selectLimit.mockReset()
  H.redisState.store.clear()
  H.redisState.down = false
  H.redisState.claimUnavailable = false
  H.insertValues.mockResolvedValue(undefined)
  // Per-tool debit CAS succeeds by default (collects → credits developer).
  H.updateReturning.mockResolvedValue([{ balanceCents: 99_950 }])
  H.findFallbackTool.mockResolvedValue({
    slug: 'fallback',
    proxyEndpoint: 'https://fallback.example/api',
    developerId: 'dev-1',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ────────────────────────────────────────────────────────────────────────────
// 1. Helper: the tri-state claim, release, and key derivation (real Redis mock)
// ────────────────────────────────────────────────────────────────────────────
describe('claimCharge / releaseCharge (tri-state, FOLD 2/6)', () => {
  it('first claim WINS, a second claim on the same key is a DUPLICATE', async () => {
    const key = 'idem:charge:unit-a'
    expect(await claimCharge(key, CHARGE_IDEM_TTL_SECONDS)).toBe('won')
    expect(await claimCharge(key, CHARGE_IDEM_TTL_SECONDS)).toBe('duplicate')
  })

  it('a RELEASED key can be claimed again (DC-06: no permanent phantom dedup)', async () => {
    const key = 'idem:charge:unit-b'
    expect(await claimCharge(key, CHARGE_IDEM_TTL_SECONDS)).toBe('won')
    expect(await claimCharge(key, CHARGE_IDEM_TTL_SECONDS)).toBe('duplicate')
    await releaseCharge(key)
    expect(await claimCharge(key, CHARGE_IDEM_TTL_SECONDS)).toBe('won')
  })

  it('two DISTINCT keys both win (no cross-request false-dedup)', async () => {
    expect(await claimCharge('idem:charge:x', CHARGE_IDEM_TTL_SECONDS)).toBe('won')
    expect(await claimCharge('idem:charge:y', CHARGE_IDEM_TTL_SECONDS)).toBe('won')
  })

  it('Redis down surfaces as UNAVAILABLE, not duplicate (FOLD 2)', async () => {
    H.redisState.down = true
    expect(await claimCharge('idem:charge:z', CHARGE_IDEM_TTL_SECONDS)).toBe('unavailable')
  })
})

describe('chargeIdemKey (FOLD 4)', () => {
  const base = { consumerId: 'c1', toolId: 't1', method: 'POST', bodyHash: 'bh' }

  it('is stable for the same request identity and namespaced', () => {
    const k1 = chargeIdemKey(base)
    const k2 = chargeIdemKey(base)
    expect(k1).toBe(k2)
    expect(k1.startsWith('idem:charge:')).toBe(true)
  })

  it('differs across consumers, tools, methods, and bodies', () => {
    const k = chargeIdemKey(base)
    expect(chargeIdemKey({ ...base, consumerId: 'c2' })).not.toBe(k)
    expect(chargeIdemKey({ ...base, toolId: 't2' })).not.toBe(k)
    expect(chargeIdemKey({ ...base, method: 'GET' })).not.toBe(k)
    expect(chargeIdemKey({ ...base, bodyHash: 'other' })).not.toBe(k)
  })

  it('prefers an explicit client key but scopes it per consumer AND per tool (untrusted input)', () => {
    const withKey = chargeIdemKey({ ...base, clientKey: 'abc' })
    // A different body but the SAME client key → same gate (client declares identity)
    expect(chargeIdemKey({ ...base, bodyHash: 'zzz', clientKey: 'abc' })).toBe(withKey)
    // Same client key, DIFFERENT consumer → different gate (no cross-consumer collision)
    expect(chargeIdemKey({ ...base, consumerId: 'c2', clientKey: 'abc' })).not.toBe(withKey)
    // Same client key, DIFFERENT tool → different gate. A per-tool money rail must NOT
    // collapse two genuinely-different tool calls a consumer happens to send with the
    // same Idempotency-Key: that would skip the debit AND the upstream forward for the
    // 2nd tool, mis-serving a real request and leaking that developer's charge.
    expect(chargeIdemKey({ ...base, toolId: 't2', clientKey: 'abc' })).not.toBe(withKey)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 2. Behavioral: drive the REAL handleProxy twice (the DC-24 teeth)
// ────────────────────────────────────────────────────────────────────────────
describe('metered proxy — retry is charged at most once (G3-3)', () => {
  it('two identical requests → ONE debit, ONE credit; 2nd is a 2xx duplicate', async () => {
    primeRequests(2)
    H.safeFetch.mockImplementation(async () => upstream200())
    const body = { q: 'same' }

    const res1 = await callPost(makeReq(body))
    expect(res1.status).toBe(200)
    expect(res1.headers.get('X-SettleGrid-Duplicate')).toBeNull()
    expect(H.safeFetch).toHaveBeenCalledTimes(1)
    expect(consumerDebits()).toBe(1)
    expect(developerCredits()).toBe(1)

    const res2 = await callPost(makeReq(body))
    expect(res2.status).toBe(200) // NOT 409/5xx — a non-2xx would re-trigger retry
    expect(res2.headers.get('X-SettleGrid-Duplicate')).toBe('true')
    expect(res2.headers.get('X-SettleGrid-Cost-Cents')).toBe('0')
    expect(await res2.json()).toMatchObject({ duplicate: true })

    // The crux: the duplicate did NOT forward upstream, NOT debit, NOT credit.
    expect(H.safeFetch).toHaveBeenCalledTimes(1)
    expect(consumerDebits()).toBe(1)
    expect(developerCredits()).toBe(1)
  })

  it('two DISTINCT bodies both charge (the gate does not over-dedup)', async () => {
    primeRequests(2)
    H.safeFetch.mockImplementation(async () => upstream200())

    const resA = await callPost(makeReq({ q: 'A' }))
    const resB = await callPost(makeReq({ q: 'B' }))

    expect(resA.headers.get('X-SettleGrid-Duplicate')).toBeNull()
    expect(resB.headers.get('X-SettleGrid-Duplicate')).toBeNull()
    expect(H.safeFetch).toHaveBeenCalledTimes(2)
    expect(consumerDebits()).toBe(2)
  })

  it('a no-charge outcome RELEASES the key so a later retry can charge (FOLD 6)', async () => {
    primeRequests(2)
    // 1st: upstream 404 (non-2xx, not a failover code) → no charge → key released.
    // 2nd (identical): upstream 200 → the gate must WIN again and charge.
    H.safeFetch
      .mockResolvedValueOnce(new Response('nope', { status: 404 }))
      .mockResolvedValueOnce(upstream200())
    const body = { q: 'release' }

    const res1 = await callPost(makeReq(body))
    expect(res1.status).toBe(404)
    expect(consumerDebits()).toBe(0) // upstream failed → nothing collected

    const res2 = await callPost(makeReq(body))
    expect(res2.status).toBe(200)
    expect(res2.headers.get('X-SettleGrid-Duplicate')).toBeNull() // NOT deduped
    expect(consumerDebits()).toBe(1) // the retry charged exactly once
  })

  it('Redis down → fail-OPEN (still charges) and pages a money_loss alert (FOLD 3)', async () => {
    primeRequests(1)
    H.redisState.down = true
    H.safeFetch.mockImplementation(async () => upstream200())

    const res = await callPost(makeReq({ q: 'outage' }))
    expect(res.status).toBe(200)
    expect(consumerDebits()).toBe(1) // fail-open preserves the money rail
    expect(H.logger.error).toHaveBeenCalledWith(
      'proxy.idempotency_gate_unavailable',
      // The at-risk amount (costCents) MUST be in the payload so the money_loss
      // alert is reconcilable/refundable — pin it so a regression that drops it fails.
      expect.objectContaining({ consumerId: KEY_ROW.consumerId, costCents: 50 }),
    )
  })

  // ── Site #1: cache-HIT debit. FOLD 9 wants behavioral teeth at EACH debit site. ──
  it('a retry does NOT reach the cache-HIT debit (#1); it is served the cached body at cost 0', async () => {
    primeCacheable(2)
    H.safeFetch.mockImplementation(async () => upstream200())
    const body = { q: 'cacheable' }

    // req1: cache MISS → forward → 200 → cache write + main debit (#3).
    const res1 = await callPost(makeReq(body))
    expect(res1.status).toBe(200)
    expect(H.safeFetch).toHaveBeenCalledTimes(1)
    expect(consumerDebits()).toBe(1)
    await flush() // let the fire-and-forget cache write land before the retry reads it

    // req2 (identical retry): claim DUPLICATE → served the CACHED body, NOT re-forwarded,
    // NOT re-debited. Delete the claim in route.ts and req2 CACHE-HITs → debits again (#1).
    const res2 = await callPost(makeReq(body))
    expect(res2.status).toBe(200)
    expect(res2.headers.get('X-SettleGrid-Duplicate')).toBe('true')
    expect(res2.headers.get('X-SettleGrid-Cost-Cents')).toBe('0')
    expect(res2.headers.get('X-SettleGrid-Cache')).toBe('HIT') // real cached body, not the marker
    expect(await res2.json()).toMatchObject({ ok: true })
    expect(H.safeFetch).toHaveBeenCalledTimes(1) // no re-forward
    expect(consumerDebits()).toBe(1) // no second debit at the cache-hit site
  })

  // ── Site #6: SLA-failover debit. Behavioral (not the toothless source-scan). ──
  it('a retry does NOT re-run the SLA-failover debit (#6)', async () => {
    primeFailover(2)
    // Odd calls (main upstream) → 503 (failover-eligible); even calls (fallback) → 200.
    let n = 0
    H.safeFetch.mockImplementation(async () => {
      n += 1
      return n % 2 === 1 ? new Response('err', { status: 503 }) : upstream200()
    })
    const body = { q: 'failover' }

    // req1: main 503 → failover → fallback 200 → exactly one debit at #6.
    const res1 = await callPost(makeReq(body))
    expect(res1.status).toBe(200)
    expect(res1.headers.get('X-SettleGrid-Failover')).toBe('true')
    expect(H.safeFetch).toHaveBeenCalledTimes(2) // main + fallback
    expect(consumerDebits()).toBe(1)
    expect(developerCredits()).toBe(1)

    // req2 (identical retry): claim DUPLICATE → no forward, no failover, no re-debit.
    // Delete the claim and req2 re-runs the whole failover → a SECOND #6 debit.
    const res2 = await callPost(makeReq(body))
    expect(res2.status).toBe(200)
    expect(res2.headers.get('X-SettleGrid-Duplicate')).toBe('true')
    expect(H.safeFetch).toHaveBeenCalledTimes(2) // NOT re-forwarded
    expect(consumerDebits()).toBe(1) // NOT re-debited at #6
    expect(developerCredits()).toBe(1)
  })

  // ── ③ F2: a fail-open request must NOT release a key it never owned. ──
  it('a fail-open (Redis-down-at-claim) request never DELETEs the shared key (③ F2)', async () => {
    primeRequests(1)
    // Redis is down ONLY at claim time → this request fails OPEN ('unavailable')
    // and sets NO key; by the time it reaches its release path Redis has recovered
    // (del works). A concurrent byte-identical winner may now hold this exact key,
    // so releasing it would delete THAT winner's live claim → a later retry
    // re-wins and re-charges → a double-charge in which every survivor saw a
    // healthy Redis (outside the accepted outage∩retry envelope).
    H.redisState.claimUnavailable = true
    H.safeFetch.mockRejectedValue(new Error('upstream boom')) // → no-charge release exit

    const res = await callPost(makeReq({ q: 'flap' }))
    expect(res.status).toBe(503) // UPSTREAM_UNREACHABLE

    // It failed open + paged the money_loss alert (holding NO key)…
    expect(H.logger.error).toHaveBeenCalledWith(
      'proxy.idempotency_gate_unavailable',
      expect.objectContaining({ costCents: 50 }),
    )
    // …and therefore must NOT delete the shared key. Shipped code released on
    // `if (idemKey)` regardless of the claim result → this asserted RED; the fix
    // gates the release on `claim === 'won'` (the only request that HOLDS a key).
    expect(H.delSpy).not.toHaveBeenCalled()
  })

  // ── ③ C1: behavioral teeth for the client Idempotency-Key wiring (FOLD A). ──
  it('an explicit Idempotency-Key dedups a VARIED-body retry end-to-end (③ C1 / FOLD A)', async () => {
    primeRequests(2)
    H.safeFetch.mockImplementation(async () => upstream200())
    const hdr = { 'idempotency-key': 'client-key-xyz' }

    const r1 = await callPost(makeReq({ q: 'first' }, hdr))
    expect(r1.status).toBe(200)
    expect(r1.headers.get('X-SettleGrid-Duplicate')).toBeNull()
    expect(consumerDebits()).toBe(1)

    // Same header, DIFFERENT body → the header path (readIdempotencyKeyHeader →
    // chargeIdemKey clientKey) keys on the header, not the body → a duplicate.
    // Delete the `clientKey: readIdempotencyKeyHeader(request)` wiring in route.ts
    // and this retry falls back to the server-derived key (different body →
    // different key) → a 2nd debit → RED. This gives the new public boundary the
    // behavioral teeth it previously lacked.
    const r2 = await callPost(makeReq({ q: 'DIFFERENT' }, hdr))
    expect(r2.headers.get('X-SettleGrid-Duplicate')).toBe('true')
    expect(consumerDebits()).toBe(1) // deduped by the header despite the different body
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 3. Source-scan: the ONE claim precedes the cache check + BOTH forwards, and
//    releases at the no-charge exits (structural cover for all 3 debit sites).
// ────────────────────────────────────────────────────────────────────────────
describe('source: single claim precedes every debiting path (FOLD 1)', () => {
  const src = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8')
  const at = (needle: string) => src.indexOf(needle)

  it('claims the charge before the cache check and before the main forward', () => {
    const claim = at('await claimCharge(')
    // Anchor on the cache-HIT debit site (#1) marker — unique to handleProxy
    // (the substring `getRedis().get(cacheKey)` also appears in the duplicate
    // helper above handleProxy, so it cannot anchor the ordering).
    const cacheHitDebit = at('// Cache HIT — still meter the invocation')
    const mainForward = at('safeFetch(auth.tool.proxyEndpoint')
    expect(claim).toBeGreaterThan(0)
    expect(claim).toBeLessThan(cacheHitDebit)
    expect(claim).toBeLessThan(mainForward)
  })

  it('the claim precedes every SLA-failover INVOCATION (site #6)', () => {
    const claim = at('await claimCharge(')
    // Anchor on the CALL sites (`attemptFailover({…})` at the two invocation points),
    // NOT `safeFetch(fallback.proxyEndpoint` inside the function DEFINITION far below —
    // the definition is always after the claim regardless of runtime flow, so that
    // anchor is toothless. The real invariant: the claim runs before failover is CALLED.
    const firstFailoverCall = at('attemptFailover({')
    const lastFailoverCall = src.lastIndexOf('attemptFailover({')
    expect(firstFailoverCall).toBeGreaterThan(0)
    expect(claim).toBeLessThan(firstFailoverCall)
    expect(claim).toBeLessThan(lastFailoverCall)
  })

  it('releases the claim at no-charge exits ONLY when it was WON (③ F2)', () => {
    // Both releases must be gated on `claimOwned` — a fail-open ('unavailable')
    // request holds no key and must never del one (that would delete a concurrent
    // winner's live claim → double-charge on recovery). A release on merely
    // `if (idemKey)` would re-open ③ F2, so pin the guarded form.
    expect(src).toContain('if (idemKey && claimOwned) await releaseCharge(idemKey)')
    expect(src).toContain('if (idemKey && claimOwned && !upstreamOk) await releaseCharge(idemKey)')
    // And the ungated form must be GONE (it was the ③ F2 defect).
    expect(src).not.toContain('if (idemKey) await releaseCharge(idemKey)')
    // `claimOwned` is set only on a WON claim (never on fail-open 'unavailable').
    expect(src).toContain("if (claim === 'won') claimOwned = true")
  })
})
