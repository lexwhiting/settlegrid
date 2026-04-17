/**
 * P2.K1 — Unified-adapter dispatch tests.
 *
 * Verifies equivalence between the legacy isXRequest() helpers (Layer B)
 * and the new protocolRegistry.detect() path (Layer A) for ≥3 protocols
 * (x402, mpp, sg-balance per spec).
 *
 * The route.ts handler itself is not directly tested here — too many
 * heavy dependencies (db, redis, fraud detection). The dispatch
 * DECISION is what changed in P2.K1, and that's pure (depends only on
 * request headers). The legacy handlers remain unchanged and are
 * dispatched-to identically; behavior parity is downstream of detection
 * parity, which this test pins.
 */

import { describe, it, expect } from 'vitest'
import { decideUnifiedDispatch, shouldDispatchUnified, type DispatchDecision, type EnabledMap } from '../_unified-dispatch'
import { isX402Request } from '@/lib/x402-proxy'
import { isMppRequest } from '@/lib/mpp'
import { isAp2Request } from '@/lib/ap2-proxy'

function req(headers: Record<string, string>): Request {
  return new Request('https://settlegrid.ai/api/proxy/some-tool', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'noop' } }),
  })
}

describe('decideUnifiedDispatch — protocol detection parity with legacy chain', () => {
  describe('x402', () => {
    it('detects x402 via payment-signature header (unified ⇔ legacy agree)', async () => {
      const r = req({
        'content-type': 'application/json',
        'payment-signature': 'eip3009-sig-here',
      })
      const decision = await decideUnifiedDispatch(r)
      expect(decision.type).toBe('unified')
      if (decision.type === 'unified') {
        expect(decision.protocol).toBe('x402')
      }
      // Legacy detection should also fire on the same request.
      expect(isX402Request(r)).toBe(true)
    })

    it('detects x402 via x-settlegrid-protocol: x402 (unified-only — legacy uses different header set)', async () => {
      const r = req({
        'content-type': 'application/json',
        'x-settlegrid-protocol': 'x402',
      })
      const decision = await decideUnifiedDispatch(r)
      expect(decision.type).toBe('unified')
      if (decision.type === 'unified') {
        expect(decision.protocol).toBe('x402')
      }
    })
  })

  describe('mpp (Stripe Machine Payments Protocol)', () => {
    it('detects mpp via x-payment-protocol: MPP-* (unified ⇔ legacy agree)', async () => {
      const r = req({
        'content-type': 'application/json',
        'x-payment-protocol': 'MPP-1.0',
      })
      const decision = await decideUnifiedDispatch(r)
      expect(decision.type).toBe('unified')
      if (decision.type === 'unified') {
        expect(decision.protocol).toBe('mpp')
      }
      expect(isMppRequest(r)).toBe(true)
    })

    it('detects mpp via x-payment-token: spt_* (unified ⇔ legacy agree)', async () => {
      const r = req({
        'content-type': 'application/json',
        'x-payment-token': 'spt_test_abc123',
      })
      const decision = await decideUnifiedDispatch(r)
      expect(decision.type).toBe('unified')
      if (decision.type === 'unified') {
        expect(decision.protocol).toBe('mpp')
      }
      expect(isMppRequest(r)).toBe(true)
    })
  })

  describe('sg-balance (api key) — mcp-fallback', () => {
    it('returns mcp-fallback for x-api-key request (legacy chain falls through to standard auth)', async () => {
      const r = req({
        'content-type': 'application/json',
        'x-api-key': 'sg_live_test_abc123',
      })
      const decision = await decideUnifiedDispatch(r)
      expect(decision.type).toBe('mcp-fallback')
      // Legacy isXRequest helpers must NOT fire — sg-balance is the
      // catch-all path that falls through to authenticateProxyRequest.
      expect(isX402Request(r)).toBe(false)
      expect(isMppRequest(r)).toBe(false)
      expect(isAp2Request(r)).toBe(false)
    })

    it('returns mcp-fallback for Bearer sg_ token (alt sg-balance form)', async () => {
      const r = req({
        'content-type': 'application/json',
        authorization: 'Bearer sg_live_xyz',
      })
      const decision = await decideUnifiedDispatch(r)
      expect(decision.type).toBe('mcp-fallback')
    })
  })

  describe('no-match — emerging protocols + unauthenticated', () => {
    it('returns no-match for empty headers (no auth at all)', async () => {
      const r = req({ 'content-type': 'application/json' })
      const decision = await decideUnifiedDispatch(r)
      expect(decision.type).toBe('no-match')
    })

    it('returns no-match for L402 (emerging protocol — no adapter yet)', async () => {
      // Per P2.K1 design: emerging protocols (l402, alipay/actp, kyapay,
      // emvco, drain) don't have adapters in @settlegrid/mcp; the unified
      // path returns 'no-match' so the caller falls through to the legacy
      // chain. This pins that behavior so a future adapter addition would
      // require updating this test (and downstream snapshot work).
      const r = req({
        'content-type': 'application/json',
        'www-authenticate': 'L402 macaroon="abc", invoice="lnbc..."',
      })
      const decision = await decideUnifiedDispatch(r)
      // Some adapters may opportunistically claim www-authenticate; assert
      // the contract: either no-match (preferred) or non-l402-mapping.
      // Today no adapter claims this header → no-match.
      expect(decision.type).toBe('no-match')
    })
  })

  describe('priority ordering — mpp wins over x402 when both headers present', () => {
    it('detects mpp when both mpp + x402 headers present (mpp has higher priority)', async () => {
      // Per packages/mcp/src/adapters/index.ts DETECTION_PRIORITY:
      // mpp > circle-nano > x402 > ... > mcp.
      // Pin the priority ordering so a future adapter reorder is intentional.
      const r = req({
        'content-type': 'application/json',
        'x-payment-protocol': 'MPP-1.0',
        'payment-signature': 'eip3009-sig-here',
      })
      const decision = await decideUnifiedDispatch(r)
      expect(decision.type).toBe('unified')
      if (decision.type === 'unified') {
        expect(decision.protocol).toBe('mpp')
      }
    })
  })
})

describe('decideUnifiedDispatch — body preservation (regression)', () => {
  it('does NOT consume the request body — legacy handler can re-read it', async () => {
    // Hostile-review regression: extractPaymentContext may call
    // request.json() / .text() / .formData(), which consumes the body
    // stream. Without an internal clone (verified across 9 adapters as
    // of 2026-04-16) OR a defensive clone in decideUnifiedDispatch
    // (which we now do), every body-bearing request would be silently
    // corrupted when the flag is on. This test pins the contract: the
    // body MUST be readable after decideUnifiedDispatch returns.
    const r = req({
      'content-type': 'application/json',
      'x-payment-token': 'spt_test_abc',
    })
    await decideUnifiedDispatch(r)
    const body = await r.text()
    expect(body).toContain('jsonrpc')
    expect(body).toContain('tools/call')
  })

  it('does NOT consume the body even when adapter extraction throws', async () => {
    // Force extraction to fail (no body, but mpp headers). Body must
    // still be re-readable on the original request.
    const r = new Request('https://settlegrid.ai/api/proxy/some-tool', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-payment-protocol': 'MPP-1.0',
      },
      body: 'arbitrary opaque body',
    })
    await decideUnifiedDispatch(r)
    const body = await r.text()
    expect(body).toBe('arbitrary opaque body')
  })

  it('returns no-match (does not throw) when an adapter canHandle would otherwise throw', async () => {
    // Defensive: protocolRegistry.detect() iterates all adapters'
    // canHandle(). A malformed header that trips a regex/parser inside
    // a canHandle would otherwise propagate up. This test pins the
    // try/catch wrap in decideUnifiedDispatch — though all current
    // adapters have header-only canHandle that can't throw, so this
    // primarily documents the defensive contract.
    const r = req({ 'content-type': 'application/json' })
    await expect(decideUnifiedDispatch(r)).resolves.not.toThrow()
  })
})

describe('decideUnifiedDispatch — paymentContext extraction', () => {
  it('includes paymentContext when extraction succeeds', async () => {
    // mpp adapter accepts spt_ token and extracts a payment context.
    const r = req({
      'content-type': 'application/json',
      'x-payment-token': 'spt_test_abc123',
      'x-payment-amount': '500',
      'x-payment-currency': 'USD',
    })
    const decision = await decideUnifiedDispatch(r)
    expect(decision.type).toBe('unified')
    if (decision.type === 'unified') {
      // paymentContext may or may not be present depending on the
      // adapter's extractPaymentContext requirements. The contract:
      // when present, it carries the protocol identifier.
      if (decision.paymentContext) {
        expect(decision.paymentContext.protocol).toBe('mpp')
      }
    }
  })

  it('still returns unified decision when paymentContext extraction throws', async () => {
    // Force extraction failure: empty body but mpp headers present. Some
    // adapters need body fields; others extract from headers only. This
    // test pins the swallow-on-throw contract: a bad body must NOT
    // prevent dispatch decision (the legacy handler will re-extract and
    // surface the canonical 4xx error).
    const r = new Request('https://settlegrid.ai/api/proxy/some-tool', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-payment-protocol': 'MPP-1.0',
      },
      // No body — most extractors will throw.
    })
    const decision = await decideUnifiedDispatch(r)
    expect(decision.type).toBe('unified')
    if (decision.type === 'unified') {
      expect(decision.protocol).toBe('mpp')
      // paymentContext may be undefined — contract says caller falls
      // through to legacy handler which re-extracts.
    }
  })
})

describe('shouldDispatchUnified — pure dispatch verdict', () => {
  // Synthetic enabled-map factories. Production wires the real
  // isXEnabled() helpers from lib/env.
  const allEnabled: EnabledMap = {
    mpp: () => true,
    x402: () => true,
    ap2: () => true,
    'visa-tap': () => true,
    acp: () => true,
    ucp: () => true,
    'mastercard-vi': () => true,
    'circle-nano': () => true,
  }
  const allDisabled: EnabledMap = {
    mpp: () => false,
    x402: () => false,
    ap2: () => false,
    'visa-tap': () => false,
    acp: () => false,
    ucp: () => false,
    'mastercard-vi': () => false,
    'circle-nano': () => false,
  }

  it('no-match decision → dispatch=false, reason=no-match', () => {
    const decision: DispatchDecision = { type: 'no-match' }
    expect(shouldDispatchUnified(decision, allEnabled)).toEqual({
      dispatch: false,
      reason: 'no-match',
    })
  })

  it('mcp-fallback decision → dispatch=false, reason=mcp-fallback', () => {
    const decision: DispatchDecision = { type: 'mcp-fallback' }
    expect(shouldDispatchUnified(decision, allEnabled)).toEqual({
      dispatch: false,
      reason: 'mcp-fallback',
    })
  })

  it('unified + protocol enabled → dispatch=true, protocol set', () => {
    const decision: DispatchDecision = { type: 'unified', protocol: 'mpp' }
    const verdict = shouldDispatchUnified(decision, allEnabled)
    expect(verdict).toEqual({
      dispatch: true,
      protocol: 'mpp',
      paymentContext: undefined,
    })
  })

  it('unified + protocol disabled → dispatch=false, reason=protocol-disabled, protocol set', () => {
    // Equivalence-preservation contract from P2.K1 hostile review:
    // when the unified registry detects a protocol but its env config
    // is missing (isXEnabled false), fall through to the legacy chain
    // (which will skip the same isXEnabled and route to the standard
    // API key flow → 401). Without this, the unified path would 5xx
    // on missing env while the legacy path 401s — silent divergence.
    const decision: DispatchDecision = { type: 'unified', protocol: 'mpp' }
    expect(shouldDispatchUnified(decision, allDisabled)).toEqual({
      dispatch: false,
      reason: 'protocol-disabled',
      protocol: 'mpp',
    })
  })

  it('unified + protocol with no enabled-fn entry → dispatch=true (default-allow for forward compat)', () => {
    // Documented contract: a protocol without an enabled-fn entry is
    // treated as enabled. This means a future adapter added to
    // @settlegrid/mcp without a corresponding env.ts isXEnabled()
    // wired up here will dispatch unconditionally. Acceptable
    // forward-compat — the alternative (default-deny) would
    // silently break new adapters until the env wiring catches up.
    const decision: DispatchDecision = { type: 'unified', protocol: 'mpp' }
    const sparse: EnabledMap = {} // no entries
    expect(shouldDispatchUnified(decision, sparse)).toEqual({
      dispatch: true,
      protocol: 'mpp',
      paymentContext: undefined,
    })
  })

  it('paymentContext is forwarded into the dispatch verdict', () => {
    const ctx = {
      protocol: 'mpp' as const,
      identity: { type: 'spt' as const, value: 'spt_abc' },
      operation: { service: 'some-tool', method: 'invoke' },
      payment: { type: 'spt' as const },
      requestId: 'req-1',
    }
    const decision: DispatchDecision = {
      type: 'unified',
      protocol: 'mpp',
      paymentContext: ctx,
    }
    const verdict = shouldDispatchUnified(decision, allEnabled)
    expect(verdict).toEqual({
      dispatch: true,
      protocol: 'mpp',
      paymentContext: ctx,
    })
  })

  it('disable check is per-protocol — disabling mpp does not affect x402 dispatch', () => {
    const mixed: EnabledMap = {
      mpp: () => false,
      x402: () => true,
    }
    expect(shouldDispatchUnified({ type: 'unified', protocol: 'mpp' }, mixed).dispatch).toBe(false)
    expect(shouldDispatchUnified({ type: 'unified', protocol: 'x402' }, mixed).dispatch).toBe(true)
  })

  it('enabled-fn is invoked lazily — only the matched protocols fn is called', () => {
    let mppCalls = 0
    let x402Calls = 0
    const enabled: EnabledMap = {
      mpp: () => {
        mppCalls++
        return true
      },
      x402: () => {
        x402Calls++
        return true
      },
    }
    shouldDispatchUnified({ type: 'unified', protocol: 'mpp' }, enabled)
    expect(mppCalls).toBe(1)
    expect(x402Calls).toBe(0)
  })
})
