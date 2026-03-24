/**
 * settlegrid-open-food-facts — Open Food Facts MCP Server
 *
 * Global food product database with nutrition data, ingredients, and allergens.
 *
 * Methods:
 *   search_products(query)        — Search food products by name  (1¢)
 *   get_product(barcode)          — Get food product details by barcode  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchProductsInput {
  query: string
}

interface GetProductInput {
  barcode: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://world.openfoodfacts.org/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-open-food-facts/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Food Facts API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-food-facts',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_products: { costCents: 1, displayName: 'Search Products' },
      get_product: { costCents: 1, displayName: 'Get Product' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchProducts = sg.wrap(async (args: SearchProductsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search?search_terms=${encodeURIComponent(query)}&page_size=10&json=true`)
  const items = (data.products ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        code: item.code,
        product_name: item.product_name,
        brands: item.brands,
        nutriscore_grade: item.nutriscore_grade,
        nutriments: item.nutriments,
    })),
  }
}, { method: 'search_products' })

const getProduct = sg.wrap(async (args: GetProductInput) => {
  if (!args.barcode || typeof args.barcode !== 'string') throw new Error('barcode is required')
  const barcode = args.barcode.trim()
  const data = await apiFetch<any>(`/product/${encodeURIComponent(barcode)}.json`)
  return {
    code: data.code,
    product_name: data.product_name,
    brands: data.brands,
    ingredients_text: data.ingredients_text,
    nutriments: data.nutriments,
    allergens: data.allergens,
  }
}, { method: 'get_product' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchProducts, getProduct }

console.log('settlegrid-open-food-facts MCP server ready')
console.log('Methods: search_products, get_product')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
