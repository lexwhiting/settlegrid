/**
 * settlegrid-bestbuy — Best Buy MCP Server
 *
 * Wraps the Best Buy API with SettleGrid billing.
 * Requires BESTBUY_API_KEY environment variable.
 *
 * Methods:
 *   search_products(query)                (1¢)
 *   get_product(sku)                      (1¢)
 *   get_trending()                        (1¢)
 *   get_categories()                      (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; pageSize?: number }
interface GetProductInput { sku: string }

const API_BASE = "https://api.bestbuy.com/v1"
const USER_AGENT = "settlegrid-bestbuy/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.BESTBUY_API_KEY
  if (!key) throw new Error("BESTBUY_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set("apiKey", getApiKey())
  url.searchParams.set("format", "json")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Best Buy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "bestbuy",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_products: { costCents: 1, displayName: "Search Best Buy products" },
      get_product: { costCents: 1, displayName: "Get product by SKU" },
      get_trending: { costCents: 1, displayName: "Get trending products" },
      get_categories: { costCents: 1, displayName: "List product categories" },
    },
  },
})

const searchProducts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = { show: "sku,name,salePrice,url,image,customerReviewAverage" }
  if (args.pageSize !== undefined) params.pageSize = String(args.pageSize)
  return apiFetch<Record<string, unknown>>(`/products((search=${encodeURIComponent(args.query)}))`, params)
}, { method: "search_products" })

const getProduct = sg.wrap(async (args: GetProductInput) => {
  if (!args.sku || typeof args.sku !== "string") throw new Error("sku is required")
  return apiFetch<Record<string, unknown>>(`/products/${encodeURIComponent(args.sku)}.json`)
}, { method: "get_product" })

const getTrending = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/products/trendingViewed(categoryPath.id=abcat0100000)", { pageSize: "20" })
}, { method: "get_trending" })

const getCategories = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/categories", { pageSize: "50" })
}, { method: "get_categories" })

export { searchProducts, getProduct, getTrending, getCategories }

console.log("settlegrid-bestbuy MCP server ready")
console.log("Methods: search_products, get_product, get_trending, get_categories")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
