/**
 * settlegrid-ipinfo — ipinfo MCP Server
 *
 * Wraps the ipinfo API with SettleGrid billing.
 * Requires IPINFO_TOKEN environment variable.
 *
 * Methods:
 *   lookup(ip)                               (1¢)
 *   get_my_ip()                              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupInput {
  ip: string
}

interface GetMyIpInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://ipinfo.io'
const USER_AGENT = 'settlegrid-ipinfo/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.IPINFO_TOKEN
  if (!key) throw new Error('IPINFO_TOKEN environment variable is required')
  return key
}

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
    Authorization: `Bearer ${getApiKey()}`,
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
    throw new Error(`ipinfo API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ipinfo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup: { costCents: 1, displayName: 'Get geolocation data for an IP' },
      get_my_ip: { costCents: 1, displayName: 'Get your own IP info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookup = sg.wrap(async (args: LookupInput) => {
  if (!args.ip || typeof args.ip !== 'string') {
    throw new Error('ip is required (ip address to lookup)')
  }

  const params: Record<string, string> = {}
  params['ip'] = String(args.ip)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.ip))}`, {
    params,
  })

  return data
}, { method: 'lookup' })

const getMyIp = sg.wrap(async (args: GetMyIpInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/json', {
    params,
  })

  return data
}, { method: 'get_my_ip' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookup, getMyIp }

console.log('settlegrid-ipinfo MCP server ready')
console.log('Methods: lookup, get_my_ip')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
