/**
 * settlegrid-g2-reviews — G2 Software Reviews MCP Server
 *
 * Wraps the G2 API with SettleGrid billing.
 * Requires G2_API_TOKEN environment variable.
 *
 * Methods:
 *   search_products(query)                (1¢)
 *   get_product(product_id)               (1¢)
 *   get_reviews(product_id)               (2¢)
 *   get_categories()                      (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; limit?: number }
interface GetProductInput { product_id: string }
interface GetReviewsInput { product_id: string; page?: number }

const API_BASE = "https://data.g2.com/api/v1"
const USER_AGENT = "settlegrid-g2-reviews/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.G2_API_TOKEN
  if (!key) throw new Error("G2_API_TOKEN environment variable is required")
  return key
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/vnd.api+json",
      Authorization: `Token token=${getApiKey()}`,
      "Content-Type": "application/vnd.api+json",
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`G2 API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "g2-reviews",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_products: { costCents: 1, displayName: "Search software products" },
      get_product: { costCents: 1, displayName: "Get product details" },
      get_reviews: { costCents: 2, displayName: "Get product reviews" },
      get_categories: { costCents: 1, displayName: "List software categories" },
    },
  },
})

const searchProducts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = { "filter[name]": args.query }
  if (args.limit !== undefined) params["page[size]"] = String(args.limit)
  return apiFetch<Record<string, unknown>>("/products", params)
}, { method: "search_products" })

const getProduct = sg.wrap(async (args: GetProductInput) => {
  if (!args.product_id || typeof args.product_id !== "string") throw new Error("product_id is required")
  return apiFetch<Record<string, unknown>>(`/products/${encodeURIComponent(args.product_id)}`)
}, { method: "get_product" })

const getReviews = sg.wrap(async (args: GetReviewsInput) => {
  if (!args.product_id || typeof args.product_id !== "string") throw new Error("product_id is required")
  const params: Record<string, string> = { "filter[product_id]": args.product_id }
  if (args.page !== undefined) params["page[number]"] = String(args.page)
  return apiFetch<Record<string, unknown>>("/survey-responses", params)
}, { method: "get_reviews" })

const getCategories = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/categories", { "page[size]": "50" })
}, { method: "get_categories" })

export { searchProducts, getProduct, getReviews, getCategories }

console.log("settlegrid-g2-reviews MCP server ready")
console.log("Methods: search_products, get_product, get_reviews, get_categories")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
