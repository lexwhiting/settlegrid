/**
 * settlegrid-ipify — ipify MCP Server
 *
 * Get your public IPv4 and IPv6 addresses.
 *
 * Methods:
 *   get_ipv4()                    — Get your public IPv4 address  (1¢)
 *   get_ipv6()                    — Get your public IPv6 address  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIpv4Input {}

interface GetIpv6Input {}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function ipFetch(url: string): Promise<{ ip: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-ipify/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ipify API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<{ ip: string }>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ipify',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ipv4: { costCents: 1, displayName: 'Get IPv4' },
      get_ipv6: { costCents: 1, displayName: 'Get IPv6' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIpv4 = sg.wrap(async (_args: GetIpv4Input) => {
  const data = await ipFetch('https://api.ipify.org?format=json')
  return { ip: data.ip, version: 'ipv4' }
}, { method: 'get_ipv4' })

const getIpv6 = sg.wrap(async (_args: GetIpv6Input) => {
  const data = await ipFetch('https://api64.ipify.org?format=json')
  return { ip: data.ip, version: 'ipv6' }
}, { method: 'get_ipv6' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIpv4, getIpv6 }

console.log('settlegrid-ipify MCP server ready')
console.log('Methods: get_ipv4, get_ipv6')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
