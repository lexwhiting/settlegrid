/**
 * settlegrid-phishtank — PhishTank MCP Server
 *
 * Wraps the PhishTank API with SettleGrid billing.
 * Requires PHISHTANK_API_KEY environment variable.
 *
 * Methods:
 *   check_url(url)                        (1¢)
 *   get_phish(phish_id)                   (1¢)
 *   get_recent(limit)                     (2¢)
 *   check_status()                        (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface CheckUrlInput { url: string }
interface GetPhishInput { phish_id: string }
interface GetRecentInput { limit?: number }

const API_BASE = "https://checkurl.phishtank.com/checkurl/"
const USER_AGENT = "settlegrid-phishtank/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.PHISHTANK_API_KEY
  if (!key) throw new Error("PHISHTANK_API_KEY environment variable is required")
  return key
}

async function postCheck<T>(url: string): Promise<T> {
  const body = new URLSearchParams({
    url,
    format: "json",
    app_key: getApiKey(),
  })
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`PhishTank API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "phishtank",
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_url: { costCents: 1, displayName: "Check if URL is a known phish" },
      get_phish: { costCents: 1, displayName: "Get phish report details" },
      get_recent: { costCents: 2, displayName: "Get recent phishing submissions" },
      check_status: { costCents: 1, displayName: "Get PhishTank database status" },
    },
  },
})

const checkUrl = sg.wrap(async (args: CheckUrlInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  return postCheck<Record<string, unknown>>(args.url)
}, { method: "check_url" })

const getPhish = sg.wrap(async (args: GetPhishInput) => {
  if (!args.phish_id || typeof args.phish_id !== "string") throw new Error("phish_id is required")
  const res = await fetch(`https://data.phishtank.com/data/${getApiKey()}/online-valid.json`, {
    headers: { "User-Agent": USER_AGENT },
  })
  if (!res.ok) throw new Error(`PhishTank API ${res.status}`)
  const data = await res.json() as Array<Record<string, unknown>>
  const entry = data.find((e) => String(e.phish_id) === args.phish_id)
  if (!entry) throw new Error(`Phish ID ${args.phish_id} not found`)
  return entry
}, { method: "get_phish" })

const getRecent = sg.wrap(async (args: GetRecentInput) => {
  const limit = args.limit ?? 20
  const res = await fetch(`https://data.phishtank.com/data/${getApiKey()}/online-valid.json`, {
    headers: { "User-Agent": USER_AGENT },
  })
  if (!res.ok) throw new Error(`PhishTank API ${res.status}`)
  const data = await res.json() as Array<Record<string, unknown>>
  return { count: Math.min(limit, data.length), results: data.slice(0, limit) }
}, { method: "get_recent" })

const checkStatus = sg.wrap(async () => {
  const res = await fetch("https://data.phishtank.com/data/online-valid.json.gz", { method: "HEAD" })
  return {
    available: res.ok,
    last_modified: res.headers.get("last-modified") ?? "unknown",
    content_length: res.headers.get("content-length") ?? "unknown",
  }
}, { method: "check_status" })

export { checkUrl, getPhish, getRecent, checkStatus }

console.log("settlegrid-phishtank MCP server ready")
console.log("Methods: check_url, get_phish, get_recent, check_status")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
