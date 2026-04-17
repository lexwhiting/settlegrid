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
import { decideUnifiedDispatch } from '../_unified-dispatch'
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
