/**
 * P2.K4 — Lifecycle API stubs: type + throw + delegation tests.
 *
 * The 4 stubs (`beginInvocation`, `settleInvocation`, `voidInvocation`,
 * `heartbeat`) all throw `NOT_IMPLEMENTED — see P3.K1` in Phase 2.
 * The shape + throw-on-call behavior is pinned here so that:
 *
 *   - Consumers can unit-test their integration code against the stubs
 *     (expecting the throw) without waiting for P3.K1.
 *   - P3.K1's implementation begins as a body-only diff — these tests
 *     flip from "must throw" to "must return Invocation / succeed"
 *     when the stubs are replaced.
 *   - Phase 2 gate check 12 (lifecycle.ts presence + exports) stays
 *     PASS as long as the 4 function names are reachable from the
 *     module surface.
 */

import { describe, it, expect } from 'vitest'
import {
  beginInvocation,
  settleInvocation,
  voidInvocation,
  heartbeat,
  LIFECYCLE_NOT_IMPLEMENTED_MSG,
  settlegrid,
} from '../index'
import type {
  BeginInvocationOptions,
  SettleInvocationOptions,
  MeterContext,
  Invocation,
} from '../index'

const EXPECTED_THROW_MSG = 'NOT_IMPLEMENTED — see P3.K1'

const minimalContext: MeterContext = {}

const minimalInvocation: Invocation = {
  id: 'inv-test-1',
  status: 'pending',
  meterContext: minimalContext,
  startedAt: Date.now(),
}

// ─── Module-level stub throws ─────────────────────────────────────────────

describe('lifecycle module — stub throws', () => {
  it('LIFECYCLE_NOT_IMPLEMENTED_MSG matches the expected sentinel', () => {
    expect(LIFECYCLE_NOT_IMPLEMENTED_MSG).toBe(EXPECTED_THROW_MSG)
  })

  it('beginInvocation throws NOT_IMPLEMENTED — see P3.K1', () => {
    expect(() => beginInvocation(minimalContext)).toThrowError(EXPECTED_THROW_MSG)
  })

  it('beginInvocation throws the sentinel even with method + units options', () => {
    const opts: BeginInvocationOptions = { method: 'search', units: 1 }
    expect(() => beginInvocation(minimalContext, opts)).toThrowError(EXPECTED_THROW_MSG)
  })

  it('settleInvocation throws NOT_IMPLEMENTED — see P3.K1', () => {
    expect(() => settleInvocation(minimalInvocation)).toThrowError(EXPECTED_THROW_MSG)
  })

  it('settleInvocation throws the sentinel with costCents override', () => {
    const opts: SettleInvocationOptions = { costCents: 42, metadata: { tag: 'x' } }
    expect(() => settleInvocation(minimalInvocation, opts)).toThrowError(
      EXPECTED_THROW_MSG,
    )
  })

  it('voidInvocation throws NOT_IMPLEMENTED — see P3.K1', () => {
    expect(() => voidInvocation(minimalInvocation)).toThrowError(EXPECTED_THROW_MSG)
  })

  it('voidInvocation throws the sentinel with a reason', () => {
    expect(() => voidInvocation(minimalInvocation, 'user_cancelled')).toThrowError(
      EXPECTED_THROW_MSG,
    )
  })

  it('heartbeat throws NOT_IMPLEMENTED — see P3.K1', () => {
    expect(() => heartbeat(minimalInvocation)).toThrowError(EXPECTED_THROW_MSG)
  })

  it('every thrown error carries a P3.K1 breadcrumb', () => {
    // Ensures consumers reading the error message know where the real
    // implementation is tracked — the ticket anchor is load-bearing.
    const cases: Array<() => void> = [
      () => beginInvocation(minimalContext),
      () => settleInvocation(minimalInvocation),
      () => voidInvocation(minimalInvocation),
      () => heartbeat(minimalInvocation),
    ]
    for (const fn of cases) {
      let caught: unknown
      try {
        fn()
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toContain('P3.K1')
      expect((caught as Error).message).toContain('NOT_IMPLEMENTED')
    }
  })
})

// ─── SettleGridInstance method delegation ─────────────────────────────────

describe('SettleGridInstance — lifecycle method delegation', () => {
  const sg = settlegrid.init({
    toolSlug: 'test-tool',
    pricing: { defaultCostCents: 5 },
  })

  it('exposes beginInvocation / settleInvocation / voidInvocation / heartbeat as methods', () => {
    expect(typeof sg.beginInvocation).toBe('function')
    expect(typeof sg.settleInvocation).toBe('function')
    expect(typeof sg.voidInvocation).toBe('function')
    expect(typeof sg.heartbeat).toBe('function')
  })

  it('sg.beginInvocation throws NOT_IMPLEMENTED (delegates to module stub)', () => {
    expect(() => sg.beginInvocation(minimalContext)).toThrowError(EXPECTED_THROW_MSG)
  })

  it('sg.settleInvocation throws NOT_IMPLEMENTED', () => {
    expect(() => sg.settleInvocation(minimalInvocation)).toThrowError(EXPECTED_THROW_MSG)
  })

  it('sg.voidInvocation throws NOT_IMPLEMENTED', () => {
    expect(() => sg.voidInvocation(minimalInvocation, 'timeout')).toThrowError(
      EXPECTED_THROW_MSG,
    )
  })

  it('sg.heartbeat throws NOT_IMPLEMENTED', () => {
    expect(() => sg.heartbeat(minimalInvocation)).toThrowError(EXPECTED_THROW_MSG)
  })
})

// ─── Type-level exports (compile-time assertions via use-site checks) ────

describe('P2.K4 — type exports are reachable from the public barrel', () => {
  // Each type appears at a use-site below; if any is missing from the
  // public re-export list in `packages/mcp/src/index.ts`, this file
  // fails to compile (pre-test). These runtime assertions just ensure
  // the test file itself executes — the compile-time check is the
  // real tripwire.

  it('MeterContext type accepts an all-optional shape', () => {
    const ctx: MeterContext = {}
    const ctxFull: MeterContext = {
      apiKey: 'sg_live_abc',
      sessionId: 'sess-1',
      maxCostCents: 100,
      metadata: { tag: 'x' },
      headers: { 'x-api-key': 'sg_live_abc' },
      mcpMeta: { 'settlegrid-method': 'search' },
    }
    expect(ctx).toEqual({})
    expect(ctxFull.apiKey).toBe('sg_live_abc')
  })

  it('Invocation type accepts the state-machine shape', () => {
    const inv: Invocation = {
      id: 'inv-1',
      status: 'pending',
      meterContext: {},
      startedAt: Date.now(),
    }
    const invSettled: Invocation = {
      id: 'inv-2',
      status: 'settled',
      meterContext: {},
      startedAt: 1000,
      settledAt: 2000,
      costCents: 5,
    }
    const invFailed: Invocation = {
      id: 'inv-3',
      status: 'failed',
      meterContext: {},
      startedAt: 1000,
      error: { code: 'HANDLER_THREW', message: 'boom' },
    }
    expect(inv.status).toBe('pending')
    expect(invSettled.status).toBe('settled')
    expect(invFailed.status).toBe('failed')
  })

  it('BeginInvocationOptions and SettleInvocationOptions exports are callable', () => {
    const begin: BeginInvocationOptions = { method: 'foo', units: 1 }
    const settle: SettleInvocationOptions = { costCents: 10 }
    expect(begin.method).toBe('foo')
    expect(settle.costCents).toBe(10)
  })
})

// ─── sg.wrap second-arg type accepts MeterContext ─────────────────────────

describe('P2.K4 — sg.wrap second arg accepts MeterContext', () => {
  // Runtime behavior unchanged — middleware still only reads
  // `headers` and `metadata`. This test pins the TYPE-LEVEL contract:
  // a MeterContext-shaped object is accepted without cast.

  it('wrap can be called with a full MeterContext as second arg', async () => {
    const sg = settlegrid.init({
      toolSlug: 'test-tool',
      pricing: { defaultCostCents: 5 },
    })
    const handler = async (args: { q: string }) => ({ out: args.q })
    const wrapped = sg.wrap(handler, { method: 'search' })

    // Pre-P2.K4 context shape still works.
    const ctxLegacy: MeterContext = {
      headers: { 'x-api-key': 'sg_live_test' },
    }
    // New P2.K4 fields accepted by the type system.
    const ctxFull: MeterContext = {
      apiKey: 'sg_live_test',
      sessionId: 'sess-abc',
      maxCostCents: 50,
      metadata: { requestId: 'req-1' },
      headers: { 'x-forwarded-for': '1.2.3.4' },
      mcpMeta: { 'settlegrid-service': 'my-tool' },
    }

    // These don't actually hit the network — the middleware will
    // attempt to validate the key, get an error from the fetch stub,
    // and we catch it. The point is compile-time: both shapes pass
    // the type check.
    await expect(wrapped({ q: 'hello' }, ctxLegacy)).rejects.toBeDefined()
    await expect(wrapped({ q: 'hello' }, ctxFull)).rejects.toBeDefined()
  })
})
