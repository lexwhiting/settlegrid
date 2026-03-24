/**
 * settlegrid-soil-data — Soil Composition Data MCP Server
 * Wraps ISRIC SoilGrids REST API with SettleGrid billing.
 * Methods:
 *   get_soil(lat, lon, property?) — Get soil properties (2¢)
 *   list_properties()             — List properties (1¢)
 *   get_classification(lat, lon)  — Get classification (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SoilInput {
  lat: number
  lon: number
  property?: string
}

interface ClassInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://rest.isric.org/soilgrids/v2.0'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-soil-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SoilGrids API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const SOIL_PROPERTIES = [
  'bdod', 'cec', 'cfvo', 'clay', 'nitrogen', 'ocd', 'ocs', 'phh2o', 'sand', 'silt', 'soc', 'wv0010', 'wv0033', 'wv1500'
]

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'soil-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_soil: { costCents: 2, displayName: 'Get soil properties' },
      list_properties: { costCents: 1, displayName: 'List soil properties' },
      get_classification: { costCents: 2, displayName: 'Get soil classification' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSoil = sg.wrap(async (args: SoilInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric)')
  }
  const params: Record<string, string> = {
    lat: String(args.lat),
    lon: String(args.lon),
  }
  if (args.property) {
    params.property = args.property
  }
  return apiFetch<unknown>('properties/query', params)
}, { method: 'get_soil' })

const listProperties = sg.wrap(async () => {
  return {
    properties: SOIL_PROPERTIES,
    descriptions: {
      bdod: 'Bulk density', cec: 'Cation exchange capacity', cfvo: 'Coarse fragments',
      clay: 'Clay content', nitrogen: 'Total nitrogen', ocd: 'Organic carbon density',
      ocs: 'Organic carbon stocks', phh2o: 'Soil pH in H2O', sand: 'Sand content',
      silt: 'Silt content', soc: 'Soil organic carbon', wv0010: 'Water content 10kPa',
      wv0033: 'Water content 33kPa', wv1500: 'Water content 1500kPa',
    },
  }
}, { method: 'list_properties' })

const getClassification = sg.wrap(async (args: ClassInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required')
  }
  return apiFetch<unknown>('classification/query', {
    lat: String(args.lat),
    lon: String(args.lon),
    number_classes: '3',
  })
}, { method: 'get_classification' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSoil, listProperties, getClassification }

console.log('settlegrid-soil-data MCP server ready')
console.log('Methods: get_soil, list_properties, get_classification')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
