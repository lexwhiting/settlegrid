/**
 * settlegrid-ip-lookup — IP Address Lookup MCP Server
 *
 * Wraps ip-api.com with SettleGrid billing.
 * No API key needed — free for non-commercial use.
 *
 * Methods:
 *   lookup_ip(ip) — IP geolocation (1¢)
 *   batch_lookup(ips) — batch IP lookup (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface LookupInput { ip: string }
interface BatchInput { ips: string[] }

const API_BASE = 'http://ip-api.com'

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, opts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'ip-lookup',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_ip: { costCents: 1, displayName: 'Lookup IP' },
      batch_lookup: { costCents: 2, displayName: 'Batch Lookup' },
    },
  },
})

const lookupIp = sg.wrap(async (args: LookupInput) => {
  if (!args.ip) throw new Error('ip is required')
  const data = await apiFetch<any>(`/json/${args.ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`)
  if (data.status === 'fail') throw new Error(data.message || 'Lookup failed')
  return data
}, { method: 'lookup_ip' })

const batchLookup = sg.wrap(async (args: BatchInput) => {
  if (!args.ips?.length) throw new Error('ips array is required')
  if (args.ips.length > 100) throw new Error('Maximum 100 IPs per batch')
  const data = await apiFetch<any[]>('/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args.ips),
  })
  return { results: data }
}, { method: 'batch_lookup' })

export { lookupIp, batchLookup }

console.log('settlegrid-ip-lookup MCP server ready')
console.log('Methods: lookup_ip, batch_lookup')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
