/**
 * settlegrid-domain-whois — Domain WHOIS + DNS MCP Server
 *
 * Methods:
 *   whois_lookup(domain)             (1¢)
 *   dns_lookup(domain, type)         (1¢)
 *   check_availability(domain)       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WhoisInput { domain: string }
interface DnsInput { domain: string; type?: string }
interface AvailabilityInput { domain: string }

const USER_AGENT = 'settlegrid-domain-whois/1.0 (contact@settlegrid.ai)'

const sg = settlegrid.init({
  toolSlug: 'domain-whois',
  pricing: { defaultCostCents: 1, methods: {
    whois_lookup: { costCents: 1, displayName: 'WHOIS lookup' },
    dns_lookup: { costCents: 1, displayName: 'DNS record lookup' },
    check_availability: { costCents: 1, displayName: 'Check domain availability' },
  }},
})

const whoisLookup = sg.wrap(async (args: WhoisInput) => {
  if (!args.domain) throw new Error('domain is required')
  const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(args.domain)}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rdap+json' },
  })
  if (!res.ok) throw new Error(`RDAP ${res.status}`)
  return await res.json()
}, { method: 'whois_lookup' })

const dnsLookup = sg.wrap(async (args: DnsInput) => {
  if (!args.domain) throw new Error('domain is required')
  const type = args.type || 'A'
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(args.domain)}&type=${type}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/dns-json' },
  })
  if (!res.ok) throw new Error(`Google DNS API ${res.status}`)
  return await res.json()
}, { method: 'dns_lookup' })

const checkAvailability = sg.wrap(async (args: AvailabilityInput) => {
  if (!args.domain) throw new Error('domain is required')
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(args.domain)}&type=NS`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    const data = await res.json() as { Answer?: unknown[] }
    const hasNS = Array.isArray(data.Answer) && data.Answer.length > 0
    return { domain: args.domain, registered: hasNS, available: !hasNS }
  } catch {
    return { domain: args.domain, registered: false, available: true, note: 'DNS lookup failed, domain may be available' }
  }
}, { method: 'check_availability' })

export { whoisLookup, dnsLookup, checkAvailability }

console.log('settlegrid-domain-whois MCP server ready')
console.log('Methods: whois_lookup, dns_lookup, check_availability')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
