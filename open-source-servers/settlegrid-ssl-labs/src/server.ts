/**
 * settlegrid-ssl-labs — SSL Labs MCP Server
 *
 * SSL/TLS certificate testing and grading via Qualys SSL Labs.
 *
 * Methods:
 *   analyze_host(host)            — Start or retrieve SSL/TLS analysis for a host  (1¢)
 *   get_endpoint(host, ip)        — Get detailed endpoint results from an analysis  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AnalyzeHostInput {
  host: string
}

interface GetEndpointInput {
  host: string
  ip: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.ssllabs.com/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-ssl-labs/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SSL Labs API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ssl-labs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      analyze_host: { costCents: 1, displayName: 'Analyze Host' },
      get_endpoint: { costCents: 1, displayName: 'Get Endpoint' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const analyzeHost = sg.wrap(async (args: AnalyzeHostInput) => {
  if (!args.host || typeof args.host !== 'string') throw new Error('host is required')
  const host = args.host.trim()
  const data = await apiFetch<any>(`/analyze?host=${encodeURIComponent(host)}&all=done`)
  return {
    host: data.host,
    port: data.port,
    protocol: data.protocol,
    status: data.status,
    startTime: data.startTime,
    testTime: data.testTime,
    endpoints: data.endpoints,
  }
}, { method: 'analyze_host' })

const getEndpoint = sg.wrap(async (args: GetEndpointInput) => {
  if (!args.host || typeof args.host !== 'string') throw new Error('host is required')
  const host = args.host.trim()
  if (!args.ip || typeof args.ip !== 'string') throw new Error('ip is required')
  const ip = args.ip.trim()
  const data = await apiFetch<any>(`/getEndpointData?host=${encodeURIComponent(host)}&s=${encodeURIComponent(ip)}`)
  return {
    ipAddress: data.ipAddress,
    grade: data.grade,
    gradeTrustIgnored: data.gradeTrustIgnored,
    hasWarnings: data.hasWarnings,
    details: data.details,
  }
}, { method: 'get_endpoint' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { analyzeHost, getEndpoint }

console.log('settlegrid-ssl-labs MCP server ready')
console.log('Methods: analyze_host, get_endpoint')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
