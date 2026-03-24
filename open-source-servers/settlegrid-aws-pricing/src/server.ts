/**
 * settlegrid-aws-pricing — AWS Service Pricing MCP Server
 *
 * Wraps AWS Price List API with SettleGrid billing.
 * No API key needed — AWS pricing data is public.
 *
 * Methods:
 *   get_ec2_prices(region?, type?) — EC2 prices (2¢)
 *   list_services() — AWS service list (1¢)
 *   get_service_url(service) — Pricing URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Ec2Input { region?: string; type?: string }
interface ServiceUrlInput { service: string }

interface AwsOffer {
  offerCode: string
  currentVersionUrl: string
  currentRegionIndexUrl?: string
}

interface AwsIndex {
  formatVersion: string
  disclaimer: string
  publicationDate: string
  offers: Record<string, AwsOffer>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pricing.us-east-1.amazonaws.com'
const INDEX_URL = `${API_BASE}/offers/v1.0/aws/index.json`

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'aws-pricing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ec2_prices: { costCents: 2, displayName: 'EC2 Pricing' },
      list_services: { costCents: 1, displayName: 'List Services' },
      get_service_url: { costCents: 1, displayName: 'Service URL' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEc2Prices = sg.wrap(async (args: Ec2Input) => {
  const region = args.region || 'us-east-1'
  const index = await apiFetch<AwsIndex>(INDEX_URL)
  const ec2 = index.offers['AmazonEC2']
  if (!ec2) throw new Error('AmazonEC2 offer not found in index')
  const regionIndexUrl = ec2.currentRegionIndexUrl
  if (!regionIndexUrl) throw new Error('No region index available for EC2')
  const regionIndex = await apiFetch<any>(`${API_BASE}${regionIndexUrl}`)
  const regionData = regionIndex.regions?.[region]
  if (!regionData) {
    return {
      region,
      available_regions: Object.keys(regionIndex.regions || {}),
      error: `Region ${region} not found`,
    }
  }
  return {
    region,
    version_url: regionData.currentVersionUrl,
    type_filter: args.type || 'all',
    publication_date: index.publicationDate,
    source: 'AWS Price List API',
  }
}, { method: 'get_ec2_prices' })

const listServices = sg.wrap(async () => {
  const index = await apiFetch<AwsIndex>(INDEX_URL)
  const services = Object.entries(index.offers).map(([code, offer]) => ({
    code,
    pricing_url: offer.currentVersionUrl,
    has_region_index: !!offer.currentRegionIndexUrl,
  }))
  return {
    services,
    count: services.length,
    publication_date: index.publicationDate,
    source: 'AWS Price List API',
  }
}, { method: 'list_services' })

const getServiceUrl = sg.wrap(async (args: ServiceUrlInput) => {
  if (!args.service) throw new Error('service is required')
  const index = await apiFetch<AwsIndex>(INDEX_URL)
  const offer = index.offers[args.service]
  if (!offer) {
    const available = Object.keys(index.offers).slice(0, 20)
    throw new Error(`Service '${args.service}' not found. Try: ${available.join(', ')}`)
  }
  return {
    service: args.service,
    pricing_url: `${API_BASE}${offer.currentVersionUrl}`,
    region_index_url: offer.currentRegionIndexUrl ? `${API_BASE}${offer.currentRegionIndexUrl}` : null,
    source: 'AWS Price List API',
  }
}, { method: 'get_service_url' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEc2Prices, listServices, getServiceUrl }

console.log('settlegrid-aws-pricing MCP server ready')
console.log('Methods: get_ec2_prices, list_services, get_service_url')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
