/**
 * settlegrid-dns-propagation — DNS Lookup MCP Server
 *
 * Performs DNS lookups using public DNS-over-HTTPS resolvers.
 * Checks record types and compares across multiple providers.
 *
 * Methods:
 *   lookup(domain, type?)           — DNS lookup via DoH             (2c)
 *   check_propagation(domain)       — Check across multiple resolvers (2c)
 *   get_record_types()              — List DNS record types          (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface LookupInput { domain: string; type?: string }
interface PropagationInput { domain: string; type?: string }

const DOH_RESOLVERS: Record<string, string> = {
  google: 'https://dns.google/resolve',
  cloudflare: 'https://cloudflare-dns.com/dns-query',
}

const RECORD_TYPES: Record<string, { description: string; common: boolean }> = {
  A: { description: 'IPv4 address', common: true },
  AAAA: { description: 'IPv6 address', common: true },
  CNAME: { description: 'Canonical name (alias)', common: true },
  MX: { description: 'Mail exchange server', common: true },
  TXT: { description: 'Text record (SPF, DKIM, etc.)', common: true },
  NS: { description: 'Nameserver', common: true },
  SOA: { description: 'Start of authority', common: false },
  SRV: { description: 'Service locator', common: false },
  CAA: { description: 'Certificate authority authorization', common: false },
  PTR: { description: 'Pointer (reverse DNS)', common: false },
}

async function dohLookup(resolver: string, domain: string, type: string): Promise<{ answers: Array<{ data: string; ttl: number }> }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const url = `${resolver}?name=${encodeURIComponent(domain)}&type=${type}`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/dns-json' },
    })
    if (!res.ok) throw new Error(`DNS resolver ${res.status}`)
    const data = await res.json() as { Answer?: Array<{ data: string; TTL: number; type: number }> }
    return {
      answers: (data.Answer ?? []).map(a => ({ data: a.data, ttl: a.TTL })),
    }
  } finally { clearTimeout(timeout) }
}

const sg = settlegrid.init({
  toolSlug: 'dns-propagation',
  pricing: { defaultCostCents: 2, methods: {
    lookup: { costCents: 2, displayName: 'DNS Lookup' },
    check_propagation: { costCents: 2, displayName: 'Check Propagation' },
    get_record_types: { costCents: 1, displayName: 'Get Record Types' },
  }},
})

const lookup = sg.wrap(async (args: LookupInput) => {
  if (!args.domain) throw new Error('domain is required')
  const type = (args.type ?? 'A').toUpperCase()
  if (!RECORD_TYPES[type]) throw new Error(`Unknown type. Available: ${Object.keys(RECORD_TYPES).join(', ')}`)
  const result = await dohLookup(DOH_RESOLVERS.google, args.domain, type)
  return { domain: args.domain, type, resolver: 'Google DNS', records: result.answers, count: result.answers.length }
}, { method: 'lookup' })

const checkPropagation = sg.wrap(async (args: PropagationInput) => {
  if (!args.domain) throw new Error('domain is required')
  const type = (args.type ?? 'A').toUpperCase()
  const results = await Promise.allSettled(
    Object.entries(DOH_RESOLVERS).map(async ([name, url]) => {
      const result = await dohLookup(url, args.domain, type)
      return { resolver: name, records: result.answers }
    })
  )
  const resolved = results.map((r, i) => {
    const name = Object.keys(DOH_RESOLVERS)[i]
    if (r.status === 'fulfilled') return r.value
    return { resolver: name, records: [], error: 'Timeout or error' }
  })
  const allSame = resolved.every(r => JSON.stringify(r.records.map(a => a.data).sort()) === JSON.stringify(resolved[0]?.records.map(a => a.data).sort()))
  return { domain: args.domain, type, propagated: allSame, resolvers: resolved }
}, { method: 'check_propagation' })

const getRecordTypes = sg.wrap(async (_a: Record<string, never>) => {
  return { types: Object.entries(RECORD_TYPES).map(([type, info]) => ({ type, ...info })), count: Object.keys(RECORD_TYPES).length }
}, { method: 'get_record_types' })

export { lookup, checkPropagation, getRecordTypes }
console.log('settlegrid-dns-propagation MCP server ready')
console.log('Methods: lookup, check_propagation, get_record_types')
console.log('Pricing: 2c per call | Powered by SettleGrid')
