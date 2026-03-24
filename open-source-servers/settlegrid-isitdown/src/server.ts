/**
 * settlegrid-isitdown — Website Uptime Check MCP Server
 *
 * Checks website availability with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   check(domain)                         (1¢)
 *   check_batch(domains)                  (2¢)
 *   get_headers(domain)                   (1¢)
 *   measure_latency(domain)               (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface CheckInput { domain: string }
interface BatchInput { domains: string[] }

const USER_AGENT = "settlegrid-isitdown/1.0 (contact@settlegrid.ai)"

async function checkSite(domain: string): Promise<{ domain: string; is_up: boolean; status_code: number | null; response_time_ms: number; error?: string }> {
  const url = domain.startsWith("http") ? domain : `https://${domain}`
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: "HEAD", headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    })
    return { domain, is_up: res.ok || res.status < 500, status_code: res.status, response_time_ms: Date.now() - start }
  } catch (err) {
    return { domain, is_up: false, status_code: null, response_time_ms: Date.now() - start, error: String(err instanceof Error ? err.message : err).slice(0, 100) }
  }
}

const sg = settlegrid.init({
  toolSlug: "isitdown",
  pricing: {
    defaultCostCents: 1,
    methods: {
      check: { costCents: 1, displayName: "Check if website is up" },
      check_batch: { costCents: 2, displayName: "Check multiple websites" },
      get_headers: { costCents: 1, displayName: "Get HTTP response headers" },
      measure_latency: { costCents: 1, displayName: "Measure response time" },
    },
  },
})

const check = sg.wrap(async (args: CheckInput) => {
  if (!args.domain || typeof args.domain !== "string") throw new Error("domain is required")
  return checkSite(args.domain)
}, { method: "check" })

const checkBatch = sg.wrap(async (args: BatchInput) => {
  if (!Array.isArray(args.domains) || args.domains.length === 0) throw new Error("domains array is required")
  if (args.domains.length > 20) throw new Error("Maximum 20 domains per batch")
  const results = await Promise.all(args.domains.map(checkSite))
  const up = results.filter((r) => r.is_up).length
  return { total: results.length, up, down: results.length - up, results }
}, { method: "check_batch" })

const getHeaders = sg.wrap(async (args: CheckInput) => {
  if (!args.domain || typeof args.domain !== "string") throw new Error("domain is required")
  const url = args.domain.startsWith("http") ? args.domain : `https://${args.domain}`
  const res = await fetch(url, {
    method: "HEAD", headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000), redirect: "follow",
  })
  const headers: Record<string, string> = {}
  res.headers.forEach((v, k) => { headers[k] = v })
  return { domain: args.domain, status: res.status, headers }
}, { method: "get_headers" })

const measureLatency = sg.wrap(async (args: CheckInput) => {
  if (!args.domain || typeof args.domain !== "string") throw new Error("domain is required")
  const url = args.domain.startsWith("http") ? args.domain : `https://${args.domain}`
  const times: number[] = []
  for (let i = 0; i < 3; i++) {
    const start = Date.now()
    try {
      await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10000) })
      times.push(Date.now() - start)
    } catch { times.push(-1) }
  }
  const valid = times.filter((t) => t > 0)
  return {
    domain: args.domain, samples: times.length,
    min_ms: valid.length ? Math.min(...valid) : null,
    max_ms: valid.length ? Math.max(...valid) : null,
    avg_ms: valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null,
    raw_ms: times,
  }
}, { method: "measure_latency" })

export { check, checkBatch, getHeaders, measureLatency }

console.log("settlegrid-isitdown MCP server ready")
console.log("Methods: check, check_batch, get_headers, measure_latency")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
