/**
 * settlegrid-walmart — Walmart MCP Server
 *
 * Wraps the BlueCart API for Walmart data with SettleGrid billing.
 * Requires BLUECART_API_KEY environment variable.
 *
 * Methods:
 *   search_products(query)                (2¢)
 *   get_product(item_id)                  (1¢)
 *   get_reviews(item_id)                  (1¢)
 *   get_categories()                      (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; page?: number }
interface GetProductInput { item_id: string }
interface GetReviewsInput { item_id: string }

const API_BASE = "https://api.bluecartapi.com/request"
const USER_AGENT = "settlegrid-walmart/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.BLUECART_API_KEY
  if (!key) throw new Error("BLUECART_API_KEY environment variable is required")
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
    throw new Error(`BlueCart API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "walmart",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_products: { costCents: 2, displayName: "Search Walmart products" },
      get_product: { costCents: 1, displayName: "Get product by item ID" },
      get_reviews: { costCents: 1, displayName: "Get product reviews" },
      get_categories: { costCents: 1, displayName: "List product categories" },
    },
  },
})

const searchProducts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = { type: "search", search_term: args.query }
  if (args.page !== undefined) params.page = String(args.page)
  return apiFetch<Record<string, unknown>>(params)
}, { method: "search_products" })

const getProduct = sg.wrap(async (args: GetProductInput) => {
  if (!args.item_id || typeof args.item_id !== "string") throw new Error("item_id is required")
  return apiFetch<Record<string, unknown>>({ type: "product", item_id: args.item_id })
}, { method: "get_product" })

const getReviews = sg.wrap(async (args: GetReviewsInput) => {
  if (!args.item_id || typeof args.item_id !== "string") throw new Error("item_id is required")
  return apiFetch<Record<string, unknown>>({ type: "reviews", item_id: args.item_id })
}, { method: "get_reviews" })

const getCategories = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>({ type: "category", category_id: "0" })
}, { method: "get_categories" })

export { searchProducts, getProduct, getReviews, getCategories }

console.log("settlegrid-walmart MCP server ready")
console.log("Methods: search_products, get_product, get_reviews, get_categories")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
