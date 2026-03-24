/**
 * settlegrid-amazon-prices — Amazon Price Tracking MCP Server
 *
 * Wraps the Rainforest API with SettleGrid billing.
 * Requires RAINFOREST_API_KEY environment variable.
 *
 * Methods:
 *   search_products(query)                (2¢)
 *   get_product(asin)                     (1¢)
 *   get_price_history(asin)               (2¢)
 *   get_bestsellers(category)             (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; page?: number }
interface GetProductInput { asin: string }
interface GetPriceHistoryInput { asin: string }
interface GetBestsellersInput { category: string }

const API_BASE = "https://api.rainforestapi.com/request"
const USER_AGENT = "settlegrid-amazon-prices/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.RAINFOREST_API_KEY
  if (!key) throw new Error("RAINFOREST_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  url.searchParams.set("api_key", getApiKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Rainforest API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "amazon-prices",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_products: { costCents: 2, displayName: "Search Amazon products" },
      get_product: { costCents: 1, displayName: "Get product details by ASIN" },
      get_price_history: { costCents: 2, displayName: "Get price history for ASIN" },
      get_bestsellers: { costCents: 1, displayName: "Get bestseller rankings" },
    },
  },
})

const searchProducts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = { type: "search", amazon_domain: "amazon.com", search_term: args.query }
  if (args.page !== undefined) params.page = String(args.page)
  return apiFetch<Record<string, unknown>>(params)
}, { method: "search_products" })

const getProduct = sg.wrap(async (args: GetProductInput) => {
  if (!args.asin || typeof args.asin !== "string") throw new Error("asin is required")
  return apiFetch<Record<string, unknown>>({ type: "product", amazon_domain: "amazon.com", asin: args.asin })
}, { method: "get_product" })

const getPriceHistory = sg.wrap(async (args: GetPriceHistoryInput) => {
  if (!args.asin || typeof args.asin !== "string") throw new Error("asin is required")
  return apiFetch<Record<string, unknown>>({ type: "product", amazon_domain: "amazon.com", asin: args.asin, include_price_history: "true" })
}, { method: "get_price_history" })

const getBestsellers = sg.wrap(async (args: GetBestsellersInput) => {
  if (!args.category || typeof args.category !== "string") throw new Error("category is required")
  return apiFetch<Record<string, unknown>>({ type: "bestsellers", amazon_domain: "amazon.com", category_id: args.category })
}, { method: "get_bestsellers" })

export { searchProducts, getProduct, getPriceHistory, getBestsellers }

console.log("settlegrid-amazon-prices MCP server ready")
console.log("Methods: search_products, get_product, get_price_history, get_bestsellers")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
