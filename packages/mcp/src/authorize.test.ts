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
  DEFAULT_FRAUD_DENY_THRESHOLD,
  DEFAULT_PLUGIN_TIMEOUT_MS,
  type AuthorizationContext,
  type AuthorizationConfig,
  type AuthorizationPlugin,
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
