/**
 * x402 EXACT-scheme payment-header parsing for the on-chain settlement path.
 *
 * The proxy (`handleX402Proxy`) settles x402 on-chain in apps/web (where viem
 * lives), so it must recover the full EIP-3009 authorization from the request
 * header itself — the SDK's `validateX402Payment` result only surfaces a thin
 * subset (payer/network/amount/scheme), not the signature / nonce / to /
 * validAfter / validBefore the chain write needs.
 *
 * Decode mirrors the SDK's `decodePaymentHeader` + `parseCircleNanoProof`
 * (base64(JSON) first, raw-JSON fallback) and the SDK's `extractX402Payload`
 * header precedence. This is a STRUCTURAL gate only: it proves the bytes are a
 * well-formed `exact` payload. The authoritative signature / payee / amount /
 * network checks run in `verifyEip3009Authorization` before any on-chain submit,
 * so a decode that ever diverged from the SDK fails closed at verify.
 */
import type { X402ExactPayload } from './types'

/** Header sources, in the SDK's `extractX402Payload` precedence order. Keep in
 *  sync with packages/mcp `x402.ts` if the SDK adds a source. */
const X402_PAYMENT_HEADER = 'X-Payment'
const X402_PAYMENT_SIGNATURE_HEADER = 'payment-signature'

/** The raw x402 payment header value (base64 or JSON), or null if absent. */
export function extractX402PaymentHeader(request: Request): string | null {
  const xPayment = request.headers.get(X402_PAYMENT_HEADER)
  if (xPayment) return xPayment
  const sig = request.headers.get(X402_PAYMENT_SIGNATURE_HEADER)
  if (sig) return sig
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('x402_')) return bearer.slice(5)
  }
  return null
}

/**
 * Decode + shape-validate an x402 EXACT-scheme payment header into an
 * `X402ExactPayload`, or `null`. Returns null for ANY structural defect OR a
 * non-`exact` scheme (v1 settles exact only; `upto` is rejected upstream). NOT a
 * cryptographic check — see the file header.
 */
export function parseX402ExactPayload(headerValue: string): X402ExactPayload | null {
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s)
    } catch {
      return undefined
    }
  }
  // base64-first (the wire default), then raw-JSON fallback.
  let obj = tryParse(Buffer.from(headerValue, 'base64').toString('utf-8'))
  if (obj === undefined) obj = tryParse(headerValue)
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null

  const o = obj as Record<string, unknown>
  if (o.scheme !== 'exact') return null
  if (typeof o.network !== 'string') return null

  const inner = o.payload
  if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) return null
  const p = inner as Record<string, unknown>
  if (typeof p.signature !== 'string') return null

  const auth = p.authorization
  if (auth === null || typeof auth !== 'object' || Array.isArray(auth)) return null
  const a = auth as Record<string, unknown>
  const fields = ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'] as const
  for (const f of fields) {
    if (typeof a[f] !== 'string') return null
  }

  return {
    x402Version: typeof o.x402Version === 'number' ? o.x402Version : 2,
    scheme: 'exact',
    // The network string is carried verbatim; verifyEip3009Authorization fails
    // closed on any network it can't pin a USDC EIP-712 domain for (so non-Base,
    // incl. eip155:1, is rejected at verify before any chain write).
    network: o.network as X402ExactPayload['network'],
    payload: {
      signature: p.signature as `0x${string}`,
      authorization: {
        from: a.from as `0x${string}`,
        to: a.to as `0x${string}`,
        value: a.value as string,
        validAfter: a.validAfter as string,
        validBefore: a.validBefore as string,
        nonce: a.nonce as `0x${string}`,
      },
    },
  }
}
