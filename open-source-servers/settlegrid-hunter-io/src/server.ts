/**
 * settlegrid-hunter-io — Hunter.io Email Finder MCP Server
 *
 * Wraps the Hunter.io API with SettleGrid billing.
 * Requires a Hunter.io API key (free tier: 25/month).
 *
 * Methods:
 *   domain_search(domain)                       — Find emails for domain  (2¢)
 *   email_finder(domain, first_name, last_name) — Find person's email    (2¢)
 *   email_verifier(email)                       — Verify email validity   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainSearchInput { domain: string }
interface EmailFinderInput { domain: string; first_name: string; last_name: string }
interface EmailVerifierInput { email: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.hunter.io/v2'
const API_KEY = process.env.HUNTER_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function hunterFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('HUNTER_API_KEY environment variable is required')
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(`${API_BASE}${path}${separator}api_key=${API_KEY}`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid Hunter.io API key')
    if (res.status === 429) throw new Error('Hunter.io rate limit exceeded')
    const body = await res.text().catch(() => '')
    throw new Error(`Hunter.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hunter-io',
  pricing: {
    defaultCostCents: 2,
    methods: {
      domain_search: { costCents: 2, displayName: 'Domain Search' },
      email_finder: { costCents: 2, displayName: 'Email Finder' },
      email_verifier: { costCents: 2, displayName: 'Email Verifier' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const domainSearch = sg.wrap(async (args: DomainSearchInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  const data = await hunterFetch<{ data: { domain: string; organization: string; emails: Array<{ value: string; type: string; confidence: number; first_name: string; last_name: string; position: string }> } }>(`/domain-search?domain=${domain}`)
  return {
    domain: data.data.domain,
    organization: data.data.organization,
    emails: data.data.emails.slice(0, 15).map(e => ({
      email: e.value, type: e.type, confidence: e.confidence,
      name: `${e.first_name} ${e.last_name}`.trim(), position: e.position || null,
    })),
  }
}, { method: 'domain_search' })

const emailFinder = sg.wrap(async (args: EmailFinderInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  if (!args.first_name || typeof args.first_name !== 'string') throw new Error('first_name is required')
  if (!args.last_name || typeof args.last_name !== 'string') throw new Error('last_name is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  const data = await hunterFetch<{ data: { email: string; score: number; position: string; company: string } }>(`/email-finder?domain=${domain}&first_name=${encodeURIComponent(args.first_name)}&last_name=${encodeURIComponent(args.last_name)}`)
  return { domain, firstName: args.first_name, lastName: args.last_name, email: data.data.email, confidence: data.data.score, position: data.data.position || null, company: data.data.company || null }
}, { method: 'email_finder' })

const emailVerifier = sg.wrap(async (args: EmailVerifierInput) => {
  if (!args.email || typeof args.email !== 'string') throw new Error('email is required')
  const email = args.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new Error('Invalid email format')
  const data = await hunterFetch<{ data: { email: string; result: string; score: number; regexp: boolean; gibberish: boolean; disposable: boolean; webmail: boolean; mx_records: boolean; smtp_server: boolean; smtp_check: boolean } }>(`/email-verifier?email=${encodeURIComponent(email)}`)
  return {
    email: data.data.email, result: data.data.result, score: data.data.score,
    checks: { validFormat: data.data.regexp, notGibberish: !data.data.gibberish, notDisposable: !data.data.disposable, isWebmail: data.data.webmail, hasMX: data.data.mx_records, smtpValid: data.data.smtp_check },
  }
}, { method: 'email_verifier' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { domainSearch, emailFinder, emailVerifier }

console.log('settlegrid-hunter-io MCP server ready')
console.log('Methods: domain_search, email_finder, email_verifier')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
