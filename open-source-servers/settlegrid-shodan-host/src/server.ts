/**
 * settlegrid-shodan-host — Shodan Host Lookup MCP Server
 *
 * Wraps Shodan API with SettleGrid billing.
 * Free key from https://account.shodan.io/.
 *
 * Methods:
 *   lookup_host(ip) — host lookup (3¢)
 *   shodan_search(query) — search (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface HostInput { ip: string }
interface SearchInput { query: string }

const API_BASE = 'https://api.shodan.io'
const API_KEY = process.env.SHODAN_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${API_BASE}${path}${sep}key=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'shodan-host',
  pricing: {
    defaultCostCents: 3,
    methods: {
      lookup_host: { costCents: 3, displayName: 'Lookup Host' },
      shodan_search: { costCents: 3, displayName: 'Shodan Search' },
    },
  },
})

const lookupHost = sg.wrap(async (args: HostInput) => {
  if (!args.ip) throw new Error('ip is required')
  if (!API_KEY) throw new Error('SHODAN_API_KEY not set')
  const data = await apiFetch<any>(`/shodan/host/${args.ip}`)
  return {
    ip: data.ip_str, hostnames: data.hostnames, org: data.org,
    os: data.os, country: data.country_name, city: data.city,
    ports: data.ports, vulns: data.vulns,
    services: (data.data || []).slice(0, 10).map((s: any) => ({
      port: s.port, transport: s.transport, product: s.product,
      version: s.version, banner: s.data?.slice(0, 200),
    })),
  }
}, { method: 'lookup_host' })

const shodanSearch = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  if (!API_KEY) throw new Error('SHODAN_API_KEY not set')
  const data = await apiFetch<any>(`/shodan/host/search?query=${encodeURIComponent(args.query)}`)
  return {
    total: data.total,
    matches: (data.matches || []).slice(0, 20).map((m: any) => ({
      ip: m.ip_str, port: m.port, org: m.org, os: m.os,
      product: m.product, country: m.location?.country_name,
    })),
  }
}, { method: 'shodan_search' })

export { lookupHost, shodanSearch }

console.log('settlegrid-shodan-host MCP server ready')
console.log('Methods: lookup_host, shodan_search')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
