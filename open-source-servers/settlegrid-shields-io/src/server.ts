/**
 * settlegrid-shields-io — Shields.io MCP Server
 *
 * Wraps the Shields.io API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   create_badge(label, message, color)      (1¢)
 *   get_npm_version(package)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateBadgeInput {
  label: string
  message: string
  color: string
}

interface GetNpmVersionInput {
  package: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://img.shields.io'
const USER_AGENT = 'settlegrid-shields-io/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Shields.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'shields-io',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_badge: { costCents: 1, displayName: 'Create a custom SVG badge' },
      get_npm_version: { costCents: 1, displayName: 'Get npm package version badge URL' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const createBadge = sg.wrap(async (args: CreateBadgeInput) => {
  if (!args.label || typeof args.label !== 'string') {
    throw new Error('label is required (badge label text)')
  }
  if (!args.message || typeof args.message !== 'string') {
    throw new Error('message is required (badge message text)')
  }
  if (!args.color || typeof args.color !== 'string') {
    throw new Error('color is required (badge color (green, red, blue, hex))')
  }

  const params: Record<string, string> = {}
  params['label'] = String(args.label)
  params['message'] = String(args.message)
  params['color'] = String(args.color)

  const data = await apiFetch<Record<string, unknown>>(`/badge/${encodeURIComponent(String(args.label))}-${encodeURIComponent(String(args.message))}-${encodeURIComponent(String(args.color))}`, {
    params,
  })

  return data
}, { method: 'create_badge' })

const getNpmVersion = sg.wrap(async (args: GetNpmVersionInput) => {
  if (!args.package || typeof args.package !== 'string') {
    throw new Error('package is required (npm package name)')
  }

  const params: Record<string, string> = {}
  params['package'] = String(args.package)

  const data = await apiFetch<Record<string, unknown>>(`/npm/v/${encodeURIComponent(String(args.package))}`, {
    params,
  })

  return data
}, { method: 'get_npm_version' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { createBadge, getNpmVersion }

console.log('settlegrid-shields-io MCP server ready')
console.log('Methods: create_badge, get_npm_version')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
