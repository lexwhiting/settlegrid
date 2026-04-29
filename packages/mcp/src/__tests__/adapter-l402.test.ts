/**
 * L402Adapter tests (P2.K2).
 *
 * Covers the ProtocolAdapter contract (canHandle ±, extractPaymentContext ±,
 * buildChallenge shape) plus the module-level `validateL402Payment` and
 * `generateL402_402Response` entry points. Registry registration is verified
 * in protocol-adapters.test.ts.
 */

import { describe, it, expect } from 'vitest'
import {
  L402Adapter,
  validateL402Payment,
  generateL402_402Response,
} from '../adapters/l402'
import { protocolRegistry } from '../adapters'

const SIGNING_KEY = 'test-l402-signing-key'
const APP_URL = 'https://settlegrid.test'
const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test Tool' }

describe('L402Adapter', () => {
  const adapter = new L402Adapter()

  describe('properties', () => {
    it('has name "l402"', () => {
      expect(adapter.name).toBe('l402')
    })

    it('has displayName', () => {
      expect(adapter.displayName).toContain('L402')
    })
  })

  describe('canHandle', () => {
    it('returns true for Authorization: L402 header', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { authorization: 'L402 abc:def' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for legacy Authorization: LSAT header', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { authorization: 'LSAT abc:def' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-settlegrid-protocol: l402', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-settlegrid-protocol': 'l402' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns false for unrelated requests', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-api-key': 'sg_live_abc' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('throws when Authorization header is missing', async () => {
      const req = new Request('http://localhost/api/proxy/t')
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow(
        /No L402 credentials/,
      )
    })

    it('extracts macaroon id when a minted L402 token is presented', async () => {
      // Mint via generateL402_402Response, then parse the returned L402 header.
      const response = await generateL402_402Response({
        toolSlug: TOOL_CONFIG.slug,
        costCents: TOOL_CONFIG.costCents,
        toolName: TOOL_CONFIG.displayName,
        appUrl: APP_URL,
        signingKey: SIGNING_KEY,
      })
      const wwwAuth = response.headers.get('WWW-Authenticate') ?? ''
      const macaroonMatch = wwwAuth.match(/macaroon="([^"]+)"/)
      expect(macaroonMatch).not.toBeNull()
      const macaroonEncoded = macaroonMatch![1]
      const fakePreimage = 'a'.repeat(64)

      const req = new Request('http://localhost/api/proxy/test-tool', {
        headers: { authorization: `L402 ${macaroonEncoded}:${fakePreimage}` },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('l402')
      expect(ctx.identity.type).toBe('jwt')
      expect(typeof ctx.identity.value).toBe('string')
    })
  })

  describe('buildChallenge', () => {
    it('returns a scheme-l402 entry with costCents and accepted payments', () => {
      const entry = adapter.buildChallenge({
        resource: { url: 'http://localhost/api/proxy/test-tool' },
        pricing: { defaultCostCents: 5 },
        method: 'default',
      })
      expect(entry.scheme).toBe('l402')
      expect(entry.provider).toBe('lightning')
      expect(entry.costCents).toBe(5)
      expect(entry.currency).toBe('btc-lightning')
      expect(entry.acceptedPayments).toEqual(['lightning-invoice'])
    })
  })

  describe('formatError', () => {
    it('returns 401 for macaroon errors', () => {
      const res = adapter.formatError(new Error('Invalid macaroon'), new Request('http://localhost'))
      expect(res.status).toBe(401)
    })

    it('returns 500 for unknown errors', () => {
      const res = adapter.formatError(new Error('random failure'), new Request('http://localhost'))
      expect(res.status).toBe(500)
    })
  })
})

describe('validateL402Payment', () => {
  it('returns L402_NOT_CONFIGURED when enabled=false', async () => {
    const res = await validateL402Payment(new Request('http://localhost/api/proxy/test-tool'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_NOT_CONFIGURED')
  })

  it('returns L402_MACAROON_MISSING when Authorization header is absent', async () => {
    const res = await validateL402Payment(new Request('http://localhost/api/proxy/test-tool'), {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_MACAROON_MISSING')
  })

  it('accepts a valid minted macaroon with a 64-hex preimage', async () => {
    const response = await generateL402_402Response({
      toolSlug: TOOL_CONFIG.slug,
      costCents: TOOL_CONFIG.costCents,
      appUrl: APP_URL,
      signingKey: SIGNING_KEY,
    })
    const wwwAuth = response.headers.get('WWW-Authenticate') ?? ''
    const macaroonEncoded = wwwAuth.match(/macaroon="([^"]+)"/)![1]
    const fakePreimage = 'a'.repeat(64)

    const req = new Request('http://localhost/api/proxy/test-tool', {
      headers: { authorization: `L402 ${macaroonEncoded}:${fakePreimage}` },
    })
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(true)
    expect(res.toolSlug).toBe(TOOL_CONFIG.slug)
  })

  it('rejects a macaroon minted with a different signing key', async () => {
    const response = await generateL402_402Response({
      toolSlug: TOOL_CONFIG.slug,
      costCents: TOOL_CONFIG.costCents,
      appUrl: APP_URL,
      signingKey: 'key-A',
    })
    const macaroonEncoded = response.headers.get('WWW-Authenticate')!.match(/macaroon="([^"]+)"/)![1]
    const fakePreimage = 'a'.repeat(64)

    const req = new Request('http://localhost/api/proxy/test-tool', {
      headers: { authorization: `L402 ${macaroonEncoded}:${fakePreimage}` },
    })
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: 'key-B',
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_MACAROON_INVALID')
  })

  it('rejects a malformed preimage', async () => {
    const response = await generateL402_402Response({
      toolSlug: TOOL_CONFIG.slug,
      costCents: TOOL_CONFIG.costCents,
      appUrl: APP_URL,
      signingKey: SIGNING_KEY,
    })
    const macaroonEncoded = response.headers.get('WWW-Authenticate')!.match(/macaroon="([^"]+)"/)![1]

    const req = new Request('http://localhost/api/proxy/test-tool', {
      headers: { authorization: `L402 ${macaroonEncoded}:not-a-valid-preimage` },
    })
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_PREIMAGE_INVALID')
  })
})

describe('generateL402_402Response', () => {
  it('returns a 402 with WWW-Authenticate header and JSON body', async () => {
    const res = await generateL402_402Response({
      toolSlug: 't',
      costCents: 10,
      appUrl: APP_URL,
      signingKey: SIGNING_KEY,
    })
    expect(res.status).toBe(402)
    const wwwAuth = res.headers.get('WWW-Authenticate') ?? ''
    expect(wwwAuth).toMatch(/^L402 macaroon="/)
    expect(wwwAuth).toContain('invoice="')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('l402')
    expect(body.amount_cents).toBe(10)
    expect(body.currency).toBe('btc-lightning')
    expect(typeof body.macaroon).toBe('string')
  })
})

describe('L402Adapter registry registration', () => {
  it('is registered as "l402" in the singleton registry', () => {
    expect(protocolRegistry.has('l402')).toBe(true)
    expect(protocolRegistry.get('l402')).toBeInstanceOf(L402Adapter)
  })
})
