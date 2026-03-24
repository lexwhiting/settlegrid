/**
 * settlegrid-cloud-pricing — Cloud Provider Pricing MCP Server
 *
 * Wraps Azure Retail Prices API with SettleGrid billing.
 * No API key needed — Azure pricing API is public.
 *
 * Methods:
 *   get_prices(service?, region?) — Service prices (1¢)
 *   compare_services(service) — Price comparison (2¢)
 *   list_regions() — Available regions (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricesInput { service?: string; region?: string }
interface CompareInput { service: string }

interface AzurePrice {
  skuId: string
  skuName: string
  serviceName: string
  armRegionName: string
  retailPrice: number
  unitOfMeasure: string
  currencyCode: string
  productName: string
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

function buildFilter(service?: string, region?: string): string {
  const parts: string[] = []
  if (service) parts.push(`serviceName eq '${service}'`)
  if (region) parts.push(`armRegionName eq '${region}'`)
  return parts.length ? `?\$filter=${encodeURIComponent(parts.join(' and '))}&\$top=50` : '?\$top=50'
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cloud-pricing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_prices: { costCents: 1, displayName: 'Cloud Prices' },
      compare_services: { costCents: 2, displayName: 'Compare Services' },
      list_regions: { costCents: 1, displayName: 'List Regions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrices = sg.wrap(async (args: PricesInput) => {
  const filter = buildFilter(args.service, args.region)
  const data = await apiFetch<AzureResponse>(filter)
  return {
    items: data.Items.map(i => ({
      sku: i.skuName,
      service: i.serviceName,
      product: i.productName,
      region: i.armRegionName,
      price: i.retailPrice,
      unit: i.unitOfMeasure,
      currency: i.currencyCode,
    })),
    count: data.Count,
    hasMore: !!data.NextPageLink,
  }
}, { method: 'get_prices' })

const compareServices = sg.wrap(async (args: CompareInput) => {
  if (!args.service) throw new Error('service is required')
  const regions = ['eastus', 'westus2', 'westeurope', 'southeastasia']
  const results = await Promise.all(regions.map(async (region) => {
    try {
      const data = await apiFetch<AzureResponse>(buildFilter(args.service, region))
      return { region, items: data.Items.slice(0, 5), count: data.Count }
    } catch { return { region, items: [], count: 0 } }
  }))
  return {
    service: args.service,
    regions: results,
    comparison_regions: regions,
  }
}, { method: 'compare_services' })

const listRegions = sg.wrap(async () => {
  const data = await apiFetch<AzureResponse>('?\$top=100')
  const regions = [...new Set(data.Items.map(i => i.armRegionName).filter(Boolean))]
  return {
    regions: regions.sort(),
    count: regions.length,
    source: 'Azure Retail Prices API',
  }
}, { method: 'list_regions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrices, compareServices, listRegions }

console.log('settlegrid-cloud-pricing MCP server ready')
console.log('Methods: get_prices, compare_services, list_regions')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
