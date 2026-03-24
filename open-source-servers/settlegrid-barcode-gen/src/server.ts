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

const BARCODE_BASE = 'https://barcodeapi.org/api'
const VALID_TYPES = ['128', '39', 'ean13', 'ean8', 'upca', 'upce', 'itf', 'codabar', 'qr', 'datamatrix', 'pdf417']

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
  const barcodeData = args.data.trim()
  const barcodeType = typeof args.type === 'string' && VALID_TYPES.includes(args.type.trim().toLowerCase())
    ? args.type.trim().toLowerCase()
    : '128'
  const url = `${BARCODE_BASE}/${barcodeType}/${encodeURIComponent(barcodeData)}`
  return { url, type: barcodeType, data: barcodeData, format: 'png' }
}, { method: 'generate' })

const generateQr = sg.wrap(async (args: GenerateQrInput) => {
  if (!args.data || typeof args.data !== 'string') throw new Error('data is required')
  const qrData = args.data.trim()
  const url = `${BARCODE_BASE}/qr/${encodeURIComponent(qrData)}`
  return { url, data: qrData, format: 'png' }
}, { method: 'generate_qr' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generate, generateQr }

console.log('settlegrid-barcode-gen MCP server ready')
console.log('Methods: generate, generate_qr')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
