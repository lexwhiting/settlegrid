/**
 * settlegrid-email-verify — Email Verification MCP Server
 *
 * Uses emailrep.io free API for reputation checks + local format validation.
 *
 * Methods:
 *   verify(email)             — Full email verification     (2¢)
 *   verify_batch(emails[])    — Batch verification          (1¢/email)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface VerifyInput {
  email: string
}

interface BatchInput {
  emails: string[]
}

interface EmailRepResponse {
  email: string
  reputation: string
  suspicious: boolean
  references: number
  details: {
    blacklisted: boolean
    malicious_activity: boolean
    credentials_leaked: boolean
    data_breach: boolean
    free_provider: boolean
    disposable: boolean
    deliverable: boolean
    accept_all: boolean
    valid_mx: boolean
    spoofable: boolean
    spf_strict: boolean
    dmarc_enforced: boolean
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
  'trashmail.com', '10minutemail.com', 'temp-mail.org', 'fakeinbox.com',
])
const FREE_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'protonmail.com', 'icloud.com', 'mail.com', 'zoho.com', 'yandex.com',
])

async function checkEmailRep(email: string): Promise<EmailRepResponse | null> {
  try {
    const res = await fetch(`https://emailrep.io/${encodeURIComponent(email)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-email-verify/1.0' },
    })
    if (!res.ok) return null
    return res.json() as Promise<EmailRepResponse>
  } catch {
    return null
  }
}

function validateFormat(email: string): { valid: boolean; reason?: string } {
  if (!email || typeof email !== 'string') return { valid: false, reason: 'Email is required' }
  if (email.length > 254) return { valid: false, reason: 'Email too long (max 254 chars)' }
  if (!EMAIL_REGEX.test(email)) return { valid: false, reason: 'Invalid email format' }

  const [local, domain] = email.split('@')
  if (local.length > 64) return { valid: false, reason: 'Local part too long (max 64 chars)' }
  if (domain.length > 253) return { valid: false, reason: 'Domain too long' }

  return { valid: true }
}

function analyzeEmail(email: string) {
  const domain = email.split('@')[1].toLowerCase()
  return {
    isDisposable: DISPOSABLE_DOMAINS.has(domain),
    isFreeProvider: FREE_PROVIDERS.has(domain),
    domain,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'email-verify',
  pricing: {
    defaultCostCents: 2,
    methods: {
      verify: { costCents: 2, displayName: 'Verify Email' },
      verify_batch: { costCents: 1, displayName: 'Batch Verify' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const verify = sg.wrap(async (args: VerifyInput) => {
  if (!args.email || typeof args.email !== 'string') throw new Error('email is required')
  const email = args.email.toLowerCase().trim()

  const format = validateFormat(email)
  if (!format.valid) return { email, valid: false, reason: format.reason }

  const analysis = analyzeEmail(email)
  const rep = await checkEmailRep(email)

  return {
    email,
    valid: format.valid && !analysis.isDisposable,
    format: format.valid,
    disposable: analysis.isDisposable,
    freeProvider: analysis.isFreeProvider,
    domain: analysis.domain,
    reputation: rep ? {
      score: rep.reputation,
      suspicious: rep.suspicious,
      deliverable: rep.details?.deliverable ?? null,
      validMx: rep.details?.valid_mx ?? null,
      blacklisted: rep.details?.blacklisted ?? false,
      credentialsLeaked: rep.details?.credentials_leaked ?? false,
    } : null,
  }
}, { method: 'verify' })

const verifyBatch = sg.wrap(async (args: BatchInput) => {
  if (!Array.isArray(args.emails) || args.emails.length === 0) {
    throw new Error('emails must be a non-empty array')
  }
  if (args.emails.length > 50) throw new Error('Maximum 50 emails per batch')

  const results = args.emails.map((email) => {
    if (typeof email !== 'string') return { email: String(email), valid: false, reason: 'Not a string' }
    const e = email.toLowerCase().trim()
    const format = validateFormat(e)
    const analysis = analyzeEmail(e)
    return {
      email: e,
      valid: format.valid && !analysis.isDisposable,
      format: format.valid,
      disposable: analysis.isDisposable,
      freeProvider: analysis.isFreeProvider,
      reason: !format.valid ? format.reason : analysis.isDisposable ? 'Disposable email' : undefined,
    }
  })

  return {
    total: results.length,
    valid: results.filter((r) => r.valid).length,
    invalid: results.filter((r) => !r.valid).length,
    results,
  }
}, { method: 'verify_batch' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { verify, verifyBatch }

console.log('settlegrid-email-verify MCP server ready')
console.log('Methods: verify, verify_batch')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
