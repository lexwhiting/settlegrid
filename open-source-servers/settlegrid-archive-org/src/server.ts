/**
 * settlegrid-archive-org — Internet Archive MCP Server
 *
 * Wraps the Internet Archive API with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   search(query)                         (1¢)
 *   get_metadata(identifier)              (1¢)
 *   search_books(query)                   (1¢)
 *   search_audio(query)                   (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchInput { query: string; rows?: number; page?: number }
interface MetadataInput { identifier: string }

const API_BASE = "https://archive.org"
const USER_AGENT = "settlegrid-archive-org/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Internet Archive API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "archive-org",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: "Search Internet Archive" },
      get_metadata: { costCents: 1, displayName: "Get item metadata" },
      search_books: { costCents: 1, displayName: "Search books collection" },
      search_audio: { costCents: 1, displayName: "Search audio collection" },
    },
  },
})

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  return apiFetch<Record<string, unknown>>("/advancedsearch.php", {
    q: args.query, output: "json", rows: String(args.rows ?? 20), page: String(args.page ?? 1),
  })
}, { method: "search" })

const getMetadata = sg.wrap(async (args: MetadataInput) => {
  if (!args.identifier || typeof args.identifier !== "string") throw new Error("identifier is required")
  return apiFetch<Record<string, unknown>>(`/metadata/${encodeURIComponent(args.identifier)}`)
}, { method: "get_metadata" })

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  return apiFetch<Record<string, unknown>>("/advancedsearch.php", {
    q: `${args.query} AND mediatype:texts`, output: "json", rows: String(args.rows ?? 20),
  })
}, { method: "search_books" })

const searchAudio = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  return apiFetch<Record<string, unknown>>("/advancedsearch.php", {
    q: `${args.query} AND mediatype:audio`, output: "json", rows: String(args.rows ?? 20),
  })
}, { method: "search_audio" })

export { search, getMetadata, searchBooks, searchAudio }

console.log("settlegrid-archive-org MCP server ready")
console.log("Methods: search, get_metadata, search_books, search_audio")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
