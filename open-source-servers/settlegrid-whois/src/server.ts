/**
 * settlegrid-whois — WHOIS Domain Lookup MCP Server
 *
 * Domain WHOIS registration and availability lookup.
 *
 * Methods:
 *   lookup_domain(domain)         — Get WHOIS info for a domain name  (1¢)
 *   check_availability(domain)    — Check if a domain is available for registration  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupDomainInput {
  domain: string
}

interface CheckAvailabilityInput {
  domain: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://whoisjs.com/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-whois/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WHOIS Domain Lookup API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'whois',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_domain: { costCents: 1, displayName: 'Domain Lookup' },
      check_availability: { costCents: 1, displayName: 'Check Availability' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupDomain = sg.wrap(async (args: LookupDomainInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(domain)}`)
  return {
    name: data.name,
    registrar: data.registrar,
    creation_date: data.creation_date,
    expiration_date: data.expiration_date,
    name_servers: data.name_servers,
    status: data.status,
  }
}, { method: 'lookup_domain' })

const checkAvailability = sg.wrap(async (args: CheckAvailabilityInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(domain)}`)
  return {
    name: data.name,
    registrar: data.registrar,
    status: data.status,
  }
}, { method: 'check_availability' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupDomain, checkAvailability }

console.log('settlegrid-whois MCP server ready')
console.log('Methods: lookup_domain, check_availability')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
