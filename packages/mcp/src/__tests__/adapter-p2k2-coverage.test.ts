/**
 * P2.K2 coverage fill — targets code paths in the migrated adapter files
 * that the scaffold + spec-diff + hostile passes left uncovered.
 *
 * Priorities (high → low):
 *   1. Module-level isXRequest() helpers for the 8 existing non-MCP adapters
 *      (mpp, x402, ap2, visa-tap, acp, ucp, mastercard-vi, circle-nano).
 *      Each has a separate implementation from the class's canHandle()
 *      (different Bearer-matching semantics, header-prefix checks) and is
 *      part of the legacy detection contract — bugs here cause the
 *      legacy chain and the unified chain to dispatch to different
 *      handlers, which P2.K3's snapshot test will surface but should
 *      be caught earlier.
 *   2. 402-response body field shape per protocol — the adapter-p2k2-
 *      methods.test.ts contract test only checks status + protocol
 *      header; the body fields (amount_cents, accepted_tokens,
 *      directory_url, etc.) are part of the HTTP-wire contract and
 *      clients parse them.
 *   3. L402 macaroon edge cases: undeserializable, expired, wrong-service.
 *   4. DRAIN voucher edge cases: base64 voucher, missing fields.
 *   5. KYAPay RS256 path (existing tests only cover HS256).
 *   6. Extract-helper fallback paths (Bearer-prefix token extraction).
 */

import { describe, it, expect } from 'vitest'
import { createHmac, createSign, generateKeyPairSync } from 'crypto'
import {
  isMppRequest,
  validateMppPayment,
  generateMpp402Response,
  MPPAdapter,
} from '../adapters/mpp'
import {
  isX402Request,
  generateX402_402Response,
} from '../adapters/x402'
import {
  isAp2Request,
  validateAp2Payment,
  generateAp2_402Response,
} from '../adapters/ap2'
import {
  isVisaTapRequest,
  generateVisaTap402Response,
} from '../adapters/tap'
import {
  isAcpRequest,
  generateAcp402Response,
} from '../adapters/acp'
import {
  isUcpRequest,
  validateUcpPayment,
  generateUcp402Response,
} from '../adapters/ucp'
import {
  isMastercardRequest,
  validateMastercardPayment,
  generateMastercard402Response,
} from '../adapters/mastercard-vi'
import {
  isCircleNanoRequest,
  validateCircleNanoPayment,
  generateCircleNano402Response,
} from '../adapters/circle-nano'
import {
  L402Adapter,
  validateL402Payment,
  generateL402_402Response,
} from '../adapters/l402'
import {
  validateKyaPayPayment,
  generateKyaPay402Response,
} from '../adapters/kyapay'
import {
  AlipayAdapter,
  generateAlipay402Response,
} from '../adapters/alipay'
import {
  generateEmvco402Response,
  EMVCO_NETWORKS,
} from '../adapters/emvco'
import {
  DrainAdapter,
  validateDrainPayment,
  generateDrain402Response,
} from '../adapters/drain'

const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test' }
const APP_URL = 'https://settlegrid.test'

// ─── Section 1 — Module-level is<X>Request() helpers, header matrix ────────

describe('coverage — isMppRequest header matrix', () => {
  it.each([
    ['X-Payment-Protocol MPP/1.0', { 'x-payment-protocol': 'MPP/1.0' }, true],
    ['X-Payment-Protocol MPP', { 'x-payment-protocol': 'MPP' }, true],
    ['X-Payment-Protocol OTHER', { 'x-payment-protocol': 'OTHER/1.0' }, false],
    ['X-Payment-Token spt_', { 'x-payment-token': 'spt_abc' }, true],
    ['X-Payment-Token mpp_', { 'x-payment-token': 'mpp_abc' }, true],
    ['X-Payment-Token foo_', { 'x-payment-token': 'foo_abc' }, false],
    ['Bearer spt_', { authorization: 'Bearer spt_abc' }, true],
    ['Bearer mpp_', { authorization: 'Bearer mpp_abc' }, true],
    ['Bearer sg_', { authorization: 'Bearer sg_abc' }, false],
    ['x-mpp-credential', { 'x-mpp-credential': 'whatever' }, true],
    ['bare request', {}, false],
  ])('%s → %s', (_label, headers, expected) => {
    const req = new Request('http://localhost/api/proxy/t', { headers })
    expect(isMppRequest(req)).toBe(expected)
  })
})

describe('coverage — isX402Request header matrix', () => {
  it.each([
    ['X-Payment', { 'x-payment': 'base64payload' }, true],
    ['payment-signature', { 'payment-signature': 'base64payload' }, true],
    ['x-settlegrid-protocol: x402', { 'x-settlegrid-protocol': 'x402' }, true],
    ['Bearer x402_', { authorization: 'Bearer x402_abc' }, true],
    ['Bearer other', { authorization: 'Bearer other' }, false],
    ['bare request', {}, false],
  ])('%s → %s', (_label, headers, expected) => {
    const req = new Request('http://localhost/api/proxy/t', { headers })
    expect(isX402Request(req)).toBe(expected)
  })
})

describe('coverage — isAp2Request header matrix', () => {
  it.each([
    ['x-ap2-credential', { 'x-ap2-credential': 'jwt-abc' }, true],
    ['x-ap2-mandate', { 'x-ap2-mandate': 'mandate-abc' }, true],
    ['x-settlegrid-protocol: ap2', { 'x-settlegrid-protocol': 'ap2' }, true],
    ['Bearer ap2_', { authorization: 'Bearer ap2_abc' }, true],
    ['Bearer other', { authorization: 'Bearer other' }, false],
    ['bare request', {}, false],
  ])('%s → %s', (_label, headers, expected) => {
    const req = new Request('http://localhost/api/proxy/t', { headers })
    expect(isAp2Request(req)).toBe(expected)
  })
})

describe('coverage — isVisaTapRequest header matrix', () => {
  it.each([
    ['x-visa-agent-token', { 'x-visa-agent-token': 'vtap_abc' }, true],
    ['x-settlegrid-protocol: visa-tap', { 'x-settlegrid-protocol': 'visa-tap' }, true],
    ['Bearer vtap_', { authorization: 'Bearer vtap_abc' }, true],
    ['Bearer other', { authorization: 'Bearer sg_abc' }, false],
    ['bare request', {}, false],
  ])('%s → %s', (_label, headers, expected) => {
    const req = new Request('http://localhost/api/proxy/t', { headers })
    expect(isVisaTapRequest(req)).toBe(expected)
  })
})

describe('coverage — isAcpRequest header matrix', () => {
  it.each([
    ['x-acp-token', { 'x-acp-token': 'acp-abc' }, true],
    ['x-acp-session-id', { 'x-acp-session-id': 'cs_abc' }, true],
    ['x-settlegrid-protocol: acp', { 'x-settlegrid-protocol': 'acp' }, true],
    ['Bearer acp_', { authorization: 'Bearer acp_abc' }, true],
    ['Bearer other', { authorization: 'Bearer other' }, false],
    ['bare request', {}, false],
  ])('%s → %s', (_label, headers, expected) => {
    const req = new Request('http://localhost/api/proxy/t', { headers })
    expect(isAcpRequest(req)).toBe(expected)
  })
})

describe('coverage — isUcpRequest header matrix', () => {
  it.each([
    ['x-ucp-session', { 'x-ucp-session': 'ucp-sess-abc' }, true],
    ['x-settlegrid-protocol: ucp', { 'x-settlegrid-protocol': 'ucp' }, true],
    ['Bearer ucp_', { authorization: 'Bearer ucp_abc' }, true],
    ['Bearer other', { authorization: 'Bearer other' }, false],
    ['bare request', {}, false],
  ])('%s → %s', (_label, headers, expected) => {
    const req = new Request('http://localhost/api/proxy/t', { headers })
    expect(isUcpRequest(req)).toBe(expected)
  })
})

describe('coverage — isMastercardRequest header matrix', () => {
  it.each([
    ['x-mc-verifiable-intent', { 'x-mc-verifiable-intent': 'sd-jwt-abc' }, true],
    ['x-settlegrid-protocol: mastercard-vi', { 'x-settlegrid-protocol': 'mastercard-vi' }, true],
    ['Bearer mcvi_', { authorization: 'Bearer mcvi_abc' }, true],
    ['Bearer other', { authorization: 'Bearer other' }, false],
    ['bare request', {}, false],
  ])('%s → %s', (_label, headers, expected) => {
    const req = new Request('http://localhost/api/proxy/t', { headers })
    expect(isMastercardRequest(req)).toBe(expected)
  })
})

describe('coverage — isCircleNanoRequest header matrix', () => {
  it.each([
    ['x-circle-nano-auth', { 'x-circle-nano-auth': 'nano-auth-abc' }, true],
    ['x-settlegrid-protocol: circle-nano', { 'x-settlegrid-protocol': 'circle-nano' }, true],
    ['Bearer cnano_', { authorization: 'Bearer cnano_abc' }, true],
    ['Bearer other', { authorization: 'Bearer other' }, false],
    ['bare request', {}, false],
  ])('%s → %s', (_label, headers, expected) => {
    const req = new Request('http://localhost/api/proxy/t', { headers })
    expect(isCircleNanoRequest(req)).toBe(expected)
  })
})

// ─── Section 2 — 402 response body field shape per protocol ────────────────

describe('coverage — 402 body field shapes', () => {
  it('MPP body includes protocol, amount, currency, accepted_tokens, directory_url', async () => {
    const res = generateMpp402Response({
      toolSlug: 'my-tool',
      costCents: 100,
      toolName: 'My Tool',
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('mpp')
    expect(body.amount).toBe(100)
    expect(body.currency).toBe('usd')
    expect(body.accepted_tokens).toEqual(['spt'])
    expect(body.directory_url).toBe(`${APP_URL}/api/v1/discover`)
    expect(body.payment_endpoint).toBe(`${APP_URL}/api/proxy/my-tool`)
    expect(typeof body.instructions).toBe('string')
    // Header assertions
    expect(res.headers.get('X-Payment-Protocol')).toBe('MPP/1.0')
    expect(res.headers.get('X-Payment-Amount')).toBe('100')
  })

  it('x402 body includes x402Version=2, accepts array with the EXACT scheme only (v1: upto not advertised)', async () => {
    const res = generateX402_402Response({
      toolSlug: 'my-tool',
      costCents: 50,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.x402Version).toBe(2)
    expect(body.error).toBe('payment_required')
    const accepts = body.accepts as Array<Record<string, unknown>>
    // v1 advertises EXACT only — the proxy settles exact (EIP-3009) on-chain and
    // rejects upto (Permit2 needs a separate engine). See generateX402_402Response.
    expect(accepts).toHaveLength(1)
    expect(accepts[0].scheme).toBe('exact')
    expect(accepts.some((a) => a.scheme === 'upto')).toBe(false)
    // Amount = 50 cents * 10_000 = 500_000 USDC base units
    expect(accepts[0].amount).toBe('500000')
    expect(accepts[0].maxTimeoutSeconds).toBe(300)
  })

  it('AP2 body includes mandate_types, accepted_credential_types, available_skills', async () => {
    const res = generateAp2_402Response({
      toolSlug: 'my-tool',
      costCents: 25,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('ap2')
    expect(body.amount_cents).toBe(25)
    expect(body.merchant_id).toBe('settlegrid_platform')
    expect(body.accepted_credential_types).toEqual(['vdc_jwt'])
    expect(body.mandate_types).toContain('ap2.mandates.IntentMandate')
    expect(body.mandate_types).toContain('ap2.mandates.PaymentMandate')
    expect(Array.isArray(body.available_skills)).toBe(true)
  })

  it('Visa TAP body includes token_requirements + token_provision_url', async () => {
    const res = generateVisaTap402Response({
      toolSlug: 'my-tool',
      costCents: 75,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('visa-tap')
    expect(body.accepted_tokens).toEqual(['visa_agent_token'])
    const tokenReqs = body.token_requirements as Record<string, unknown>
    expect(tokenReqs.min_transaction_limit_cents).toBe(75)
    expect(tokenReqs.required_attestation).toBe(true)
    expect(body.token_provision_url).toBe(`${APP_URL}/api/visa-tap/provision`)
  })

  it('ACP body includes checkout url, params, accepted_tokens, network', async () => {
    const res = generateAcp402Response({
      toolSlug: 'my-tool',
      costCents: 10,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('acp')
    expect(body.network).toBe('stripe')
    const checkout = body.checkout as Record<string, unknown>
    expect(checkout.url).toBe(`${APP_URL}/api/acp/checkout`)
    expect(checkout.method).toBe('POST')
    expect(body.accepted_tokens).toEqual(['acp_checkout_session'])
  })

  it('UCP body includes create_session_url + supported_payment_handlers', async () => {
    const res = generateUcp402Response({
      toolSlug: 'my-tool',
      costCents: 15,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('ucp')
    const checkout = body.checkout as Record<string, unknown>
    expect(checkout.create_session_url).toBe(`${APP_URL}/api/ucp/sessions`)
    expect(checkout.supported_payment_handlers).toEqual(['google-pay', 'shop-pay', 'stripe'])
  })

  it('Mastercard VI body includes credential_requirements with 3-layer delegation chain', async () => {
    const res = generateMastercard402Response({
      toolSlug: 'my-tool',
      costCents: 20,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('mastercard-vi')
    expect(body.accepted_credentials).toEqual(['sd-jwt-verifiable-intent'])
    const credReqs = body.credential_requirements as Record<string, unknown>
    expect(credReqs.delegation_chain).toEqual(['credential-provider', 'user', 'agent'])
    expect(credReqs.signature_algorithm).toBe('ES256')
  })

  it('Circle Nano body includes amount_usdc_base_units + on-chain settlement', async () => {
    const res = generateCircleNano402Response({
      toolSlug: 'my-tool',
      costCents: 5,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('circle-nano')
    expect(body.amount_usdc_base_units).toBe('50000')
    expect(body.accepted_payments).toEqual(['eip3009-nanopayment'])
    const settlement = body.settlement as Record<string, unknown>
    expect(settlement.type).toBe('on-chain')
  })

  it('Circle Nano body OMITS discovery fields + names no payee when none supplied (B1.1 backward-compat)', async () => {
    const res = generateCircleNano402Response({
      toolSlug: 'my-tool',
      costCents: 5,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.pay_to).toBeUndefined()
    const settlement = body.settlement as Record<string, unknown>
    expect(settlement.asset_address).toBeUndefined()
    expect(settlement.eip712_domain).toBeUndefined()
    // Must not advertise a payee/contract it can't honor.
    expect(String(body.instructions)).not.toMatch(/0x[0-9a-fA-F]{40}/)
  })

  it('Circle Nano body surfaces pay_to + asset_address + eip712_domain when discovery supplied (B1.1)', async () => {
    const recipient = '0x0859cF704798619133241A385220D6797C635c95'
    const assetAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    const res = generateCircleNano402Response({
      toolSlug: 'my-tool',
      costCents: 5,
      appUrl: APP_URL,
      network: 'eip155:8453',
      recipient,
      assetAddress,
      assetDomain: { name: 'USD Coin', version: '2', chainId: 8453 },
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.pay_to).toBe(recipient)
    const settlement = body.settlement as Record<string, unknown>
    expect(settlement.network).toBe('eip155:8453')
    expect(settlement.asset_address).toBe(assetAddress)
    expect(settlement.eip712_domain).toEqual({
      name: 'USD Coin',
      version: '2',
      chain_id: 8453,
      verifying_contract: assetAddress,
    })
    // verifying_contract MUST equal asset_address (same source constant — no drift).
    const domain = settlement.eip712_domain as Record<string, unknown>
    expect(domain.verifying_contract).toBe(settlement.asset_address)
    // Instructions name the payee + token so a payer can follow them directly.
    expect(String(body.instructions)).toContain(recipient)
    expect(String(body.instructions)).toContain(assetAddress)
  })

  it('Circle Nano discovery is all-or-nothing — a recipient without the asset/domain advertises nothing (B1.1)', async () => {
    const res = generateCircleNano402Response({
      toolSlug: 'my-tool',
      costCents: 5,
      appUrl: APP_URL,
      recipient: '0x0859cF704798619133241A385220D6797C635c95',
      // assetAddress + assetDomain intentionally omitted
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.pay_to).toBeUndefined()
    const settlement = body.settlement as Record<string, unknown>
    expect(settlement.asset_address).toBeUndefined()
    expect(settlement.eip712_domain).toBeUndefined()
  })

  it('L402 body includes macaroon, invoice, r_hash, expires_in_seconds', async () => {
    const res = await generateL402_402Response({
      toolSlug: 'my-tool',
      costCents: 50,
      appUrl: APP_URL,
      signingKey: 'test-key',
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('l402')
    expect(typeof body.macaroon).toBe('string')
    expect(typeof body.invoice).toBe('string')
    expect(typeof body.r_hash).toBe('string')
    expect(typeof body.macaroon_id).toBe('string')
    expect(body.expires_in_seconds).toBe(3600)
    expect(body.currency).toBe('btc-lightning')
  })

  it('Alipay body includes amount_cny_fen + supported_methods', async () => {
    const res = generateAlipay402Response({
      toolSlug: 'my-tool',
      costCents: 100,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('alipay-trust')
    expect(body.amount_cents).toBe(100)
    expect(body.amount_cny_fen).toBe(Math.ceil(100 * 7.2))
    expect(body.currencies).toEqual(['USD', 'CNY'])
    const settlement = body.settlement as Record<string, unknown>
    expect(settlement.supported_methods).toEqual(['balance', 'credit', 'huabei'])
  })

  it('KYAPay body includes authentication.algorithms HS256/RS256', async () => {
    const res = generateKyaPay402Response({
      toolSlug: 'my-tool',
      costCents: 30,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('kyapay')
    const auth = body.authentication as Record<string, unknown>
    expect(auth.algorithms).toEqual(['HS256', 'RS256'])
    expect(auth.required_claims).toContain('sub')
    expect(auth.required_claims).toContain('max_spend_cents')
  })

  it('EMVCo body includes all 6 supported_networks + 3DS authentication', async () => {
    const res = generateEmvco402Response({
      toolSlug: 'my-tool',
      costCents: 25,
      appUrl: APP_URL,
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('emvco')
    expect(body.supported_networks).toEqual([...EMVCO_NETWORKS])
    const auth = body.authentication as Record<string, unknown>
    expect(auth.type).toBe('3d-secure')
    expect(auth.agent_initiated).toBe(true)
    const tok = body.tokenisation as Record<string, unknown>
    expect(tok.supports_cryptogram).toBe(true)
  })

  it('DRAIN body includes eip712 domain/types + channel network=polygon', async () => {
    const res = generateDrain402Response({
      toolSlug: 'my-tool',
      costCents: 5,
      appUrl: APP_URL,
      channelAddress: '0x' + 'a'.repeat(40),
    })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('drain')
    const channel = body.channel as Record<string, unknown>
    expect(channel.network).toBe('polygon')
    expect(channel.chain_id).toBe(137)
    const eip712 = body.eip712 as Record<string, unknown>
    const domain = eip712.domain as Record<string, unknown>
    expect(domain.name).toBe('DRAIN')
    expect(domain.version).toBe('1')
    expect(domain.chainId).toBe(137)
  })
})

// ─── Section 3 — L402 macaroon edge cases ───────────────────────────────────

describe('coverage — L402 macaroon edge cases', () => {
  const SIGNING_KEY = 'test-signing-key'
  const validPreimage = 'a'.repeat(64)

  function makeReq(macaroonEncoded: string, preimage: string = validPreimage) {
    return new Request('http://localhost/api/proxy/test-tool', {
      headers: { authorization: `L402 ${macaroonEncoded}:${preimage}` },
    })
  }

  it('rejects macaroon that is not valid base64 JSON', async () => {
    const req = makeReq('not-base64-!!!')
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_MACAROON_INVALID')
  })

  it('rejects macaroon missing required fields (no signature)', async () => {
    const macaroonNoSig = {
      id: 'a'.repeat(32),
      location: 'http://localhost',
      caveats: [],
      // signature missing
    }
    const encoded = Buffer.from(JSON.stringify(macaroonNoSig)).toString('base64')
    const req = makeReq(encoded)
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_MACAROON_INVALID')
  })

  it('rejects macaroon whose caveats is not an array', async () => {
    const badMacaroon = {
      id: 'a'.repeat(32),
      location: 'http://localhost',
      caveats: 'not-an-array',
      signature: 'a'.repeat(64),
    }
    const encoded = Buffer.from(JSON.stringify(badMacaroon)).toString('base64')
    const req = makeReq(encoded)
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_MACAROON_INVALID')
  })

  it('rejects Authorization header without colon separator', async () => {
    const req = new Request('http://localhost/api/proxy/test-tool', {
      headers: { authorization: 'L402 nocolon-just-macaroon' },
    })
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_MACAROON_MISSING')
  })

  it('accepts legacy LSAT prefix in Authorization header', async () => {
    // Mint a macaroon using generate402, then present with LSAT (not L402) prefix
    const mint = await generateL402_402Response({
      toolSlug: TOOL_CONFIG.slug,
      costCents: TOOL_CONFIG.costCents,
      appUrl: APP_URL,
      signingKey: SIGNING_KEY,
    })
    const macaroonEncoded = mint.headers.get('WWW-Authenticate')!.match(/macaroon="([^"]+)"/)![1]
    const req = new Request('http://localhost/api/proxy/test-tool', {
      headers: { authorization: `LSAT ${macaroonEncoded}:${validPreimage}` },
    })
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(true)
  })

  it('rejects macaroon whose service caveat is for a different tool', async () => {
    // Mint a macaroon for 'tool-a', present it when 'tool-b' is requested
    const mint = await generateL402_402Response({
      toolSlug: 'tool-a',
      costCents: 5,
      appUrl: APP_URL,
      signingKey: SIGNING_KEY,
    })
    const macaroonEncoded = mint.headers.get('WWW-Authenticate')!.match(/macaroon="([^"]+)"/)![1]
    const req = new Request('http://localhost/api/proxy/tool-b', {
      headers: { authorization: `L402 ${macaroonEncoded}:${validPreimage}` },
    })
    const res = await validateL402Payment(req, {
      enabled: true,
      toolConfig: { slug: 'tool-b', costCents: 5, displayName: 'Tool B' },
      signingKey: SIGNING_KEY,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('L402_MACAROON_INVALID')
  })

  it('L402Adapter.extractPaymentContext throws when credentials missing', async () => {
    const adapter = new L402Adapter()
    const req = new Request('http://localhost/api/proxy/t')
    await expect(adapter.extractPaymentContext(req)).rejects.toThrow(/No L402 credentials/)
  })

  it('L402Adapter.extractPaymentContext handles undeserializable macaroon gracefully', async () => {
    const adapter = new L402Adapter()
    // Authorization present but macaroon is malformed — we expect the
    // extracted context to be produced with placeholder values, not throw.
    const req = new Request('http://localhost/api/proxy/test-tool', {
      headers: { authorization: 'L402 notbase64:abcdef' },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.protocol).toBe('l402')
    expect(ctx.identity.value).toBe('unknown')
  })
})

// ─── Section 4 — DRAIN voucher edge cases ──────────────────────────────────

describe('coverage — DRAIN voucher edge cases', () => {
  const CHANNEL = '0x' + 'a'.repeat(40)
  const PAYER = '0x' + 'b'.repeat(40)
  const VALID_SIG = '0x' + 'c'.repeat(130)

  function makeVoucher(overrides: Record<string, unknown> = {}) {
    return {
      channelAddress: CHANNEL,
      payer: PAYER,
      amount: '100000',
      nonce: 1,
      expiry: 0,
      signature: VALID_SIG,
      ...overrides,
    }
  }

  it('accepts a base64-encoded voucher', async () => {
    const base64Voucher = Buffer.from(JSON.stringify(makeVoucher())).toString('base64')
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': base64Voucher },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(true)
  })

  it('accepts snake_case channel_address field (alternate JSON schema)', async () => {
    const voucher = {
      channel_address: CHANNEL, // snake_case
      payer: PAYER,
      amount: '100000',
      nonce: 1,
      expiry: 0,
      signature: VALID_SIG,
    }
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(voucher) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(true)
  })

  it.each([
    ['missing channelAddress', { channelAddress: '' }],
    ['missing payer', { payer: '' }],
    ['missing signature', { signature: '' }],
    ['non-integer nonce (NaN)', { nonce: 'abc' as unknown as number }],
  ])('rejects voucher with %s as DRAIN_VOUCHER_INVALID', async (_label, overrides) => {
    const voucher = makeVoucher(overrides)
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

  it('rejects signature with non-hex characters (even if correct length)', async () => {
    const voucher = makeVoucher({ signature: '0x' + 'z'.repeat(130) })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(voucher) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('DRAIN_SIGNATURE_INVALID')
  })

  it('DrainAdapter.extractPaymentContext handles missing voucher header', async () => {
    const adapter = new DrainAdapter()
    const req = new Request('http://localhost/api/proxy/t')
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.protocol).toBe('drain')
    expect(ctx.identity.value).toBe('unknown')
    expect(ctx.payment.proof).toBeUndefined()
  })
})

// ─── Section 5 — KYAPay RS256 + edge cases ─────────────────────────────────

describe('coverage — KYAPay RS256 signature verification', () => {
  it('accepts a valid RS256-signed JWT', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = { sub: 'p1', jti: 'jti-1', max_spend_cents: 1000 }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signedContent = `${b64(header)}.${b64(payload)}`
    const signer = createSign('RSA-SHA256')
    signer.update(signedContent)
    const signature = signer.sign(privateKey, 'base64url')
    const jwt = `${signedContent}.${signature}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: publicKey,
    })
    expect(res.valid).toBe(true)
    expect(res.tokenId).toBe('jti-1')
  })

  it('rejects RS256 JWT when verification key is not a valid PEM', async () => {
    // Mint a valid RS256 JWT, but verify with HMAC-style key
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = { sub: 'p', max_spend_cents: 1000 }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signedContent = `${b64(header)}.${b64(payload)}`
    const signer = createSign('RSA-SHA256')
    signer.update(signedContent)
    const signature = signer.sign(privateKey, 'base64url')
    const jwt = `${signedContent}.${signature}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: 'not-a-pem-key',
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('KYAPAY_SIGNATURE_INVALID')
  })

  it('rejects JWT with unsupported algorithm (e.g. "none")', async () => {
    const header = { alg: 'none', typ: 'JWT' }
    const payload = { sub: 'p', max_spend_cents: 1000 }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const jwt = `${b64(header)}.${b64(payload)}.`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: 'some-key',
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('KYAPAY_TOKEN_INVALID')
  })

  it('rejects JWT where nbf is in the future', async () => {
    const key = 'k'
    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = {
      sub: 'p',
      nbf: Math.floor(Date.now() / 1000) + 3600,
      max_spend_cents: 1000,
    }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signedContent = `${b64(header)}.${b64(payload)}`
    const sig = createHmac('sha256', key).update(signedContent).digest('base64url')
    const jwt = `${signedContent}.${sig}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: key,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('KYAPAY_TOKEN_INVALID')
  })

  it('rejects JWT whose allowed_services does not include the tool slug', async () => {
    const key = 'k'
    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = {
      sub: 'p',
      max_spend_cents: 1000,
      allowed_services: ['other-tool'],
    }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signedContent = `${b64(header)}.${b64(payload)}`
    const sig = createHmac('sha256', key).update(signedContent).digest('base64url')
    const jwt = `${signedContent}.${sig}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: key,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('KYAPAY_TOKEN_INVALID')
  })

  it('accepts JWT whose allowed_services contains the wildcard "*"', async () => {
    const key = 'k'
    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = {
      sub: 'p',
      max_spend_cents: 1000,
      allowed_services: ['*'],
    }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signedContent = `${b64(header)}.${b64(payload)}`
    const sig = createHmac('sha256', key).update(signedContent).digest('base64url')
    const jwt = `${signedContent}.${sig}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: key,
    })
    expect(res.valid).toBe(true)
  })

  it('accepts Bearer kyapay_ prefix (Bearer-fallback extract path)', async () => {
    const key = 'k'
    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = { sub: 'p', max_spend_cents: 1000 }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signedContent = `${b64(header)}.${b64(payload)}`
    const sig = createHmac('sha256', key).update(signedContent).digest('base64url')
    const jwt = `${signedContent}.${sig}`

    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: `Bearer kyapay_${jwt}` },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: key,
    })
    expect(res.valid).toBe(true)
  })
})

// ─── Section 6 — AP2 VDC JWT happy + edge cases ───────────────────────────

describe('coverage — AP2 VDC JWT validation', () => {
  function mintVdcJwt(claims: Record<string, unknown>, secret: string): string {
    const header = { alg: 'HS256', typ: 'JWT' }
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const signedContent = `${b64(header)}.${b64(claims)}`
    const sig = createHmac('sha256', secret).update(signedContent).digest('base64url')
    return `${signedContent}.${sig}`
  }

  const secret = 'ap2-test-secret'
  const validClaims = {
    iss: 'settlegrid.ai',
    sub: 'consumer-1',
    aud: 'merchant',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    mandate_type: 'ap2.mandates.PaymentMandate',
    mandate_id: 'm1',
    payment_method: 'card',
    amount_cents: 1000,
    currency: 'usd',
  }

  it('accepts valid VDC JWT and returns consumer + mandate fields', async () => {
    const jwt = mintVdcJwt(validClaims, secret)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-ap2-credential': jwt },
    })
    const res = await validateAp2Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingSecret: secret,
    })
    expect(res.valid).toBe(true)
    expect(res.consumerId).toBe('consumer-1')
    expect(res.mandateType).toBe('ap2.mandates.PaymentMandate')
    expect(res.transactionId).toBeTruthy()
  })

  it('rejects VDC JWT from unexpected issuer', async () => {
    const jwt = mintVdcJwt({ ...validClaims, iss: 'attacker.example' }, secret)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-ap2-credential': jwt },
    })
    const res = await validateAp2Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingSecret: secret,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('AP2_CREDENTIAL_INVALID')
  })

  it('accepts VDC JWT from custom expected issuer (expectedIssuer option)', async () => {
    const jwt = mintVdcJwt({ ...validClaims, iss: 'custom-issuer' }, secret)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-ap2-credential': jwt },
    })
    const res = await validateAp2Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingSecret: secret,
      expectedIssuer: 'custom-issuer',
    })
    expect(res.valid).toBe(true)
  })

  it('rejects VDC JWT whose amount_cents < tool cost', async () => {
    const jwt = mintVdcJwt({ ...validClaims, amount_cents: 1 }, secret)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-ap2-credential': jwt },
    })
    const res = await validateAp2Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingSecret: secret,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('AP2_AMOUNT_MISMATCH')
  })

  it('rejects AP2 request when signingSecret missing even if enabled', async () => {
    const jwt = mintVdcJwt(validClaims, secret)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-ap2-credential': jwt },
    })
    const res = await validateAp2Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      // signingSecret omitted
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('AP2_NOT_CONFIGURED')
  })

  it('accepts Bearer ap2_ prefix (Bearer-fallback extract path)', async () => {
    const jwt = mintVdcJwt(validClaims, secret)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: `Bearer ap2_${jwt}` },
    })
    const res = await validateAp2Payment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingSecret: secret,
    })
    expect(res.valid).toBe(true)
  })
})

// ─── Section 7 — Stub-validation error paths (UCP / MC / Circle / Alipay) ─

describe('coverage — stub-validation error paths', () => {
  it('UCP without session returns UCP_SESSION_MISSING', async () => {
    const req = new Request('http://localhost/api/proxy/t')
    const res = await validateUcpPayment(req, { enabled: true, toolConfig: TOOL_CONFIG })
    expect(res.error?.code).toBe('UCP_SESSION_MISSING')
  })

  it('Mastercard without intent returns MC_INTENT_MISSING', async () => {
    const req = new Request('http://localhost/api/proxy/t')
    const res = await validateMastercardPayment(req, { enabled: true, toolConfig: TOOL_CONFIG })
    expect(res.error?.code).toBe('MC_INTENT_MISSING')
  })

  it('Circle Nano without auth header returns CIRCLE_NANO_AUTH_MISSING', async () => {
    const req = new Request('http://localhost/api/proxy/t')
    const res = await validateCircleNanoPayment(req, { enabled: true, toolConfig: TOOL_CONFIG })
    expect(res.error?.code).toBe('CIRCLE_NANO_AUTH_MISSING')
  })
})

// ─── Section 8 — MPP extract/verify delegate chain integrity ──────────────

describe('coverage — MPPAdapter.verify delegates correctly', () => {
  const adapter = new MPPAdapter()

  it('verify() returns MPP_NOT_CONFIGURED identically to validateMppPayment', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-payment-token': 'spt_abc' },
    })
    const viaClass = await adapter.verify(req, {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    const viaModule = await validateMppPayment(req, {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(viaClass).toEqual(viaModule)
  })
})

// ─── Section 9 — Alipay extract Bearer path + body JSON catch ─────────────

describe('coverage — Alipay extract edge cases', () => {
  it('Bearer alipay_ prefix is extracted as the token value', async () => {
    const adapter = new AlipayAdapter()
    const req = new Request('http://localhost/api/proxy/t', {
      method: 'POST',
      headers: { authorization: 'Bearer alipay_token_abcdefghij' },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('Bearer alipay_token_abcdefghij'.replace(/^Bearer\s+/i, ''))
  })

  it('extractPaymentContext handles non-JSON body gracefully', async () => {
    const adapter = new AlipayAdapter()
    const req = new Request('http://localhost/api/proxy/t', {
      method: 'POST',
      headers: {
        'x-alipay-agent-token': 'alipay-token-abc',
        'content-type': 'text/plain',
      },
      body: 'not-json-content',
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.protocol).toBe('alipay')
    // Defaults preserved because body parse threw
    expect(ctx.operation.method).toBe('payment')
    expect(ctx.operation.service).toBe('alipay-actp')
  })
})
