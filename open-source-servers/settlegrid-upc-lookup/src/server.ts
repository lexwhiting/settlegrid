/**
 * settlegrid-upc-lookup — UPC/Barcode Lookup MCP Server
 *
 * Wraps the UPC Database API with SettleGrid billing.
 * Requires UPC_API_KEY environment variable.
 *
 * Methods:
 *   lookup_upc(upc)                       (1¢)
 *   lookup_ean(ean)                       (1¢)
 *   lookup_isbn(isbn)                     (1¢)
 *   search_product(query)                 (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface LookupUpcInput { upc: string }
interface LookupEanInput { ean: string }
interface LookupIsbnInput { isbn: string }
interface SearchInput { query: string }

const API_BASE = "https://api.upcdatabase.org"
const USER_AGENT = "settlegrid-upc-lookup/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.UPC_API_KEY
  if (!key) throw new Error("UPC_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", Authorization: `Bearer ${getApiKey()}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`UPC Database API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "upc-lookup",
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_upc: { costCents: 1, displayName: "Look up product by UPC code" },
      lookup_ean: { costCents: 1, displayName: "Look up product by EAN code" },
      lookup_isbn: { costCents: 1, displayName: "Look up book by ISBN" },
      search_product: { costCents: 1, displayName: "Search products by name" },
    },
  },
})

const lookupUpc = sg.wrap(async (args: LookupUpcInput) => {
  if (!args.upc || typeof args.upc !== "string") throw new Error("upc is required")
  if (!/^\d{12}$/.test(args.upc)) throw new Error("UPC must be a 12-digit number")
  return apiFetch<Record<string, unknown>>(`/product/${args.upc}`)
}, { method: "lookup_upc" })

const lookupEan = sg.wrap(async (args: LookupEanInput) => {
  if (!args.ean || typeof args.ean !== "string") throw new Error("ean is required")
  if (!/^\d{13}$/.test(args.ean)) throw new Error("EAN must be a 13-digit number")
  return apiFetch<Record<string, unknown>>(`/product/${args.ean}`)
}, { method: "lookup_ean" })

const lookupIsbn = sg.wrap(async (args: LookupIsbnInput) => {
  if (!args.isbn || typeof args.isbn !== "string") throw new Error("isbn is required")
  return apiFetch<Record<string, unknown>>(`/product/${args.isbn.replace(/-/g, "")}`)
}, { method: "lookup_isbn" })

const searchProduct = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  return apiFetch<Record<string, unknown>>(`/search/${encodeURIComponent(args.query)}`)
}, { method: "search_product" })

export { lookupUpc, lookupEan, lookupIsbn, searchProduct }

console.log("settlegrid-upc-lookup MCP server ready")
console.log("Methods: lookup_upc, lookup_ean, lookup_isbn, search_product")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
