/**
 * settlegrid-price-api — Price Comparison MCP Server
 *
 * Wraps the PriceAPI with SettleGrid billing.
 * Requires PRICEAPI_KEY environment variable.
 *
 * Methods:
 *   search_prices(query)                  (2¢)
 *   get_job(job_id)                       (1¢)
 *   get_product_price(url)                (2¢)
 *   compare_prices(query)                 (3¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; country?: string }
interface GetJobInput { job_id: string }
interface GetProductPriceInput { url: string }
interface ComparePricesInput { query: string; sources?: string[] }

const API_BASE = "https://api.priceapi.com/v2"
const USER_AGENT = "settlegrid-price-api/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.PRICEAPI_KEY
  if (!key) throw new Error("PRICEAPI_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string; params?: Record<string, string>; body?: unknown
} = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (options.params) for (const [k, v] of Object.entries(options.params)) url.searchParams.set(k, v)
  url.searchParams.set("token", getApiKey())
  const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "application/json" }
  const fetchOpts: RequestInit = { method: options.method ?? "GET", headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    headers["Content-Type"] = "application/json"
  }
  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`PriceAPI ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "price-api",
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_prices: { costCents: 2, displayName: "Search product prices" },
      get_job: { costCents: 1, displayName: "Get price job results" },
      get_product_price: { costCents: 2, displayName: "Get price for product URL" },
      compare_prices: { costCents: 3, displayName: "Compare prices across stores" },
    },
  },
})

const searchPrices = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  return apiFetch<Record<string, unknown>>("/jobs", {
    method: "POST",
    body: { source: "google_shopping", country: args.country ?? "us", topic: "search_results", key: args.query },
  })
}, { method: "search_prices" })

const getJob = sg.wrap(async (args: GetJobInput) => {
  if (!args.job_id || typeof args.job_id !== "string") throw new Error("job_id is required")
  return apiFetch<Record<string, unknown>>(`/jobs/${encodeURIComponent(args.job_id)}`)
}, { method: "get_job" })

const getProductPrice = sg.wrap(async (args: GetProductPriceInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  return apiFetch<Record<string, unknown>>("/jobs", {
    method: "POST",
    body: { source: "amazon", topic: "product_and_offers", key: args.url },
  })
}, { method: "get_product_price" })

const comparePrices = sg.wrap(async (args: ComparePricesInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const sources = args.sources ?? ["google_shopping", "amazon"]
  const results = await Promise.all(
    sources.map((source) =>
      apiFetch<Record<string, unknown>>("/jobs", {
        method: "POST",
        body: { source, topic: "search_results", key: args.query, country: "us" },
      })
    )
  )
  return { query: args.query, sources, results }
}, { method: "compare_prices" })

export { searchPrices, getJob, getProductPrice, comparePrices }

console.log("settlegrid-price-api MCP server ready")
console.log("Methods: search_prices, get_job, get_product_price, compare_prices")
console.log("Pricing: 1-3¢ per call | Powered by SettleGrid")
