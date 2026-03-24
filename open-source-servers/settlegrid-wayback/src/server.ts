/**
 * settlegrid-wayback — Wayback Machine MCP Server
 *
 * Wraps the Wayback Machine API with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   check_url(url)                        (1¢)
 *   get_snapshots(url)                    (1¢)
 *   get_closest(url, timestamp)           (1¢)
 *   get_sparkline(url)                    (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface UrlInput { url: string }
interface ClosestInput { url: string; timestamp?: string }

const USER_AGENT = "settlegrid-wayback/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Wayback API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "wayback",
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_url: { costCents: 1, displayName: "Check if URL has snapshots" },
      get_snapshots: { costCents: 1, displayName: "List available snapshots" },
      get_closest: { costCents: 1, displayName: "Get closest snapshot to date" },
      get_sparkline: { costCents: 1, displayName: "Get capture frequency data" },
    },
  },
})

const checkUrl = sg.wrap(async (args: UrlInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  const data = await apiFetch<Record<string, unknown>>(`https://archive.org/wayback/available?url=${encodeURIComponent(args.url)}`)
  return { url: args.url, ...data }
}, { method: "check_url" })

const getSnapshots = sg.wrap(async (args: UrlInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  const data = await apiFetch<Record<string, unknown>>(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(args.url)}&output=json&limit=20`)
  if (!Array.isArray(data) || data.length < 2) return { url: args.url, count: 0, snapshots: [] }
  const headers = data[0] as string[]
  const rows = data.slice(1) as string[][]
  const snapshots = rows.map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })
  return { url: args.url, count: snapshots.length, snapshots }
}, { method: "get_snapshots" })

const getClosest = sg.wrap(async (args: ClosestInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  const ts = args.timestamp ?? new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)
  const data = await apiFetch<Record<string, unknown>>(`https://archive.org/wayback/available?url=${encodeURIComponent(args.url)}&timestamp=${ts}`)
  return { url: args.url, requested_timestamp: ts, ...data }
}, { method: "get_closest" })

const getSparkline = sg.wrap(async (args: UrlInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  const data = await apiFetch<Record<string, unknown>>(`https://web.archive.org/__wb/sparkline?output=json&url=${encodeURIComponent(args.url)}&collection=web`)
  return { url: args.url, ...data }
}, { method: "get_sparkline" })

export { checkUrl, getSnapshots, getClosest, getSparkline }

console.log("settlegrid-wayback MCP server ready")
console.log("Methods: check_url, get_snapshots, get_closest, get_sparkline")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
