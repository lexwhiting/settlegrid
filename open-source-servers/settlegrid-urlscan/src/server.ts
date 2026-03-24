/**
 * settlegrid-urlscan — urlscan.io MCP Server
 *
 * Wraps the urlscan.io API with SettleGrid billing.
 * Requires URLSCAN_API_KEY environment variable.
 *
 * Methods:
 *   submit_scan(url)                      (2¢)
 *   get_result(uuid)                      (1¢)
 *   search_scans(query)                   (1¢)
 *   get_screenshot(uuid)                  (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SubmitScanInput { url: string; visibility?: string }
interface GetResultInput { uuid: string }
interface SearchScansInput { query: string; size?: number }
interface GetScreenshotInput { uuid: string }

const API_BASE = "https://urlscan.io/api/v1"
const USER_AGENT = "settlegrid-urlscan/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.URLSCAN_API_KEY
  if (!key) throw new Error("URLSCAN_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string; params?: Record<string, string>; body?: unknown
} = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) url.searchParams.set(k, v)
  }
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT, Accept: "application/json", "API-Key": getApiKey(),
  }
  const fetchOpts: RequestInit = { method: options.method ?? "GET", headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    headers["Content-Type"] = "application/json"
  }
  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`urlscan.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "urlscan",
  pricing: {
    defaultCostCents: 1,
    methods: {
      submit_scan: { costCents: 2, displayName: "Submit URL for scanning" },
      get_result: { costCents: 1, displayName: "Get scan result by UUID" },
      search_scans: { costCents: 1, displayName: "Search existing scans" },
      get_screenshot: { costCents: 1, displayName: "Get screenshot URL" },
    },
  },
})

const submitScan = sg.wrap(async (args: SubmitScanInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  return apiFetch<Record<string, unknown>>("/scan/", {
    method: "POST",
    body: { url: args.url, visibility: args.visibility ?? "public" },
  })
}, { method: "submit_scan" })

const getResult = sg.wrap(async (args: GetResultInput) => {
  if (!args.uuid || typeof args.uuid !== "string") throw new Error("uuid is required")
  return apiFetch<Record<string, unknown>>(`/result/${encodeURIComponent(args.uuid)}/`)
}, { method: "get_result" })

const searchScans = sg.wrap(async (args: SearchScansInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = { q: args.query }
  if (args.size !== undefined) params.size = String(args.size)
  return apiFetch<Record<string, unknown>>("/search/", { params })
}, { method: "search_scans" })

const getScreenshot = sg.wrap(async (args: GetScreenshotInput) => {
  if (!args.uuid || typeof args.uuid !== "string") throw new Error("uuid is required")
  return { uuid: args.uuid, screenshot_url: `https://urlscan.io/screenshots/${args.uuid}.png` }
}, { method: "get_screenshot" })

export { submitScan, getResult, searchScans, getScreenshot }

console.log("settlegrid-urlscan MCP server ready")
console.log("Methods: submit_scan, get_result, search_scans, get_screenshot")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
