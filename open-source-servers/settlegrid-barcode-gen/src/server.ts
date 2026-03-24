/**
 * settlegrid-barcode-gen — Barcode Generator MCP Server
 *
 * Generates barcode URLs via BarcodeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   generate_barcode(data, type?) — barcode URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface BarcodeInput { data: string; type?: string }

const sg = settlegrid.init({
  toolSlug: 'barcode-gen',
  pricing: { defaultCostCents: 1, methods: { generate_barcode: { costCents: 1, displayName: 'Generate Barcode' } } },
})

const generateBarcode = sg.wrap(async (args: BarcodeInput) => {
  if (!args.data) throw new Error('data is required')
  const type = args.type || '128'
  const url = `https://barcodeapi.org/api/${type}/${encodeURIComponent(args.data)}`
  return { url, type, data: args.data, format: 'PNG' }
}, { method: 'generate_barcode' })

export { generateBarcode }

console.log('settlegrid-barcode-gen MCP server ready')
console.log('Methods: generate_barcode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
