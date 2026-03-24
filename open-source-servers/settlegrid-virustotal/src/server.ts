/**
 * settlegrid-virustotal — VirusTotal MCP Server
 *
 * Wraps the VirusTotal API with SettleGrid billing.
 * Requires VIRUSTOTAL_API_KEY environment variable.
 *
 * Methods:
 *   scan_url(url)                        (2¢)
 *   get_url_report(url)                  (1¢)
 *   get_ip_report(ip)                    (1¢)
 *   get_domain_report(domain)            (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScanUrlInput { url: string }
interface GetUrlReportInput { url: string }
interface GetIpReportInput { ip: string }
interface GetDomainReportInput { domain: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = "https://www.virustotal.com/api/v3"
const USER_AGENT = "settlegrid-virustotal/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.VIRUSTOTAL_API_KEY
  if (!key) throw new Error("VIRUSTOTAL_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
} = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    "x-apikey": getApiKey(),
  }
  const fetchOpts: RequestInit = { method: options.method ?? "GET", headers }
  if (options.body) {
    fetchOpts.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body)
    headers["Content-Type"] = "application/x-www-form-urlencoded"
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`VirusTotal API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: "virustotal",
  pricing: {
    defaultCostCents: 1,
    methods: {
      scan_url: { costCents: 2, displayName: "Submit URL for scanning" },
      get_url_report: { costCents: 1, displayName: "Get URL scan report" },
      get_ip_report: { costCents: 1, displayName: "Get IP address report" },
      get_domain_report: { costCents: 1, displayName: "Get domain report" },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const scanUrl = sg.wrap(async (args: ScanUrlInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  const data = await apiFetch<Record<string, unknown>>("/urls", {
    method: "POST",
    body: `url=${encodeURIComponent(args.url)}`,
  })
  return data
}, { method: "scan_url" })

const getUrlReport = sg.wrap(async (args: GetUrlReportInput) => {
  if (!args.url || typeof args.url !== "string") throw new Error("url is required")
  const urlId = Buffer.from(args.url).toString("base64").replace(/=/g, "")
  const data = await apiFetch<Record<string, unknown>>(`/urls/${urlId}`)
  return data
}, { method: "get_url_report" })

const getIpReport = sg.wrap(async (args: GetIpReportInput) => {
  if (!args.ip || typeof args.ip !== "string") throw new Error("ip is required")
  const data = await apiFetch<Record<string, unknown>>(`/ip_addresses/${encodeURIComponent(args.ip)}`)
  return data
}, { method: "get_ip_report" })

const getDomainReport = sg.wrap(async (args: GetDomainReportInput) => {
  if (!args.domain || typeof args.domain !== "string") throw new Error("domain is required")
  const data = await apiFetch<Record<string, unknown>>(`/domains/${encodeURIComponent(args.domain)}`)
  return data
}, { method: "get_domain_report" })

// ─── Exports ────────────────────────────────────────────────────────────────

export { scanUrl, getUrlReport, getIpReport, getDomainReport }

console.log("settlegrid-virustotal MCP server ready")
console.log("Methods: scan_url, get_url_report, get_ip_report, get_domain_report")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
