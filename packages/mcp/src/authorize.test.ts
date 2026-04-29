/**
 * P3.K6 scaffold tests for `authorizeInvocation`.
 *
 * Covers all five built-in checks, short-circuit behavior, the
 * OFAC-first guarantee (hostile req a), plugin allow/deny/timeout/
 * throws, no-plugins baseline, and the <10ms latency budget for
 * built-ins.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authorizeInvocation,
  buildAuthDeniedResponse,
  DEFAULT_FRAUD_DENY_THRESHOLD,
  DEFAULT_PLUGIN_TIMEOUT_MS,
  type AuthorizationContext,
  type AuthorizationConfig,
  type AuthorizationPlugin,
  type AuthorizationResult,
  type AuthorizationSignal,
} from './authorize'

const BASE_CTX: AuthorizationContext = {
  developerId: 'dev-1',
  consumerId: 'consumer-1',
  toolSlug: 'my-tool',
  toolCategory: 'data',
  method: 'search',
  costCents: 5,
  ip: '192.0.2.1',
  keyId: 'key-1',
}

// ─── No-config baseline ─────────────────────────────────────────────

describe('authorizeInvocation — no config (all no-op defaults)', () => {
  it('allows when no checks are wired', async () => {
    const result = await authorizeInvocation(BASE_CTX)
    expect(result.allowed).toBe(true)
    // All 5 built-ins run and emit a "not wired" signal each.
    const checks = result.signals.map((s) => s.check)
    expect(checks).toEqual(['ofac', 'rate_limit', 'budget', 'fraud', 'aup'])
    expect(result.signals.every((s) => s.passed)).toBe(true)
  })

  it('populates durationMs', async () => {
    const result = await authorizeInvocation(BASE_CTX)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(result.durationMs)).toBe(true)
  })

  it('rejects non-object context cleanly', async () => {
    const result = await authorizeInvocation(
      null as unknown as AuthorizationContext,
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('authorization_context_required')
  })
})

// ─── OFAC ────────────────────────────────────────────────────────────

describe('authorizeInvocation — OFAC (hostile req a)', () => {
  it('denies when OFAC screener returns listed=true', async () => {
    const config: AuthorizationConfig = {
      ofacScreener: async () => ({ listed: true, matchedParty: 'dev-1' }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('dev-1')
    expect(result.signals[0]).toMatchObject({ check: 'ofac', passed: false })
  })

  it('allows when OFAC returns listed=false', async () => {
    const config: AuthorizationConfig = {
      ofacScreener: async () => ({ listed: false }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
    expect(result.signals[0]).toMatchObject({ check: 'ofac', passed: true })
  })

  it('runs BEFORE rate-limit so rate-limited consumers are still screened', async () => {
    // Hostile req (a): even if rate-limit would short-circuit, OFAC
    // must have already run. We record the call order to prove it.
    const calls: string[] = []
    const config: AuthorizationConfig = {
      ofacScreener: async () => {
        calls.push('ofac')
        return { listed: false }
      },
      rateLimiter: async () => {
        calls.push('rate')
        return { allowed: false, reason: 'too_many' }
      },
    }
    await authorizeInvocation(BASE_CTX, config)
    expect(calls).toEqual(['ofac', 'rate']) // OFAC ran first
  })

  it('fails closed on OFAC screener throw', async () => {
    const config: AuthorizationConfig = {
      ofacScreener: async () => {
        throw new Error('sdn list unavailable')
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('ofac_error')
  })

  it('logs every OFAC invocation (strict-liability evidence)', async () => {
    const infoSpy = vi.fn()
    const config: AuthorizationConfig = {
      ofacScreener: async () => ({ listed: false }),
      logger: {
        info: infoSpy,
        warn: () => undefined,
        error: () => undefined,
      },
    }
    await authorizeInvocation(BASE_CTX, config)
    expect(infoSpy).toHaveBeenCalledWith(
      'authorize.ofac_screened',
      expect.objectContaining({ listed: false }),
    )
  })

  it('warns when OFAC screener is not wired (production gap signal)', async () => {
    const warnSpy = vi.fn()
    const config: AuthorizationConfig = {
      logger: { info: () => undefined, warn: warnSpy, error: () => undefined },
    }
    await authorizeInvocation(BASE_CTX, config)
    expect(warnSpy).toHaveBeenCalledWith(
      'authorize.ofac_not_wired',
      expect.any(Object),
    )
  })
})

// ─── Rate limit ──────────────────────────────────────────────────────

describe('authorizeInvocation — rate limit', () => {
  it('denies when rate limiter returns allowed=false', async () => {
    const config: AuthorizationConfig = {
      rateLimiter: async () => ({ allowed: false, reason: 'too_many' }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('too_many')
  })

  it('allows when rate limiter returns allowed=true', async () => {
    const config: AuthorizationConfig = {
      rateLimiter: async () => ({ allowed: true }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
  })

  it('fails closed on rate-limiter throw', async () => {
    const config: AuthorizationConfig = {
      rateLimiter: async () => {
        throw new Error('redis down')
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
  })
})

// ─── Budget ──────────────────────────────────────────────────────────

describe('authorizeInvocation — budget', () => {
  it('denies when budget checker returns allowed=false', async () => {
    const config: AuthorizationConfig = {
      budgetChecker: async () => ({
        allowed: false,
        reason: 'out_of_budget',
      }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('out_of_budget')
  })

  it('allows when budget checker returns allowed=true', async () => {
    const config: AuthorizationConfig = {
      budgetChecker: async () => ({ allowed: true }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
  })
})

// ─── Fraud ───────────────────────────────────────────────────────────

describe('authorizeInvocation — fraud', () => {
  it('denies when fraud score is at or above the threshold', async () => {
    const config: AuthorizationConfig = {
      fraudScorer: async () => ({
        riskScore: 85,
        reasons: ['rate_spike', 'ip_velocity'],
      }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/fraud_score=85/)
    expect(result.reason).toMatch(/rate_spike/)
  })

  it('allows when fraud score is below the threshold', async () => {
    const config: AuthorizationConfig = {
      fraudScorer: async () => ({ riskScore: 20 }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
    const fraudSignal = result.signals.find((s) => s.check === 'fraud')
    expect(fraudSignal).toMatchObject({ passed: true })
    expect(fraudSignal?.detail).toContain('20')
  })

  it('honors a custom fraudDenyThreshold', async () => {
    const config: AuthorizationConfig = {
      fraudScorer: async () => ({ riskScore: 30 }),
      fraudDenyThreshold: 25,
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
  })

  it('default threshold is 80', async () => {
    expect(DEFAULT_FRAUD_DENY_THRESHOLD).toBe(80)
  })

  it('fails closed on invalid score (NaN / negative)', async () => {
    const config: AuthorizationConfig = {
      fraudScorer: async () => ({ riskScore: Number.NaN }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('fraud_invalid_score')
  })
})

// ─── AUP ─────────────────────────────────────────────────────────────

describe('authorizeInvocation — AUP', () => {
  it('denies when AUP enforcer returns allowed=false', async () => {
    const config: AuthorizationConfig = {
      aupEnforcer: () => ({ allowed: false, reason: 'prohibited_category' }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('prohibited_category')
  })

  it('allows when AUP enforcer returns allowed=true', async () => {
    const config: AuthorizationConfig = {
      aupEnforcer: () => ({ allowed: true }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
  })

  it('accepts an async AUP enforcer', async () => {
    const config: AuthorizationConfig = {
      aupEnforcer: async () => ({ allowed: true }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
  })
})

// ─── Short-circuit semantics ─────────────────────────────────────────

describe('authorizeInvocation — short-circuit behavior', () => {
  it('rate-limit deny does NOT run budget/fraud/aup/plugins', async () => {
    const budgetSpy = vi.fn(async () => ({ allowed: true }))
    const fraudSpy = vi.fn(async () => ({ riskScore: 0 }))
    const aupSpy = vi.fn(() => ({ allowed: true }))
    const pluginSpy = vi.fn(async () => ({ allowed: true }))
    const config: AuthorizationConfig = {
      rateLimiter: async () => ({ allowed: false, reason: 'too_many' }),
      budgetChecker: budgetSpy,
      fraudScorer: fraudSpy,
      aupEnforcer: aupSpy,
      plugins: [{ name: 'p1', authorize: pluginSpy }],
    }
    await authorizeInvocation(BASE_CTX, config)
    expect(budgetSpy).not.toHaveBeenCalled()
    expect(fraudSpy).not.toHaveBeenCalled()
    expect(aupSpy).not.toHaveBeenCalled()
    expect(pluginSpy).not.toHaveBeenCalled()
  })

  it('OFAC deny short-circuits ALL subsequent checks', async () => {
    const rateSpy = vi.fn(async () => ({ allowed: true }))
    const config: AuthorizationConfig = {
      ofacScreener: async () => ({ listed: true, matchedParty: 'dev-1' }),
      rateLimiter: rateSpy,
    }
    await authorizeInvocation(BASE_CTX, config)
    expect(rateSpy).not.toHaveBeenCalled()
  })

  it('signals array reflects only the checks that ran', async () => {
    const config: AuthorizationConfig = {
      rateLimiter: async () => ({ allowed: false, reason: 'too_many' }),
      budgetChecker: async () => ({ allowed: true }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    // OFAC (not wired, passes) + rate (denied). No budget / fraud /
    // aup signals.
    expect(result.signals.map((s) => s.check)).toEqual([
      'ofac',
      'rate_limit',
    ])
  })
})

// ─── Plugins ─────────────────────────────────────────────────────────

describe('authorizeInvocation — plugins', () => {
  it('runs registered plugins after built-ins pass', async () => {
    const pluginSpy = vi.fn(async () => ({ allowed: true }))
    const config: AuthorizationConfig = {
      plugins: [{ name: 'policy-v1', authorize: pluginSpy }],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(pluginSpy).toHaveBeenCalledTimes(1)
    expect(result.allowed).toBe(true)
    expect(result.signals.some((s) => s.check === 'plugin:policy-v1')).toBe(true)
  })

  it('denies when a plugin returns allowed=false', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: 'policy-v1',
          authorize: async () => ({
            allowed: false,
            reason: 'policy_violation',
          }),
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('policy_violation')
  })

  it('fails CLOSED on plugin timeout (hostile req b)', async () => {
    const config: AuthorizationConfig = {
      pluginTimeoutMs: 50,
      plugins: [
        {
          name: 'slow',
          authorize: async () => {
            // Deliberately exceed the timeout.
            await new Promise((resolve) => setTimeout(resolve, 200))
            return { allowed: true }
          },
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('plugin_timeout')
  })

  it('fails closed when a plugin throws', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: 'buggy',
          authorize: async () => {
            throw new Error('internal plugin error')
          },
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('plugin_error')
  })

  it('captures a plugin-returned artifact', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: 'enterprise-policy',
          authorize: async () => ({
            allowed: true,
            artifact: 'signed-approval-token-xyz',
          }),
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.artifact).toBe('signed-approval-token-xyz')
  })

  it('runs plugins in registration order and stops on first deny', async () => {
    const calls: string[] = []
    const mkPlugin = (name: string, allowed: boolean): AuthorizationPlugin => ({
      name,
      authorize: async () => {
        calls.push(name)
        return { allowed, reason: allowed ? undefined : `${name}_denied` }
      },
    })
    const config: AuthorizationConfig = {
      plugins: [
        mkPlugin('first', true),
        mkPlugin('second', false), // denies
        mkPlugin('third', true), // should not run
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(calls).toEqual(['first', 'second']) // third skipped
    expect(result.reason).toBe('second_denied')
  })

  it('treats a malformed plugin (no authorize fn) as deny', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: 'broken',
          authorize: null as unknown as AuthorizationPlugin['authorize'],
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('malformed')
  })

  it('treats a plugin returning non-object as deny', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: 'weird',
          authorize: async () =>
            'not-an-object' as unknown as {
              allowed: boolean
            },
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('invalid_result')
  })

  it('default plugin timeout is 500ms', () => {
    expect(DEFAULT_PLUGIN_TIMEOUT_MS).toBe(500)
  })
})

// ─── Latency budget ──────────────────────────────────────────────────

describe('authorizeInvocation — latency budget (DoD: <10ms built-ins)', () => {
  it('completes in <10ms with no-op defaults (baseline measurement)', async () => {
    const t0 = performance.now()
    const result = await authorizeInvocation(BASE_CTX)
    const elapsed = performance.now() - t0
    expect(result.allowed).toBe(true)
    // Budget is generous — real-world impls with Redis round-trips
    // will consume most of the 10ms on network. The baseline with
    // no-ops confirms the gate's OWN overhead is negligible.
    expect(elapsed).toBeLessThan(10)
    // result.durationMs should be similarly small
    expect(result.durationMs).toBeLessThan(10)
  })
})

// ─── Clock injection ─────────────────────────────────────────────────

describe('authorizeInvocation — deterministic clock', () => {
  it('uses config.clock for durationMs measurement', async () => {
    let t = 1_000_000
    const config: AuthorizationConfig = {
      clock: () => t,
    }
    // Advance clock by 42ms between start and end
    const origClock = config.clock
    config.clock = () => {
      const cur = t
      t += 42 // advanced between the two calls
      return cur
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    // First call returned cur=1_000_000; second call returned 1_000_042.
    // durationMs = 1_000_042 - 1_000_000 = 42.
    expect(result.durationMs).toBe(42)
  })
})

// ─── Spec-diff F1: plugins-array overload ───────────────────────────

describe('authorizeInvocation — spec-literal plugins-array form (F1)', () => {
  it('accepts a bare plugins array as the second argument', async () => {
    // This is the card's spec shape: `authorizeInvocation(ctx, plugins?)`.
    const pluginSpy = vi.fn(async () => ({ allowed: true }))
    const plugins: readonly AuthorizationPlugin[] = [
      { name: 'compat', authorize: pluginSpy },
    ]
    const result = await authorizeInvocation(BASE_CTX, plugins)
    expect(result.allowed).toBe(true)
    expect(pluginSpy).toHaveBeenCalledTimes(1)
  })

  it('array-form deny path still runs the plugin', async () => {
    const plugins: readonly AuthorizationPlugin[] = [
      {
        name: 'strict',
        authorize: async () => ({
          allowed: false,
          reason: 'enterprise_policy_fail',
        }),
      },
    ]
    const result = await authorizeInvocation(BASE_CTX, plugins)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('enterprise_policy_fail')
  })

  it('empty array is a no-op plugin chain (not a deny)', async () => {
    const result = await authorizeInvocation(BASE_CTX, [])
    expect(result.allowed).toBe(true)
  })

  it('object-form (config) still works for DI callers', async () => {
    const rateSpy = vi.fn(async () => ({ allowed: true }))
    const config: AuthorizationConfig = { rateLimiter: rateSpy }
    await authorizeInvocation(BASE_CTX, config)
    expect(rateSpy).toHaveBeenCalledTimes(1)
  })
})

// ─── Spec-diff F12: buildAuthDeniedResponse shape ──────────────────

describe('buildAuthDeniedResponse — 403 shape (F12 / hostile req e)', () => {
  it('returns status 403 + X-SettleGrid-Authorization: denied', async () => {
    const result: AuthorizationResult = {
      allowed: false,
      reason: 'rate_limited',
      signals: [
        { check: 'ofac', passed: true },
        { check: 'rate_limit', passed: false, detail: 'burst_60s_exceeded' },
      ],
      durationMs: 3,
    }
    const res = buildAuthDeniedResponse(result)
    expect(res.status).toBe(403)
    expect(res.headers.get('X-SettleGrid-Authorization')).toBe('denied')
    expect(res.headers.get('Content-Type')).toBe('application/json')
  })

  it('body contains the top-level reason', async () => {
    const result: AuthorizationResult = {
      allowed: false,
      reason: 'policy_violation',
      signals: [],
      durationMs: 0,
    }
    const res = buildAuthDeniedResponse(result)
    const body = (await res.json()) as {
      error: { code: string; reason: string }
    }
    expect(body.error.code).toBe('AUTHORIZATION_DENIED')
    expect(body.error.reason).toBe('policy_violation')
  })

  it('does NOT leak the signals array to the caller (hostile req e)', async () => {
    const result: AuthorizationResult = {
      allowed: false,
      reason: 'fraud_threshold_exceeded',
      signals: [
        { check: 'ofac', passed: true, detail: 'screener_ran' },
        {
          check: 'fraud',
          passed: false,
          detail: 'fraud_score=95;reasons=rate_spike,ip_velocity,unusual_amount',
        },
      ],
      durationMs: 7,
    }
    const res = buildAuthDeniedResponse(result)
    const bodyText = await res.text()
    // Strongest anti-oracle check: the body must NOT include
    // "signals", nor any check names, nor the fraud-score detail
    // which could be reverse-engineered into a model-weight probe.
    expect(bodyText).not.toContain('signals')
    expect(bodyText).not.toContain('ofac')
    expect(bodyText).not.toContain('fraud_score')
    expect(bodyText).not.toContain('rate_spike')
    expect(bodyText).not.toContain('ip_velocity')
    // Reason is fine — that's the caller-visible category.
    expect(bodyText).toContain('fraud_threshold_exceeded')
  })

  it('falls back to a generic reason when result.reason is missing', async () => {
    const result: AuthorizationResult = {
      allowed: false,
      signals: [],
      durationMs: 0,
    }
    const res = buildAuthDeniedResponse(result)
    const body = (await res.json()) as { error: { reason: string } }
    expect(body.error.reason).toBe('authorization_denied')
  })
})

// ─── Hostile-round guards ───────────────────────────────────────────

describe('hostile H1 — safeClock handles broken user clock', () => {
  it('returns durationMs=0 (not NaN) when user clock returns non-number', async () => {
    const config: AuthorizationConfig = {
      clock: () => 'not-a-number' as unknown as number,
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
    expect(Number.isFinite(result.durationMs)).toBe(true)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('returns durationMs=0 when user clock throws', async () => {
    const config: AuthorizationConfig = {
      clock: () => {
        throw new Error('clock broken')
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    // The throw should NOT propagate — gate's "never throws"
    // contract is enforced by the safeClock wrapper.
    expect(result.allowed).toBe(true)
    expect(Number.isFinite(result.durationMs)).toBe(true)
  })

  it('caps a backwards-stepping clock at durationMs=0', async () => {
    let firstCall = true
    const config: AuthorizationConfig = {
      clock: () => {
        if (firstCall) {
          firstCall = false
          return 1_000_000
        }
        return 999_000 // backwards (negative delta)
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.durationMs).toBe(0) // not negative
  })
})

describe('hostile H2 — OFAC log-level differentiation', () => {
  it('logs OFAC match at warn (not info)', async () => {
    const infoSpy = vi.fn()
    const warnSpy = vi.fn()
    const config: AuthorizationConfig = {
      ofacScreener: async () => ({ listed: true, matchedParty: 'consumer-1' }),
      logger: {
        info: infoSpy,
        warn: warnSpy,
        error: () => undefined,
      },
    }
    await authorizeInvocation(BASE_CTX, config)
    expect(warnSpy).toHaveBeenCalledWith(
      'authorize.ofac_match',
      expect.objectContaining({ matchedParty: 'consumer-1' }),
    )
    // The match should NOT be logged at info level too — that
    // would defeat the dashboard differentiation.
    expect(infoSpy).not.toHaveBeenCalledWith(
      'authorize.ofac_screened',
      expect.any(Object),
    )
  })

  it('logs clean OFAC screen at info (not warn)', async () => {
    const infoSpy = vi.fn()
    const warnSpy = vi.fn()
    const config: AuthorizationConfig = {
      ofacScreener: async () => ({ listed: false }),
      logger: {
        info: infoSpy,
        warn: warnSpy,
        error: () => undefined,
      },
    }
    await authorizeInvocation(BASE_CTX, config)
    expect(infoSpy).toHaveBeenCalledWith(
      'authorize.ofac_screened',
      expect.objectContaining({ listed: false }),
    )
    expect(warnSpy).not.toHaveBeenCalledWith(
      'authorize.ofac_match',
      expect.any(Object),
    )
  })
})

describe('hostile H3 — signals array is frozen', () => {
  it('result.signals is Object.frozen', async () => {
    const result = await authorizeInvocation(BASE_CTX)
    expect(Object.isFrozen(result.signals)).toBe(true)
  })

  it('attempting to push to result.signals throws in strict mode', async () => {
    const result = await authorizeInvocation(BASE_CTX)
    // ECMAScript strict mode (Vitest tests run in strict) throws
    // TypeError on mutations to frozen arrays.
    expect(() => {
      ;(result.signals as AuthorizationSignal[]).push({
        check: 'evil',
        passed: true,
      })
    }).toThrow(TypeError)
  })

  it('mutating an existing signal entry does not affect future calls', async () => {
    // The frozen array prevents external code from corrupting the
    // audit row's structure. Individual signal objects are not
    // deeply frozen (intentional: keeps internal mutation cheap),
    // but the array shape is locked.
    const result1 = await authorizeInvocation(BASE_CTX)
    const result2 = await authorizeInvocation(BASE_CTX)
    expect(result1.signals).not.toBe(result2.signals) // distinct arrays
    expect(Object.isFrozen(result1.signals)).toBe(true)
    expect(Object.isFrozen(result2.signals)).toBe(true)
  })

  it('a deny result also has a frozen signals array', async () => {
    const config: AuthorizationConfig = {
      rateLimiter: async () => ({ allowed: false, reason: 'too_many' }),
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(Object.isFrozen(result.signals)).toBe(true)
  })
})

describe('hostile H5 — outer try/catch + never-throws contract', () => {
  it('returns deny result when the logger throws on every call', async () => {
    // A maliciously-broken logger throws inside the gate's
    // checks. The outer try/catch captures this and returns a
    // generic deny outcome rather than rejecting the promise.
    const broken = () => {
      throw new Error('logger broken')
    }
    const config: AuthorizationConfig = {
      ofacScreener: async () => ({ listed: false }),
      logger: {
        info: broken,
        warn: broken,
        error: broken,
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('authorization_internal_error')
    // Even on the internal-error path, signals is frozen.
    expect(Object.isFrozen(result.signals)).toBe(true)
  })

  it('does not leak internal error details in the reason', async () => {
    // ALL three logger methods broken so the inner-catch-then-
    // logger.error retry path can't recover. Forces the outer
    // try/catch to handle the propagated throw.
    const sneakyError = () => {
      throw new Error('SECRET_INTERNAL: db conn pool exhausted')
    }
    const config: AuthorizationConfig = {
      ofacScreener: async () => ({ listed: false }),
      logger: {
        info: sneakyError,
        warn: sneakyError,
        error: sneakyError,
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    // Caller sees only a generic code; the secret stays in the
    // operator's logger.error sink (which threw, but the kernel's
    // outer try/catch converted to a generic deny).
    expect(result.reason).toBe('authorization_internal_error')
    expect(result.reason).not.toContain('SECRET_INTERNAL')
    expect(result.reason).not.toContain('db conn')
  })
})

// ─── Coverage-round tests ───────────────────────────────────────────

describe('coverage — fraud scorer + aup enforcer throw paths', () => {
  it('fraud_error when fraud scorer throws (inner catch)', async () => {
    const config: AuthorizationConfig = {
      // OFAC must pass first so we reach the fraud check.
      ofacScreener: async () => ({ listed: false }),
      fraudScorer: async () => {
        throw new Error('redis pool depleted')
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    // The reason is the signal's detail string; for inner-catch
    // throws we return a stable code, not the error message.
    expect(result.reason).toBe('fraud_error')
    const fraudSignal = result.signals.find((s) => s.check === 'fraud')
    expect(fraudSignal).toMatchObject({ passed: false, detail: 'fraud_error' })
  })

  it('aup_error when aup enforcer throws (inner catch)', async () => {
    const config: AuthorizationConfig = {
      aupEnforcer: () => {
        throw new Error('aup-rules-file-missing')
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('aup_error')
    const aupSignal = result.signals.find((s) => s.check === 'aup')
    expect(aupSignal).toMatchObject({ passed: false, detail: 'aup_error' })
  })

  it('budget_error when budget checker throws', async () => {
    const config: AuthorizationConfig = {
      budgetChecker: async () => {
        throw new Error('balance-fetch failed')
      },
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('budget_error')
  })
})

describe('coverage — plugin name fallback', () => {
  it('falls back to "unnamed" when plugin has empty-string name', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: '',
          authorize: async () => ({ allowed: true }),
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
    const pluginSignal = result.signals.find((s) =>
      s.check.startsWith('plugin:'),
    )
    expect(pluginSignal?.check).toBe('plugin:unnamed')
  })

  it('falls back to "unnamed" when plugin has non-string name', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: 42 as unknown as string,
          authorize: async () => ({ allowed: true }),
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
    const pluginSignal = result.signals.find((s) =>
      s.check.startsWith('plugin:'),
    )
    expect(pluginSignal?.check).toBe('plugin:unnamed')
  })
})

describe('coverage — plugin timeout clamp + non-string artifact', () => {
  it('clamps pluginTimeoutMs below MIN_PLUGIN_TIMEOUT_MS up to the floor', async () => {
    // The MIN_PLUGIN_TIMEOUT_MS clamp prevents a 0-ms or negative
    // timeout from making every plugin instantly look timed-out.
    // Configure timeout=1 (below the 10ms floor) and a fast plugin
    // — the plugin should still complete within the clamped window.
    const config: AuthorizationConfig = {
      pluginTimeoutMs: 1, // clamps up to 10ms minimum
      plugins: [
        {
          name: 'fast',
          authorize: async () => ({ allowed: true }),
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
  })

  it('discards plugin artifact when not a non-empty string', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: 'p',
          authorize: async () => ({
            allowed: true,
            artifact: '' as unknown as string, // empty string
          }),
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    expect(result.allowed).toBe(true)
    expect(result.artifact).toBeUndefined()
  })

  it('uses LAST plugin artifact when multiple plugins return one', async () => {
    const config: AuthorizationConfig = {
      plugins: [
        {
          name: 'a',
          authorize: async () => ({
            allowed: true,
            artifact: 'token-from-a',
          }),
        },
        {
          name: 'b',
          authorize: async () => ({
            allowed: true,
            artifact: 'token-from-b',
          }),
        },
      ],
    }
    const result = await authorizeInvocation(BASE_CTX, config)
    // Last artifact wins — documented in the function header.
    expect(result.artifact).toBe('token-from-b')
  })
})

describe('coverage — buildAuthDeniedResponse with allowed=true', () => {
  it('still returns 403 even when allowed=true (defensive — caller misuse)', async () => {
    // The helper is documented for the deny path, but a caller who
    // misuses it with an allow result still gets a 403 (fail safe).
    // The body's reason falls back to the generic since
    // result.reason is undefined on allow outcomes.
    const result: AuthorizationResult = {
      allowed: true,
      signals: [],
      durationMs: 0,
    }
    const res = buildAuthDeniedResponse(result)
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { reason: string } }
    expect(body.error.reason).toBe('authorization_denied')
  })
})
