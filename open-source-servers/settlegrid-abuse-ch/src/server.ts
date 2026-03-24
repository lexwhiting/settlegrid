/**
 * settlegrid-abuse-ch — abuse.ch Threat Feeds MCP Server
 *
 * Wraps abuse.ch APIs with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_urlhaus_recent()                  (1¢)
 *   check_url(url)                        (1¢)
 *   get_threatfox_iocs(days)              (2¢)
 *   get_feodo_trackers()                  (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface CheckUrlInput { url: string }
interface GetThreatfoxInput { days?: number }

const USER_AGENT = "settlegrid-abuse-ch/1.0 (contact@settlegrid.ai)"

async function apiPost<T>(baseUrl: string, body: Record<string, string>): Promise<T> {
  const form = new URLSearchParams(body)
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`abuse.ch API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "abuse-ch",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_urlhaus_recent: { costCents: 1, displayName: "Recent malware URLs" },
      check_url: { costCents: 1, displayName: "Check URL in URLhaus" },
      get_threatfox_iocs: { costCents: 2, displayName: "Get recent IOCs from ThreatFox" },
      get_feodo_trackers: { costCents: 1, displayName: "Active Feodo C&C servers" },
    },
  },
})

const getUrlhausRecent = sg.wrap(async () => {
  return apiPost<Record<string, unknown>>("https://urlhaus-api.abuse.ch/v1/urls/recent/", { limit: "25" })
}, { method: "get_urlhaus_recent" })

const checkUrl = sg.wrap(async (args: CheckUrlInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  return apiPost<Record<string, unknown>>("https://urlhaus-api.abuse.ch/v1/url/", { url: args.url })
}, { method: "check_url" })

const getThreatfoxIocs = sg.wrap(async (args: GetThreatfoxInput) => {
  const days = args.days ?? 1
  return apiPost<Record<string, unknown>>("https://threatfox-api.abuse.ch/api/v1/", {
    query: "get_iocs", days: String(days),
  })
}, { method: "get_threatfox_iocs" })

const getFeodoTrackers = sg.wrap(async () => {
  const res = await fetch("https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt", {
    headers: { "User-Agent": USER_AGENT },
  })
  if (!res.ok) throw new Error(`Feodo Tracker ${res.status}`)
  const text = await res.text()
  const ips = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"))
  return { source: "Feodo Tracker", type: "c2_servers", count: ips.length, ips: ips.slice(0, 200) }
}, { method: "get_feodo_trackers" })

export { getUrlhausRecent, checkUrl, getThreatfoxIocs, getFeodoTrackers }

console.log("settlegrid-abuse-ch MCP server ready")
console.log("Methods: get_urlhaus_recent, check_url, get_threatfox_iocs, get_feodo_trackers")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
