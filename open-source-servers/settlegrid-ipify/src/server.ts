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

interface GetIpv4Input {

}

interface GetIpv6Input {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.ipify.org'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-ipify/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ipify API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
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

const getIpv4 = sg.wrap(async (args: GetIpv4Input) => {

  const data = await apiFetch<any>(`/?format=json`)
  return {
    ip: data.ip,
  }
}, { method: 'get_ipv4' })

const getIpv6 = sg.wrap(async (args: GetIpv6Input) => {

  const data = await apiFetch<any>(`/__ipv6__`)
  return {
    ip: data.ip,
  }
}, { method: 'get_ipv6' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIpv4, getIpv6 }

console.log('settlegrid-ipify MCP server ready')
console.log('Methods: get_ipv4, get_ipv6')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
