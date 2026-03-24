/**
 * settlegrid-citybikes — CityBikes MCP Server
 *
 * Worldwide bike-sharing station data from the CityBikes API.
 *
 * Methods:
 *   list_networks()               — Get all bike-sharing networks worldwide  (1¢)
 *   get_network(network_id)       — Get station details for a specific network  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListNetworksInput {

}

interface GetNetworkInput {
  network_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.citybik.es/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-citybikes/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CityBikes API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'citybikes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_networks: { costCents: 1, displayName: 'List Networks' },
      get_network: { costCents: 1, displayName: 'Get Network' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listNetworks = sg.wrap(async (args: ListNetworksInput) => {

  const data = await apiFetch<any>(`/networks?fields=id,name,location`)
  const items = (data.networks ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        location: item.location,
    })),
  }
}, { method: 'list_networks' })

const getNetwork = sg.wrap(async (args: GetNetworkInput) => {
  if (!args.network_id || typeof args.network_id !== 'string') throw new Error('network_id is required')
  const network_id = args.network_id.trim()
  const data = await apiFetch<any>(`/networks/${encodeURIComponent(network_id)}`)
  return {
    id: data.id,
    name: data.name,
    location: data.location,
    stations: data.stations,
  }
}, { method: 'get_network' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listNetworks, getNetwork }

console.log('settlegrid-citybikes MCP server ready')
console.log('Methods: list_networks, get_network')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
