/**
 * settlegrid-nft-data — NFT Collection Data MCP Server
 *
 * Wraps the free CoinGecko NFT API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_collection(slug)    — Collection stats and metadata  (2¢)
 *   get_floor_price(slug)   — Current floor price            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CollectionInput {
  slug: string
}

interface CoinGeckoNft {
  id: string
  name: string
  symbol: string
  floor_price: { native_currency: number; usd: number }
  market_cap: { native_currency: number; usd: number }
  volume_24h: { native_currency: number; usd: number }
  number_of_unique_addresses: number
  total_supply: number
  description: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CG_BASE = 'https://api.coingecko.com/api/v3'

async function cgFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${CG_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CoinGecko API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateSlug(slug: unknown): string {
  if (!slug || typeof slug !== 'string') {
    throw new Error('slug is required (e.g. "bored-ape-yacht-club")')
  }
  const cleaned = slug.toLowerCase().trim()
  if (!/^[a-z0-9-]+$/.test(cleaned)) {
    throw new Error('slug must contain only lowercase letters, numbers, and hyphens')
  }
  return cleaned
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nft-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_collection: { costCents: 2, displayName: 'Collection Stats' },
      get_floor_price: { costCents: 1, displayName: 'Floor Price' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCollection = sg.wrap(async (args: CollectionInput) => {
  const slug = validateSlug(args.slug)

  const nft = await cgFetch<CoinGeckoNft>(`/nfts/${encodeURIComponent(slug)}`)

  return {
    id: nft.id,
    name: nft.name,
    symbol: nft.symbol,
    description: nft.description?.slice(0, 500) || null,
    floorPrice: {
      eth: nft.floor_price?.native_currency ?? null,
      usd: nft.floor_price?.usd ?? null,
    },
    marketCap: {
      eth: nft.market_cap?.native_currency ?? null,
      usd: nft.market_cap?.usd ?? null,
    },
    volume24h: {
      eth: nft.volume_24h?.native_currency ?? null,
      usd: nft.volume_24h?.usd ?? null,
    },
    holders: nft.number_of_unique_addresses ?? null,
    totalSupply: nft.total_supply ?? null,
  }
}, { method: 'get_collection' })

const getFloorPrice = sg.wrap(async (args: CollectionInput) => {
  const slug = validateSlug(args.slug)

  const nft = await cgFetch<CoinGeckoNft>(`/nfts/${encodeURIComponent(slug)}`)

  return {
    collection: nft.name,
    floorPrice: {
      eth: nft.floor_price?.native_currency ?? null,
      usd: nft.floor_price?.usd ?? null,
    },
    timestamp: new Date().toISOString(),
  }
}, { method: 'get_floor_price' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCollection, getFloorPrice }

console.log('settlegrid-nft-data MCP server ready')
console.log('Methods: get_collection, get_floor_price')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
