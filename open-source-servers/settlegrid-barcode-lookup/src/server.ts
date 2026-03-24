/**
 * settlegrid-barcode-lookup — Barcode Lookup MCP Server
 *
 * Wraps the Barcode Lookup API with SettleGrid billing.
 * Requires a Barcode Lookup API key.
 *
 * Methods:
 *   lookup_barcode(barcode)   — Product info by barcode  (2¢)
 *   search_products(query)    — Search products          (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BarcodeInput { barcode: string }
interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.barcodelookup.com/v3'
const API_KEY = process.env.BARCODE_LOOKUP_API_KEY || ''
const BARCODE_RE = /^[0-9]{8,14}$/

async function barcodeFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('BARCODE_LOOKUP_API_KEY environment variable is required')
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(`${API_BASE}${path}${separator}key=${API_KEY}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Product not found')
    if (res.status === 403) throw new Error('Invalid or expired API key')
    const body = await res.text().catch(() => '')
    throw new Error(`Barcode Lookup API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatProduct(p: Record<string, unknown>) {
  return {
    barcode: p.barcode_number,
    name: p.title || p.product_name,
    description: ((p.description as string) || '').slice(0, 500),
    brand: p.brand || null,
    manufacturer: p.manufacturer || null,
    category: p.category || null,
    images: ((p.images as string[]) || []).slice(0, 5),
    stores: ((p.stores as Array<Record<string, unknown>>) || []).slice(0, 5).map(s => ({
      name: s.store_name, price: s.store_price, url: s.product_url,
    })),
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'barcode-lookup',
  pricing: {
    defaultCostCents: 2,
    methods: {
      lookup_barcode: { costCents: 2, displayName: 'Lookup Barcode' },
      search_products: { costCents: 2, displayName: 'Search Products' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupBarcode = sg.wrap(async (args: BarcodeInput) => {
  if (!args.barcode || typeof args.barcode !== 'string') throw new Error('barcode is required')
  const barcode = args.barcode.trim()
  if (!BARCODE_RE.test(barcode)) throw new Error('barcode must be 8-14 digits (UPC/EAN/ISBN)')
  const data = await barcodeFetch<{ products: Array<Record<string, unknown>> }>(`/products?barcode=${barcode}`)
  if (!data.products || data.products.length === 0) throw new Error('Product not found for this barcode')
  return formatProduct(data.products[0])
}, { method: 'lookup_barcode' })

const searchProducts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  const data = await barcodeFetch<{ products: Array<Record<string, unknown>> }>(`/products?search=${encodeURIComponent(query)}`)
  return { query, count: data.products?.length || 0, products: (data.products || []).slice(0, 10).map(formatProduct) }
}, { method: 'search_products' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupBarcode, searchProducts }

console.log('settlegrid-barcode-lookup MCP server ready')
console.log('Methods: lookup_barcode, search_products')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
