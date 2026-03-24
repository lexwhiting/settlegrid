/**
 * settlegrid-trustpilot — Trustpilot MCP Server
 *
 * Wraps the Trustpilot API with SettleGrid billing.
 * Requires TRUSTPILOT_API_KEY environment variable.
 *
 * Methods:
 *   search_business(query)                (1¢)
 *   get_business(domain)                  (1¢)
 *   get_reviews(business_id)              (2¢)
 *   get_categories()                      (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; country?: string }
interface GetBusinessInput { domain: string }
interface GetReviewsInput { business_id: string; page?: number; perPage?: number }

const API_BASE = "https://api.trustpilot.com/v1"
const USER_AGENT = "settlegrid-trustpilot/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.TRUSTPILOT_API_KEY
  if (!key) throw new Error("TRUSTPILOT_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set("apikey", getApiKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Trustpilot API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "trustpilot",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_business: { costCents: 1, displayName: "Search businesses" },
      get_business: { costCents: 1, displayName: "Get business by domain" },
      get_reviews: { costCents: 2, displayName: "Get business reviews" },
      get_categories: { costCents: 1, displayName: "List business categories" },
    },
  },
})

const searchBusiness = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = { query: args.query }
  if (args.country) params.country = args.country
  return apiFetch<Record<string, unknown>>("/business-units/search", params)
}, { method: "search_business" })

const getBusiness = sg.wrap(async (args: GetBusinessInput) => {
  if (!args.domain || typeof args.domain !== "string") throw new Error("domain is required")
  return apiFetch<Record<string, unknown>>(`/business-units/find`, { name: args.domain })
}, { method: "get_business" })

const getReviews = sg.wrap(async (args: GetReviewsInput) => {
  if (!args.business_id || typeof args.business_id !== "string") throw new Error("business_id is required")
  const params: Record<string, string> = {}
  if (args.page !== undefined) params.page = String(args.page)
  if (args.perPage !== undefined) params.perPage = String(args.perPage)
  return apiFetch<Record<string, unknown>>(`/business-units/${encodeURIComponent(args.business_id)}/reviews`, params)
}, { method: "get_reviews" })

const getCategories = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/categories", { country: "US" })
}, { method: "get_categories" })

export { searchBusiness, getBusiness, getReviews, getCategories }

console.log("settlegrid-trustpilot MCP server ready")
console.log("Methods: search_business, get_business, get_reviews, get_categories")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
