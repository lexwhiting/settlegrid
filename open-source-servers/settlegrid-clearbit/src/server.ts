/**
 * settlegrid-clearbit — Clearbit Company Data MCP Server
 *
 * Wraps the Clearbit API for company enrichment with SettleGrid billing.
 * Requires a Clearbit API key (free tier available).
 *
 * Methods:
 *   enrich_company(domain)  — Enrich company by domain  (2¢)
 *   get_logo(domain)        — Get company logo URL      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainInput { domain: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://company.clearbit.com/v2'
const LOGO_BASE = 'https://logo.clearbit.com'
const API_KEY = process.env.CLEARBIT_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/

async function clearbitFetch<T>(url: string): Promise<T> {
  if (!API_KEY) throw new Error('CLEARBIT_API_KEY environment variable is required')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Company not found for this domain')
    if (res.status === 401) throw new Error('Invalid Clearbit API key')
    const body = await res.text().catch(() => '')
    throw new Error(`Clearbit API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') throw new Error('domain is required')
  const d = domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(d)) throw new Error('Invalid domain format (e.g. "stripe.com")')
  return d
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'clearbit',
  pricing: {
    defaultCostCents: 2,
    methods: {
      enrich_company: { costCents: 2, displayName: 'Enrich Company' },
      get_logo: { costCents: 1, displayName: 'Get Logo' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const enrichCompany = sg.wrap(async (args: DomainInput) => {
  const domain = validateDomain(args.domain)
  const data = await clearbitFetch<Record<string, unknown>>(`${API_BASE}/companies/find?domain=${domain}`)
  return {
    domain,
    name: data.name,
    legalName: data.legalName || null,
    description: data.description || null,
    sector: data.sector || null,
    industry: data.industry || null,
    tags: data.tags || [],
    location: data.location || null,
    employees: data.metrics ? (data.metrics as Record<string, unknown>).employees : null,
    raised: data.metrics ? (data.metrics as Record<string, unknown>).raised : null,
    foundedYear: data.foundedYear || null,
    logo: data.logo || null,
    url: data.url || null,
  }
}, { method: 'enrich_company' })

const getLogo = sg.wrap(async (args: DomainInput) => {
  const domain = validateDomain(args.domain)
  return { domain, logoUrl: `${LOGO_BASE}/${domain}`, format: 'png', sizes: { default: `${LOGO_BASE}/${domain}`, small: `${LOGO_BASE}/${domain}?size=64`, large: `${LOGO_BASE}/${domain}?size=256` } }
}, { method: 'get_logo' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { enrichCompany, getLogo }

console.log('settlegrid-clearbit MCP server ready')
console.log('Methods: enrich_company, get_logo')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
