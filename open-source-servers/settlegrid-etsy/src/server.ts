/**
 * settlegrid-etsy — Etsy MCP Server
 *
 * Wraps the Etsy Open API v3 with SettleGrid billing.
 * Requires ETSY_API_KEY environment variable.
 *
 * Methods:
 *   search_listings(query)                (2¢)
 *   get_listing(listing_id)               (1¢)
 *   get_shop(shop_id)                     (1¢)
 *   get_trending_keywords()               (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; limit?: number; sort_on?: string }
interface GetListingInput { listing_id: string }
interface GetShopInput { shop_id: string }

const API_BASE = "https://openapi.etsy.com/v3/application"
const USER_AGENT = "settlegrid-etsy/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.ETSY_API_KEY
  if (!key) throw new Error("ETSY_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", "x-api-key": getApiKey() },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Etsy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "etsy",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_listings: { costCents: 2, displayName: "Search active listings" },
      get_listing: { costCents: 1, displayName: "Get listing details" },
      get_shop: { costCents: 1, displayName: "Get shop details" },
      get_trending_keywords: { costCents: 1, displayName: "Get trending search keywords" },
    },
  },
})

const searchListings = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = { keywords: args.query, limit: String(args.limit ?? 25) }
  if (args.sort_on) params.sort_on = args.sort_on
  return apiFetch<Record<string, unknown>>("/listings/active", params)
}, { method: "search_listings" })

const getListing = sg.wrap(async (args: GetListingInput) => {
  if (!args.listing_id || typeof args.listing_id !== "string") throw new Error("listing_id is required")
  return apiFetch<Record<string, unknown>>(`/listings/${encodeURIComponent(args.listing_id)}`)
}, { method: "get_listing" })

const getShop = sg.wrap(async (args: GetShopInput) => {
  if (!args.shop_id || typeof args.shop_id !== "string") throw new Error("shop_id is required")
  return apiFetch<Record<string, unknown>>(`/shops/${encodeURIComponent(args.shop_id)}`)
}, { method: "get_shop" })

const getTrendingKeywords = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/buyer-taxonomy/nodes/keywords")
}, { method: "get_trending_keywords" })

export { searchListings, getListing, getShop, getTrendingKeywords }

console.log("settlegrid-etsy MCP server ready")
console.log("Methods: search_listings, get_listing, get_shop, get_trending_keywords")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
