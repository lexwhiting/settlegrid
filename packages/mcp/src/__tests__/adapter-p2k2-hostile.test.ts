/**
 * P2.K2 hostile-review regression tests.
 *
 * Each test pins a specific hostile-review finding so regression (e.g. a
 * future refactor that inadvertently re-introduces the throw / timing
 * oracle / wrong status code) surfaces as a test failure rather than a
 * silent production bug.
 *
 * Findings covered:
 *
 *   H1 — L402 dev signing key fallback warns via logger when triggered
 *        (preserves legacy behavior but surfaces misconfiguration).
 *   H2 — DRAIN parseVoucher rejects non-decimal amount strings before
 *        they reach BigInt() downstream.
 *   M1 — x402 validateX402Payment returns X402_PAYLOAD_INVALID (not
 *        X402_FACILITATOR_ERROR) for malformed payment amount strings.
 *   M2 — HMAC signature comparison is timing-safe in L402 / KYAPay /
 *        AP2. (Timing cannot be asserted in vitest under JIT
 *        realistically; we assert the code path that previously used
 *        `===` now uses timingSafeEqual semantics — specifically, that
 *        mismatched-length signatures return "invalid" cleanly instead
 *        of throwing, proving the timingSafeEqual length guard works.)
 */

import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'crypto'
import {
  validateL402Payment,
  generateL402_402Response,
} from '../adapters/l402'
import {
  validateX402Payment,
} from '../adapters/x402'
import {
  validateDrainPayment,
} from '../adapters/drain'
import {
  validateKyaPayPayment,
} from '../adapters/kyapay'
import {
  validateAp2Payment,
} from '../adapters/ap2'
import type { AdapterLogger } from '../adapters/types'

const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test' }
const APP_URL = 'https://settlegrid.test'

function captureLogger(): AdapterLogger & { events: Array<{ level: string; event: string }> } {
  const events: Array<{ level: string; event: string }> = []
  return {
    events,
    info: (event: string) => events.push({ level: 'info', event }),
    warn: (event: string) => events.push({ level: 'warn', event }),
    error: (event: string) => events.push({ level: 'error', event }),
  }
}

// ─── H1 — L402 signing key warn ────────────────────────────────────────────

describe('hostile-review H1 — L402 signing key missing warns', () => {
  it('validateL402Payment logs a warn when enabled=true + signingKey missing', async () => {
    const logger = captureLogger()
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: 'L402 somemacaroon:somepreimage' },
    })
    await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      // signingKey omitted — should trigger the warn
      logger,
    })
    expect(
      logger.events.some(
        (e) => e.level === 'warn' && e.event === 'l402.signing_key_missing_using_dev_fallback',
      ),
    ).toBe(true)
  })

  it('validateL402Payment does NOT warn when signingKey is supplied', async () => {
    const logger = captureLogger()
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: 'L402 somemacaroon:somepreimage' },
    })
    await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: 'real-production-key',
      logger,
    })
    expect(
      logger.events.some(
        (e) => e.event === 'l402.signing_key_missing_using_dev_fallback',
      ),
    ).toBe(false)
  })

  it('generateL402_402Response logs a warn when signingKey missing', async () => {
    const logger = captureLogger()
    await generateL402_402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
      logger,
    })
    expect(
      logger.events.some(
        (e) => e.level === 'warn' && e.event === 'l402.signing_key_missing_using_dev_fallback',
      ),
    ).toBe(true)
  })
})

// ─── H2 — DRAIN amount validation ──────────────────────────────────────────

describe('hostile-review H2 — DRAIN parseVoucher rejects non-decimal amounts', () => {
  const BASE_VOUCHER = {
    channelAddress: '0x' + 'a'.repeat(40),
    payer: '0x' + 'b'.repeat(40),
    amount: '100000',
    nonce: 1,
    expiry: 0,
    signature: '0x' + 'c'.repeat(130),
  }

  const malformedAmounts = [
    'abc',          // letters
    '0x1',          // hex prefix (uint256 is decimal on the wire)
    '1.5',          // fractional
    '-1',           // negative
    '1e6',          // scientific notation
    '1 000',        // whitespace
    ' 100',         // leading whitespace
    '',             // empty string (also caught by truthy check)
    '100abc',       // trailing garbage
  ]

  it.each(malformedAmounts)(
    'rejects voucher with amount=%s as DRAIN_VOUCHER_INVALID (no uncaught throw)',
    async (amount) => {
      const voucher = { ...BASE_VOUCHER, amount }
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-drain-voucher': JSON.stringify(voucher) },
      })
      // This call previously (before H2 fix) could throw SyntaxError from
      // BigInt() deep inside verifyVoucherSignature → computeVoucherHash.
      // Post-fix, parseVoucher rejects the amount and we get a clean result.
      const res = await validateDrainPayment(req, {
        enabled: true,
        toolConfig: TOOL_CONFIG,
      })
      expect(res.valid).toBe(false)
      expect(res.error?.code).toBe('DRAIN_VOUCHER_INVALID')
    },
  )

  it('accepts voucher with amount as non-negative decimal integer string', async () => {
    const voucher = { ...BASE_VOUCHER, amount: '100000' }
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(voucher) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(true)
  })

  it('accepts voucher with amount as non-negative integer number (coerced to string)', async () => {
    const voucher = { ...BASE_VOUCHER, amount: 100000 as unknown as string }
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(voucher) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(true)
  })

  it('rejects voucher with amount as float number', async () => {
    const voucher = { ...BASE_VOUCHER, amount: 1.5 as unknown as string }
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(voucher) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('DRAIN_VOUCHER_INVALID')
  })

  it('rejects voucher with amount as negative number', async () => {
    const voucher = { ...BASE_VOUCHER, amount: -1 as unknown as string }
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(voucher) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('DRAIN_VOUCHER_INVALID')
  })
})

// ─── M1 — x402 payment amount validation + correct error code ──────────────

describe('hostile-review M1 — x402 validateX402Payment rejects malformed amount with PAYLOAD_INVALID', () => {
  function makePayload(amount: unknown, scheme: 'exact' | 'upto' = 'exact'): string {
    const payload =
      scheme === 'exact'
        ? {
            scheme: 'exact',
            network: 'eip155:8453',
            payload: {
              authorization: {
                from: '0x' + 'a'.repeat(40),
                value: amount,
                validAfter: 0,
                validBefore: 0,
              },
              signature: '0x' + 'b'.repeat(130),
            },
          }
        : {
            scheme: 'upto',
            network: 'eip155:8453',
            payload: {
              witness: {
                recipient: '0x' + 'a'.repeat(40),
                amount,
              },
            },
          }
    return Buffer.from(JSON.stringify(payload)).toString('base64')
  }

  it.each(['abc', '0x1', '1.5', '-1', '1e6', '100abc'])(
    'returns X402_PAYLOAD_INVALID (not X402_FACILITATOR_ERROR) for amount=%s (exact)',
    async (amount) => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'payment-signature': makePayload(amount, 'exact') },
      })
      const res = await validateX402Payment(req, {
        enabled: true,
        toolConfig: TOOL_CONFIG,
      })
      expect(res.valid).toBe(false)
      expect(res.error?.code).toBe('X402_PAYLOAD_INVALID')
      // Must NOT surface as facilitator error (the wrong bucket before M1):
      expect(res.error?.code).not.toBe('X402_FACILITATOR_ERROR')
    },
  )

  it('returns X402_PAYLOAD_INVALID for upto scheme with malformed witness.amount', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'payment-signature': makePayload('abc', 'upto') },
    })
    const res = await validateX402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('X402_PAYLOAD_INVALID')
  })

  it('accepts valid decimal amount', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'payment-signature': makePayload('50000', 'exact') },
    })
    const res = await validateX402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(true)
  })
})

// ─── M2 — timing-safe HMAC comparison (L402 / KYAPay / AP2) ────────────────

describe('hostile-review M2 — HMAC comparison handles length mismatch cleanly', () => {
  // The timing-attack resistance itself can't be meaningfully asserted
  // in vitest under JIT, but we CAN pin the side-effect of the fix:
  // mismatched-length signatures no longer crash timingSafeEqual (which
  // throws on unequal buffer lengths); they return false cleanly.

  it('L402: macaroon with truncated signature returns invalid (not uncaught throw)', async () => {
    // Craft a macaroon whose signature field is wrong-length.
    const macaroon = {
      id: 'a'.repeat(32),
      location: 'http://localhost',
      caveats: [{ key: 'service', value: 'settlegrid:test-tool' }],
      signature: 'short', // 5 chars, not 64
    }
    const encoded = Buffer.from(JSON.stringify(macaroon)).toString('base64')
    const preimage = 'a'.repeat(64)
    const req = new Request('http://localhost/api/proxy/test-tool', {
      headers: { authorization: `L402 ${encoded}:${preimage}` },
    })
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: 'some-signing-key',
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_MACAROON_INVALID')
  })

  it('KYAPay: HS256 JWT with truncated signature returns SIGNATURE_INVALID (not throw)', async () => {
    const key = 'test-key'
    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = { sub: 'p', max_spend_cents: 1000 }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signed = `${b64(header)}.${b64(payload)}`
    const realSig = createHmac('sha256', key).update(signed).digest('base64url')
    // Truncate signature to wrong length
    const truncatedJwt = `${signed}.${realSig.slice(0, 10)}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': truncatedJwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: key,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('KYAPAY_SIGNATURE_INVALID')
  })

  it('AP2: VDC JWT with truncated signature returns CREDENTIAL_INVALID (not throw)', async () => {
    const secret = 'test-secret'
    const header = { alg: 'HS256', typ: 'JWT' }
    const claims = {
      iss: 'settlegrid.ai',
      sub: 'consumer',
      aud: 'merchant',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      mandate_type: 'ap2.mandates.PaymentMandate',
      mandate_id: 'm1',
      payment_method: 'card',
      amount_cents: 1000,
      currency: 'usd',
    }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signed = `${b64(header)}.${b64(claims)}`
    const realSig = createHmac('sha256', secret).update(signed).digest('base64url')
    const truncatedJwt = `${signed}.${realSig.slice(0, 10)}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-ap2-credential': truncatedJwt },
    })
    const res = await validateAp2Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingSecret: secret,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('AP2_CREDENTIAL_INVALID')
  })

  it('KYAPay: HS256 JWT with correct signature still accepted (timing-safe path does not break happy flow)', async () => {
    const key = 'test-key'
    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = { sub: 'p', max_spend_cents: 1000 }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signed = `${b64(header)}.${b64(payload)}`
    const sig = createHmac('sha256', key).update(signed).digest('base64url')
    const validJwt = `${signed}.${sig}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': validJwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: key,
    })
    expect(res.valid).toBe(true)
  })
})

// ─── Suppress unused import warning for vi ─────────────────────────────────
void vi
