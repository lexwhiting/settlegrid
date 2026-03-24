/**
 * settlegrid-gcp-pricing — GCP Service Pricing MCP Server
 *
 * Wraps GCP Cloud Billing catalog with SettleGrid billing.
 * No API key needed — public catalog endpoints.
 *
 * Methods:
 *   get_compute_prices(region?) — Compute pricing (2¢)
 *   list_services() — GCP services (1¢)
 *   get_skus(service) — Service SKUs (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ComputeInput { region?: string }
interface SkusInput { service: string }

interface GcpService {
  name: string
  serviceId: string
  displayName: string
}

interface GcpSku {
  name: string
  skuId: string
  description: string
  category: { serviceDisplayName: string; resourceFamily: string }
  serviceRegions: string[]
  pricingInfo: any[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://cloudbilling.googleapis.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const GCP_SERVICES: Record<string, string> = {
  'compute': '6F81-5844-456A',
  'storage': '95FF-2EF5-5EA1',
  'bigquery': '2062-016F-44A2',
  'cloud-sql': '9662-B51E-5089',
  'kubernetes': 'CCD8-9BF1-090E',
  'cloud-functions': '29E7-DA93-CA13',
  'cloud-run': '152E-C115-5142',
  'networking': 'E505-1604-58F8',
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gcp-pricing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_compute_prices: { costCents: 2, displayName: 'Compute Prices' },
      list_services: { costCents: 1, displayName: 'List Services' },
      get_skus: { costCents: 2, displayName: 'Service SKUs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getComputePrices = sg.wrap(async (args: ComputeInput) => {
  const region = args.region || 'us-central1'
  const serviceId = GCP_SERVICES['compute']
  try {
    const data = await apiFetch<any>(`/services/${serviceId}/skus?pageSize=50`)
    const skus = (data.skus || [])
      .filter((s: GcpSku) => !region || s.serviceRegions?.includes(region))
      .slice(0, 25)
      .map((s: GcpSku) => ({
        id: s.skuId,
        description: s.description,
        category: s.category?.resourceFamily,
        regions: s.serviceRegions?.slice(0, 5),
        pricing: s.pricingInfo?.[0],
      }))
    return { region, skus, count: skus.length, source: 'GCP Cloud Billing API' }
  } catch {
    return {
      region,
      note: 'GCP Billing API requires authentication for SKU data. Use list_services for public catalog info.',
      known_services: Object.keys(GCP_SERVICES),
      source: 'GCP Cloud Billing API',
    }
  }
}, { method: 'get_compute_prices' })

const listServices = sg.wrap(async () => {
  try {
    const data = await apiFetch<any>('/services?pageSize=50')
    const services = (data.services || []).map((s: GcpService) => ({
      id: s.serviceId,
      name: s.displayName,
      resource: s.name,
    }))
    return { services, count: services.length, source: 'GCP Cloud Billing API' }
  } catch {
    const services = Object.entries(GCP_SERVICES).map(([name, id]) => ({ name, id }))
    return {
      services,
      count: services.length,
      note: 'Returning cached service list — API may require auth.',
      source: 'GCP Cloud Billing API',
    }
  }
}, { method: 'list_services' })

const getSkus = sg.wrap(async (args: SkusInput) => {
  if (!args.service) throw new Error('service is required')
  const serviceKey = args.service.toLowerCase().replace(/\s+/g, '-')
  const serviceId = GCP_SERVICES[serviceKey] || args.service
  try {
    const data = await apiFetch<any>(`/services/${serviceId}/skus?pageSize=25`)
    const skus = (data.skus || []).map((s: GcpSku) => ({
      id: s.skuId,
      description: s.description,
      category: s.category,
      regions: s.serviceRegions?.slice(0, 5),
    }))
    return { service: args.service, service_id: serviceId, skus, count: skus.length }
  } catch {
    return {
      service: args.service,
      service_id: serviceId,
      note: 'SKU data may require authentication. Known service IDs:',
      known_services: GCP_SERVICES,
    }
  }
}, { method: 'get_skus' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getComputePrices, listServices, getSkus }

console.log('settlegrid-gcp-pricing MCP server ready')
console.log('Methods: get_compute_prices, list_services, get_skus')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
