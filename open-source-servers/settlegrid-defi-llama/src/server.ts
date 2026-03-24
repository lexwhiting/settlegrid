/**
 * settlegrid-defi-llama — DefiLlama MCP Server
 *
 * DeFi TVL, protocol data, and yield aggregation from DefiLlama.
 *
 * Methods:
 *   get_protocols()               — Get TVL data for all DeFi protocols  (1¢)
 *   get_protocol(protocol)        — Get detailed TVL data for a specific protocol  (1¢)
 *   get_chains()                  — Get TVL data grouped by chain  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetProtocolsInput {

}

interface GetProtocolInput {
  protocol: string
}

interface GetChainsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.llama.fi'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-defi-llama/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DefiLlama API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'defi-llama',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_protocols: { costCents: 1, displayName: 'All Protocols' },
      get_protocol: { costCents: 1, displayName: 'Protocol Detail' },
      get_chains: { costCents: 1, displayName: 'Chain TVL' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProtocols = sg.wrap(async (args: GetProtocolsInput) => {

  const data = await apiFetch<any>(`/protocols`)
  return {
    name: data.name,
    tvl: data.tvl,
    chain: data.chain,
    category: data.category,
    symbol: data.symbol,
    change_1d: data.change_1d,
    change_7d: data.change_7d,
  }
}, { method: 'get_protocols' })

const getProtocol = sg.wrap(async (args: GetProtocolInput) => {
  if (!args.protocol || typeof args.protocol !== 'string') throw new Error('protocol is required')
  const protocol = args.protocol.trim()
  const data = await apiFetch<any>(`/protocol/${encodeURIComponent(protocol)}`)
  return {
    name: data.name,
    tvl: data.tvl,
    chains: data.chains,
    category: data.category,
    description: data.description,
    url: data.url,
    chainTvls: data.chainTvls,
  }
}, { method: 'get_protocol' })

const getChains = sg.wrap(async (args: GetChainsInput) => {

  const data = await apiFetch<any>(`/v2/chains`)
  return {
    name: data.name,
    tvl: data.tvl,
    tokenSymbol: data.tokenSymbol,
    gecko_id: data.gecko_id,
  }
}, { method: 'get_chains' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProtocols, getProtocol, getChains }

console.log('settlegrid-defi-llama MCP server ready')
console.log('Methods: get_protocols, get_protocol, get_chains')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
