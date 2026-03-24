/**
 * settlegrid-shodan — Shodan MCP Server
 *
 * Wraps the Shodan API with SettleGrid billing.
 * Requires SHODAN_API_KEY environment variable.
 *
 * Methods:
 *   search_host(ip)                       (1¢)
 *   search_query(query)                   (2¢)
 *   get_ports(ip)                         (1¢)
 *   get_vuln(ip)                          (2¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface SearchHostInput { ip: string }
interface SearchQueryInput { query: string; page?: number }
interface GetPortsInput { ip: string }
interface GetVulnInput { ip: string }

const API_BASE = "https://api.shodan.io"
const USER_AGENT = "settlegrid-shodan/1.0 (contact@settlegrid.ai)"

function getApiKey(): string {
  const key = process.env.SHODAN_API_KEY
  if (!key) throw new Error("SHODAN_API_KEY environment variable is required")
  return key
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set("key", getApiKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Shodan API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "shodan",
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_host: { costCents: 1, displayName: "Get host information by IP" },
      search_query: { costCents: 2, displayName: "Search Shodan with query" },
      get_ports: { costCents: 1, displayName: "List open ports for an IP" },
      get_vuln: { costCents: 2, displayName: "Get known vulnerabilities for IP" },
    },
  },
})

const searchHost = sg.wrap(async (args: SearchHostInput) => {
  if (!args.ip || typeof args.ip !== "string") throw new Error("ip is required")
  return apiFetch<Record<string, unknown>>(`/shodan/host/${encodeURIComponent(args.ip)}`)
}, { method: "search_host" })

const searchQuery = sg.wrap(async (args: SearchQueryInput) => {
  if (!args.query || typeof args.query !== "string") throw new Error("query is required")
  const params: Record<string, string> = { query: args.query }
  if (args.page !== undefined) params.page = String(args.page)
  return apiFetch<Record<string, unknown>>("/shodan/host/search", params)
}, { method: "search_query" })

const getPorts = sg.wrap(async (args: GetPortsInput) => {
  if (!args.ip || typeof args.ip !== "string") throw new Error("ip is required")
  const data = await apiFetch<Record<string, unknown>>(`/shodan/host/${encodeURIComponent(args.ip)}`)
  const ports = Array.isArray((data as { ports?: number[] }).ports) ? (data as { ports: number[] }).ports : []
  return { ip: args.ip, ports, count: ports.length }
}, { method: "get_ports" })

const getVuln = sg.wrap(async (args: GetVulnInput) => {
  if (!args.ip || typeof args.ip !== "string") throw new Error("ip is required")
  const data = await apiFetch<Record<string, unknown>>(`/shodan/host/${encodeURIComponent(args.ip)}`)
  const vulns = Array.isArray((data as { vulns?: string[] }).vulns) ? (data as { vulns: string[] }).vulns : []
  return { ip: args.ip, vulnerabilities: vulns, count: vulns.length }
}, { method: "get_vuln" })

export { searchHost, searchQuery, getPorts, getVuln }

console.log("settlegrid-shodan MCP server ready")
console.log("Methods: search_host, search_query, get_ports, get_vuln")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
