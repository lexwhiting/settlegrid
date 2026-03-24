/**
 * settlegrid-ebay — eBay MCP Server
 *
 * Wraps the eBay Finding API with SettleGrid billing.
 * Requires EBAY_APP_ID environment variable.
 *
 * Methods:
 *   search_items(query)                   (2¢)
 *   get_item(item_id)                     (1¢)
 *   get_item_by_upc(upc)                 (1¢)
 *   get_trending(category)               (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; limit?: number; sort?: string }
interface GetItemInput { item_id: string }
interface GetByUpcInput { upc: string }
interface GetTrendingInput { category?: string }

const API_BASE = "https://svcs.ebay.com/services/search/FindingService/v1"
const USER_AGENT = "settlegrid-ebay/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.EBAY_APP_ID
  if (!key) throw new Error("EBAY_APP_ID environment variable is required")
  return key
}

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  url.searchParams.set("SECURITY-APPNAME", getApiKey())
  url.searchParams.set("RESPONSE-DATA-FORMAT", "JSON")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`eBay API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "ebay",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_items: { costCents: 2, displayName: "Search eBay items" },
      get_item: { costCents: 1, displayName: "Get item details" },
      get_item_by_upc: { costCents: 1, displayName: "Find item by UPC" },
      get_trending: { costCents: 1, displayName: "Get trending items" },
    },
  },
})

const searchItems = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = {
    "OPERATION-NAME": "findItemsByKeywords",
    keywords: args.query,
    "paginationInput.entriesPerPage": String(args.limit ?? 20),
  }
  if (args.sort) params.sortOrder = args.sort
  return apiFetch<Record<string, unknown>>(params)
}, { method: "search_items" })

const getItem = sg.wrap(async (args: GetItemInput) => {
  if (!args.item_id || typeof args.item_id !== "string") throw new Error("item_id is required")
  const url = new URL("https://open.api.ebay.com/shopping")
  url.searchParams.set("callname", "GetSingleItem")
  url.searchParams.set("responseencoding", "JSON")
  url.searchParams.set("appid", getApiKey())
  url.searchParams.set("siteid", "0")
  url.searchParams.set("version", "967")
  url.searchParams.set("ItemID", args.item_id)
  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) throw new Error(`eBay API ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}, { method: "get_item" })

const getItemByUpc = sg.wrap(async (args: GetByUpcInput) => {
  if (!args.upc || typeof args.upc !== "string") throw new Error("upc is required")
  return apiFetch<Record<string, unknown>>({
    "OPERATION-NAME": "findItemsByProduct",
    "productId.@type": "UPC",
    "productId": args.upc,
  })
}, { method: "get_item_by_upc" })

const getTrending = sg.wrap(async (args: GetTrendingInput) => {
  const params: Record<string, string> = {
    "OPERATION-NAME": "getSearchKeywordsRecommendation",
    keywords: args.category ?? "electronics",
  }
  return apiFetch<Record<string, unknown>>(params)
}, { method: "get_trending" })

export { searchItems, getItem, getItemByUpc, getTrending }

console.log("settlegrid-ebay MCP server ready")
console.log("Methods: search_items, get_item, get_item_by_upc, get_trending")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
