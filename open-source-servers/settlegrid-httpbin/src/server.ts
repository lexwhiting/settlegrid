/**
 * settlegrid-httpbin — HTTPBin MCP Server
 *
 * Wraps the HTTPBin API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_ip()                                 (1¢)
 *   get_headers()                            (1¢)
 *   get_user_agent()                         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIpInput {
}

interface GetHeadersInput {
}

interface GetUserAgentInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://httpbin.org'
const USER_AGENT = 'settlegrid-httpbin/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTPBin API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'httpbin',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ip: { costCents: 1, displayName: 'Get your origin IP address' },
      get_headers: { costCents: 1, displayName: 'Get request headers' },
      get_user_agent: { costCents: 1, displayName: 'Get user agent string' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIp = sg.wrap(async (args: GetIpInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/ip', {
    params,
  })

  return data
}, { method: 'get_ip' })

const getHeaders = sg.wrap(async (args: GetHeadersInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/headers', {
    params,
  })

  return data
}, { method: 'get_headers' })

const getUserAgent = sg.wrap(async (args: GetUserAgentInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/user-agent', {
    params,
  })

  return data
}, { method: 'get_user_agent' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIp, getHeaders, getUserAgent }

console.log('settlegrid-httpbin MCP server ready')
console.log('Methods: get_ip, get_headers, get_user_agent')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
