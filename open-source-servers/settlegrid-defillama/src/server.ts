/**
 * settlegrid-defillama — DeFi Llama MCP Server
 *
 * Wraps DefiLlama API with SettleGrid billing.
 * No API key needed — DefiLlama is free and open.
 *
 * Methods:
 *   get_protocol_tvl(protocol) — protocol TVL (1¢)
 *   get_chain_tvl(chain) — chain TVL (1¢)
 *   list_protocols() — list all protocols (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ProtocolInput { protocol: string }
interface ChainInput { chain: string }

const API_BASE = 'https://api.llama.fi'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'defillama',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_protocol_tvl: { costCents: 1, displayName: 'Protocol TVL' },
      get_chain_tvl: { costCents: 1, displayName: 'Chain TVL' },
      list_protocols: { costCents: 1, displayName: 'List Protocols' },
    },
  },
})

const getProtocolTvl = sg.wrap(async (args: ProtocolInput) => {
  if (!args.protocol) throw new Error('protocol slug is required')
  const data = await apiFetch<any>(`/protocol/${args.protocol}`)
  return {
    name: data.name, symbol: data.symbol, category: data.category,
    tvl: data.tvl, chains: data.chains, chainTvls: data.currentChainTvls,
    change_1d: data.change_1d, change_7d: data.change_7d,
    url: data.url, description: data.description,
  }
}, { method: 'get_protocol_tvl' })

const getChainTvl = sg.wrap(async (args: ChainInput) => {
  if (!args.chain) throw new Error('chain name is required')
  const data = await apiFetch<any>(`/v2/historicalChainTvl/${args.chain}`)
  const recent = data.slice(-30)
  return { chain: args.chain, history: recent, latest_tvl: recent[recent.length - 1]?.tvl || 0 }
}, { method: 'get_chain_tvl' })

const listProtocols = sg.wrap(async () => {
  const data = await apiFetch<any[]>('/protocols')
  return {
    total: data.length,
    top_50: data.slice(0, 50).map((p: any) => ({
      name: p.name, slug: p.slug, tvl: p.tvl, category: p.category, chains: p.chains,
    })),
  }
}, { method: 'list_protocols' })

export { getProtocolTvl, getChainTvl, listProtocols }

console.log('settlegrid-defillama MCP server ready')
console.log('Methods: get_protocol_tvl, get_chain_tvl, list_protocols')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
