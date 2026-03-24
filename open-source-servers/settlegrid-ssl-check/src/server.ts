/**
 * settlegrid-ssl-check — SSL Certificate Check MCP Server
 *
 * Wraps Qualys SSL Labs API with SettleGrid billing.
 * No API key needed — SSL Labs API is free.
 *
 * Methods:
 *   analyze(host) — Start SSL analysis (2¢)
 *   get_status(host) — Analysis status (1¢)
 *   get_endpoint(host, ip) — Endpoint details (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AnalyzeInput { host: string }
interface StatusInput { host: string }
interface EndpointInput { host: string; ip: string }

interface SslEndpoint {
  ipAddress: string
  grade: string
  gradeTrustIgnored: string
  hasWarnings: boolean
  isExceptional: boolean
  progress: number
  statusMessage: string
}

interface SslAnalysis {
  host: string
  port: number
  protocol: string
  status: string
  endpoints?: SslEndpoint[]
  startTime: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.ssllabs.com/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateHost(host: string): string {
  const h = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[:\/].*$/, '')
  if (!h.includes('.')) throw new Error('Invalid hostname')
  return h
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ssl-check',
  pricing: {
    defaultCostCents: 1,
    methods: {
      analyze: { costCents: 2, displayName: 'SSL Analyze' },
      get_status: { costCents: 1, displayName: 'Analysis Status' },
      get_endpoint: { costCents: 2, displayName: 'Endpoint Detail' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const analyze = sg.wrap(async (args: AnalyzeInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const data = await apiFetch<SslAnalysis>(`/analyze?host=${host}&startNew=on&all=done`)
  return {
    host: data.host,
    status: data.status,
    endpoints: data.endpoints?.map(e => ({
      ip: e.ipAddress,
      grade: e.grade,
      progress: e.progress,
      status: e.statusMessage,
    })) || [],
    message: data.status === 'DNS' ? 'Analysis started, check status in 60-90 seconds' : undefined,
  }
}, { method: 'analyze' })

const getStatus = sg.wrap(async (args: StatusInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const data = await apiFetch<SslAnalysis>(`/analyze?host=${host}&all=done`)
  return {
    host: data.host,
    status: data.status,
    endpoints: data.endpoints?.map(e => ({
      ip: e.ipAddress,
      grade: e.grade,
      warnings: e.hasWarnings,
      progress: e.progress,
      status: e.statusMessage,
    })) || [],
  }
}, { method: 'get_status' })

const getEndpoint = sg.wrap(async (args: EndpointInput) => {
  if (!args.host) throw new Error('host is required')
  if (!args.ip) throw new Error('ip is required')
  const host = validateHost(args.host)
  const data = await apiFetch<any>(`/getEndpointData?host=${host}&s=${args.ip}`)
  return {
    host,
    ip: args.ip,
    grade: data.grade,
    details: data.details,
    cert: data.cert,
    protocols: data.protocols,
  }
}, { method: 'get_endpoint' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { analyze, getStatus, getEndpoint }

console.log('settlegrid-ssl-check MCP server ready')
console.log('Methods: analyze, get_status, get_endpoint')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
