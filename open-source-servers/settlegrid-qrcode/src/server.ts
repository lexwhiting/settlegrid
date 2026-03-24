/**
 * settlegrid-qrcode — QR Code Generator MCP Server
 *
 * Wraps the QR Code Generator API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   create_qr(data)                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateQrInput {
  data: string
  size?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.qrserver.com/v1'
const USER_AGENT = 'settlegrid-qrcode/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`QR Code Generator API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'qrcode',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_qr: { costCents: 1, displayName: 'Generate a QR code image URL' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const createQr = sg.wrap(async (args: CreateQrInput) => {
  if (!args.data || typeof args.data !== 'string') {
    throw new Error('data is required (data to encode (url, text, etc.))')
  }

  const params: Record<string, string> = {}
  params['data'] = args.data
  if (args.size !== undefined) params['size'] = String(args.size)

  const data = await apiFetch<Record<string, unknown>>('/create-qr-code/', {
    params,
  })

  return data
}, { method: 'create_qr' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { createQr }

console.log('settlegrid-qrcode MCP server ready')
console.log('Methods: create_qr')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
