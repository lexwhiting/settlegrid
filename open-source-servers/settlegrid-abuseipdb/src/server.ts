/**
 * settlegrid-abuseipdb — AbuseIPDB MCP Server
 *
 * Wraps the AbuseIPDB API with SettleGrid billing.
 * Requires ABUSEIPDB_API_KEY environment variable.
 *
 * Methods:
 *   check_ip(ip)                          (1¢)
 *   get_blacklist(limit)                  (2¢)
 *   check_cidr(network)                   (2¢)
 *   get_categories()                      (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface CheckIpInput { ip: string; maxAgeInDays?: number }
interface GetBlacklistInput { limit?: number; confidenceMinimum?: number }
interface CheckCidrInput { network: string; maxAgeInDays?: number }

const API_BASE = "https://api.abuseipdb.com/api/v2"
const USER_AGENT = "settlegrid-abuseipdb/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.ABUSEIPDB_API_KEY
  if (!key) throw new Error("ABUSEIPDB_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", Key: getApiKey() },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`AbuseIPDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "abuseipdb",
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_ip: { costCents: 1, displayName: "Check abuse reports for an IP" },
      get_blacklist: { costCents: 2, displayName: "Get blacklisted IPs" },
      check_cidr: { costCents: 2, displayName: "Check abuse for CIDR range" },
      get_categories: { costCents: 1, displayName: "List abuse categories" },
    },
  },
})

const checkIp = sg.wrap(async (args: CheckIpInput) => {
  if (!args.ip || typeof args.ip !== "string") throw new Error("ip is required")
  const params: Record<string, string> = { ipAddress: args.ip, verbose: "true" }
  if (args.maxAgeInDays !== undefined) params.maxAgeInDays = String(args.maxAgeInDays)
  return apiFetch<Record<string, unknown>>("/check", params)
}, { method: "check_ip" })

const getBlacklist = sg.wrap(async (args: GetBlacklistInput) => {
  const params: Record<string, string> = {}
  if (args.limit !== undefined) params.limit = String(args.limit)
  if (args.confidenceMinimum !== undefined) params.confidenceMinimum = String(args.confidenceMinimum)
  return apiFetch<Record<string, unknown>>("/blacklist", params)
}, { method: "get_blacklist" })

const checkCidr = sg.wrap(async (args: CheckCidrInput) => {
  if (!args.network || typeof args.network !== "string") throw new Error("network is required")
  const params: Record<string, string> = { network: args.network }
  if (args.maxAgeInDays !== undefined) params.maxAgeInDays = String(args.maxAgeInDays)
  return apiFetch<Record<string, unknown>>("/check-block", params)
}, { method: "check_cidr" })

const getCategories = sg.wrap(async () => {
  return {
    categories: [
      { id: 1, title: "DNS Compromise" }, { id: 2, title: "DNS Poisoning" },
      { id: 3, title: "Fraud Orders" }, { id: 4, title: "DDoS Attack" },
      { id: 5, title: "FTP Brute-Force" }, { id: 6, title: "Ping of Death" },
      { id: 7, title: "Phishing" }, { id: 8, title: "Fraud VoIP" },
      { id: 9, title: "Open Proxy" }, { id: 10, title: "Web Spam" },
      { id: 11, title: "Email Spam" }, { id: 14, title: "Port Scan" },
      { id: 15, title: "Hacking" }, { id: 18, title: "Brute-Force" },
      { id: 22, title: "SSH" }, { id: 23, title: "IoT Targeted" },
    ],
  }
}, { method: "get_categories" })

export { checkIp, getBlacklist, checkCidr, getCategories }

console.log("settlegrid-abuseipdb MCP server ready")
console.log("Methods: check_ip, get_blacklist, check_cidr, get_categories")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
