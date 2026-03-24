/**
 * settlegrid-azure-pricing — Azure Service Pricing MCP Server
 *
 * Wraps Azure Retail Prices API with SettleGrid billing.
 * No API key needed — Azure pricing API is public.
 *
 * Methods:
 *   get_prices(service?, region?) — Azure prices (1¢)
 *   search_skus(query) — Search SKUs (1¢)
 *   list_services() — Service list (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricesInput { service?: string; region?: string }
interface SearchInput { query: string }

interface AzurePrice {
  skuId: string
  skuName: string
  serviceName: string
  armRegionName: string
  retailPrice: number
  unitOfMeasure: string
  currencyCode: string
  productName: string
  meterName: string
  type: string
}

interface AzureResponse {
  Items: AzurePrice[]
  NextPageLink: string | null
  Count: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://prices.azure.com/api/retail/prices'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatPrice(item: AzurePrice) {
  return {
    sku: item.skuName,
    service: item.serviceName,
    product: item.productName,
    meter: item.meterName,
    region: item.armRegionName,
    price: item.retailPrice,
    unit: item.unitOfMeasure,
    currency: item.currencyCode,
    type: item.type,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'azure-pricing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_prices: { costCents: 1, displayName: 'Azure Prices' },
      search_skus: { costCents: 1, displayName: 'Search SKUs' },
      list_services: { costCents: 1, displayName: 'List Services' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrices = sg.wrap(async (args: PricesInput) => {
  const parts: string[] = []
  if (args.service) parts.push(`serviceName eq '${args.service}'`)
  if (args.region) parts.push(`armRegionName eq '${args.region}'`)
  const filter = parts.length ? `?\$filter=${encodeURIComponent(parts.join(' and '))}&\$top=50` : '?\$top=50'
  const data = await apiFetch<AzureResponse>(filter)
  return {
    items: data.Items.map(formatPrice),
    count: data.Count,
    has_more: !!data.NextPageLink,
    filters: { service: args.service, region: args.region },
  }
}, { method: 'get_prices' })

const searchSkus = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const filter = `?\$filter=contains(skuName, '${args.query}')&\$top=30`
  const data = await apiFetch<AzureResponse>(filter)
  return {
    query: args.query,
    items: data.Items.map(formatPrice),
    count: data.Count,
    has_more: !!data.NextPageLink,
  }
}, { method: 'search_skus' })

const listServices = sg.wrap(async () => {
  const data = await apiFetch<AzureResponse>('?\$top=100')
  const services = [...new Set(data.Items.map(i => i.serviceName).filter(Boolean))].sort()
  return {
    services,
    count: services.length,
    note: 'Partial list from first 100 items. Use get_prices with service filter for full data.',
    source: 'Azure Retail Prices API',
  }
}, { method: 'list_services' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrices, searchSkus, listServices }

console.log('settlegrid-azure-pricing MCP server ready')
console.log('Methods: get_prices, search_skus, list_services')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
