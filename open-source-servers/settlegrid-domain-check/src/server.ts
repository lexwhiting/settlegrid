/**
 * settlegrid-domain-check — Domain Checker MCP Server
 *
 * Check domain name availability via WhoisXML API.
 *
 * Methods:
 *   check(domain)                 — Check if a domain name is available  (2¢)
 *   check_bulk(domains)           — Check multiple domains (comma-separated)  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CheckInput {
  domain: string
}

interface CheckBulkInput {
  domains: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://domain-availability.whoisxmlapi.com/api/v1'
const API_KEY = process.env.WHOISXML_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-domain-check/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Domain Checker API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'domain-check',
  pricing: {
    defaultCostCents: 2,
    methods: {
      check: { costCents: 2, displayName: 'Check Domain' },
      check_bulk: { costCents: 2, displayName: 'Check Bulk' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const check = sg.wrap(async (args: CheckInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim()
  const data = await apiFetch<any>(`?domainName=${encodeURIComponent(domain)}&outputFormat=JSON&apiKey=${API_KEY}`)
  return {
    DomainInfo: data.DomainInfo,
  }
}, { method: 'check' })

const checkBulk = sg.wrap(async (args: CheckBulkInput) => {
  if (!args.domains || typeof args.domains !== 'string') throw new Error('domains is required')
  const domains = args.domains.trim()
  const data = await apiFetch<any>(`?domainName=${encodeURIComponent(domains)}&outputFormat=JSON&apiKey=${API_KEY}`)
  return {
    DomainInfo: data.DomainInfo,
  }
}, { method: 'check_bulk' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { check, checkBulk }

console.log('settlegrid-domain-check MCP server ready')
console.log('Methods: check, check_bulk')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
