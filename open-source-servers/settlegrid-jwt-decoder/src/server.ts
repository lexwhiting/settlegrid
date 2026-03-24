/**
 * settlegrid-jwt-decoder — JWT Token Decoding MCP Server
 *
 * Decode and inspect JWT tokens without verification. All local computation.
 *
 * Methods:
 *   decode_jwt(token) — Decode JWT header and payload (free)
 *   inspect_jwt(token) — Detailed JWT inspection with expiry check (free)
 *   validate_jwt_structure(token) — Validate JWT structure (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TokenInput { token: string }

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + padding, 'base64').toString('utf-8')
}

function parseJwt(token: string): { header: any; payload: any; signature: string } {
  const parts = token.trim().split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT: must have 3 parts separated by dots')
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]))
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    return { header, payload, signature: parts[2] }
  } catch (e) {
    throw new Error(`Invalid JWT: failed to decode - ${(e as Error).message}`)
  }
}

const KNOWN_CLAIMS: Record<string, string> = {
  iss: 'Issuer', sub: 'Subject', aud: 'Audience', exp: 'Expiration Time',
  nbf: 'Not Before', iat: 'Issued At', jti: 'JWT ID',
  name: 'Full Name', email: 'Email', role: 'Role', scope: 'Scope',
  nonce: 'Nonce', azp: 'Authorized Party', at_hash: 'Access Token Hash',
}

const sg = settlegrid.init({
  toolSlug: 'jwt-decoder',
  pricing: {
    defaultCostCents: 0,
    methods: {
      decode_jwt: { costCents: 0, displayName: 'Decode JWT' },
      inspect_jwt: { costCents: 0, displayName: 'Inspect JWT' },
      validate_jwt_structure: { costCents: 0, displayName: 'Validate JWT Structure' },
    },
  },
})

const decodeJwt = sg.wrap(async (args: TokenInput) => {
  if (!args.token) throw new Error('token required')
  const { header, payload, signature } = parseJwt(args.token)
  return { header, payload, signaturePresent: !!signature }
}, { method: 'decode_jwt' })

const inspectJwt = sg.wrap(async (args: TokenInput) => {
  if (!args.token) throw new Error('token required')
  const { header, payload, signature } = parseJwt(args.token)
  const now = Math.floor(Date.now() / 1000)

  const expiry = payload.exp ? {
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    isExpired: payload.exp < now,
    secondsRemaining: Math.max(0, payload.exp - now),
    expiresIn: payload.exp > now
      ? `${Math.floor((payload.exp - now) / 3600)}h ${Math.floor(((payload.exp - now) % 3600) / 60)}m`
      : 'expired',
  } : null

  const issuedAt = payload.iat ? {
    issuedAt: new Date(payload.iat * 1000).toISOString(),
    ageSeconds: now - payload.iat,
  } : null

  const claims = Object.keys(payload).map(key => ({
    claim: key,
    description: KNOWN_CLAIMS[key] || 'Custom claim',
    value: typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : String(payload[key]),
  }))

  return {
    algorithm: header.alg,
    type: header.typ,
    header,
    payload,
    expiry,
    issuedAt,
    issuer: payload.iss || null,
    subject: payload.sub || null,
    audience: payload.aud || null,
    claims,
    signatureLength: signature.length,
  }
}, { method: 'inspect_jwt' })

const validateJwtStructure = sg.wrap(async (args: TokenInput) => {
  if (!args.token) throw new Error('token required')
  const issues: string[] = []
  const parts = args.token.trim().split('.')

  if (parts.length !== 3) {
    issues.push(`Expected 3 parts, got ${parts.length}`)
    return { valid: false, issues }
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]))
    if (!header.alg) issues.push('Missing alg in header')
    if (!header.typ) issues.push('Missing typ in header (recommended)')
  } catch { issues.push('Invalid header JSON') }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    if (payload.exp && typeof payload.exp !== 'number') issues.push('exp claim should be a number')
    if (payload.iat && typeof payload.iat !== 'number') issues.push('iat claim should be a number')
    if (payload.nbf && typeof payload.nbf !== 'number') issues.push('nbf claim should be a number')
  } catch { issues.push('Invalid payload JSON') }

  if (!parts[2]) issues.push('Empty signature (unsigned JWT)')

  return { valid: issues.length === 0, issues, partLengths: parts.map(p => p.length) }
}, { method: 'validate_jwt_structure' })

export { decodeJwt, inspectJwt, validateJwtStructure }

console.log('settlegrid-jwt-decoder MCP server ready')
console.log('Methods: decode_jwt, inspect_jwt, validate_jwt_structure')
console.log('Pricing: Free (local computation) | Powered by SettleGrid')
