/**
 * settlegrid-ip-whois — IP Whois Lookup MCP Server
 *
 * Wraps ipwhois.app API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   whois_ip(ip) — IP WHOIS info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WhoisInput { ip: string }

const sg = settlegrid.init({
  toolSlug: 'ip-whois',
  pricing: { defaultCostCents: 1, methods: { whois_ip: { costCents: 1, displayName: 'WHOIS IP' } } },
})

const whoisIp = sg.wrap(async (args: WhoisInput) => {
  if (!args.ip) throw new Error('ip is required')
  const res = await fetch(`https://ipwhois.app/json/${args.ip}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json() as any
  return {
    ip: data.ip, type: data.type, country: data.country, country_code: data.country_code,
    region: data.region, city: data.city, latitude: data.latitude, longitude: data.longitude,
    isp: data.isp, org: data.org, asn: data.asn, timezone: data.timezone,
    currency: data.currency, currency_code: data.currency_code,
  }
}, { method: 'whois_ip' })

export { whoisIp }

console.log('settlegrid-ip-whois MCP server ready')
console.log('Methods: whois_ip')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
