/**
 * settlegrid-qr-code — QR Code Generator MCP Server
 *
 * Generate QR codes from text or URLs.
 *
 * Methods:
 *   create_qr(data, size)         — Generate a QR code image URL for given data  (1¢)
 *   read_qr(image_url)            — Read/decode a QR code from an image URL  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateQrInput {
  data: string
  size?: number
}

interface ReadQrInput {
  image_url: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.qrserver.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-qr-code/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`QR Code Generator API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'qr-code',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_qr: { costCents: 1, displayName: 'Create QR Code' },
      read_qr: { costCents: 1, displayName: 'Read QR Code' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const createQr = sg.wrap(async (args: CreateQrInput) => {
  if (!args.data || typeof args.data !== 'string') throw new Error('data is required')
  const data = args.data.trim()
  const size = typeof args.size === 'number' ? args.size : 0
  const data = await apiFetch<any>(`/create-qr-code/?data=${encodeURIComponent(data)}&size=${size}x${size}&format=png`)
  return {
    url: data.url,
  }
}, { method: 'create_qr' })

const readQr = sg.wrap(async (args: ReadQrInput) => {
  if (!args.image_url || typeof args.image_url !== 'string') throw new Error('image_url is required')
  const image_url = args.image_url.trim()
  const data = await apiFetch<any>(`/read-qr-code/?fileurl=${encodeURIComponent(image_url)}`)
  const items = (data.data ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        type: item.type,
        symbol: item.symbol,
    })),
  }
}, { method: 'read_qr' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { createQr, readQr }

console.log('settlegrid-qr-code MCP server ready')
console.log('Methods: create_qr, read_qr')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
