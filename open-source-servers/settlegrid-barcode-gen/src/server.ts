/**
 * settlegrid-barcode-gen — Barcode Generator MCP Server
 *
 * Generate barcodes and QR codes via barcodeapi.org.
 *
 * Methods:
 *   generate(data, type)          — Generate a barcode image URL  (1¢)
 *   generate_qr(data)             — Generate a QR code image URL  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateInput {
  data: string
  type?: string
}

interface GenerateQrInput {
  data: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://barcodeapi.org/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-barcode-gen/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Barcode Generator API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'barcode-gen',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate: { costCents: 1, displayName: 'Generate Barcode' },
      generate_qr: { costCents: 1, displayName: 'Generate QR' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generate = sg.wrap(async (args: GenerateInput) => {
  if (!args.data || typeof args.data !== 'string') throw new Error('data is required')
  const data = args.data.trim()
  const type = typeof args.type === 'string' ? args.type.trim() : ''
  const data = await apiFetch<any>(`/${encodeURIComponent(type)}/${encodeURIComponent(data)}`)
  return {
    url: data.url,
    type: data.type,
    data: data.data,
  }
}, { method: 'generate' })

const generateQr = sg.wrap(async (args: GenerateQrInput) => {
  if (!args.data || typeof args.data !== 'string') throw new Error('data is required')
  const data = args.data.trim()
  const data = await apiFetch<any>(`/qr/${encodeURIComponent(data)}`)
  return {
    url: data.url,
    data: data.data,
  }
}, { method: 'generate_qr' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generate, generateQr }

console.log('settlegrid-barcode-gen MCP server ready')
console.log('Methods: generate, generate_qr')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
