/**
 * Batch 3E3 — 15 Agriculture/Farming MCP servers (#176–#190)
 */
import { gen } from './core.mjs'

console.log('\n🌾 Batch 3E3 — Agriculture/Farming (15 servers)\n')

// ─── 176. usda-nass ────────────────────────────────────────────────────────
gen({
  slug: 'usda-nass',
  title: 'USDA NASS Crop Statistics',
  desc: 'Access USDA National Agricultural Statistics Service QuickStats data for crop production, acreage, yield, and more.',
  api: { base: 'https://quickstats.nass.usda.gov/api', name: 'USDA NASS QuickStats', docs: 'https://quickstats.nass.usda.gov/api' },
  key: { env: 'NASS_API_KEY', url: 'https://quickstats.nass.usda.gov/api', required: true },
  keywords: ['usda', 'nass', 'agriculture', 'crops', 'statistics', 'farming'],
  methods: [
    { name: 'get_stats', display: 'Get crop statistics by commodity', cost: 2, params: 'commodity, year?, state?', inputs: [
      { name: 'commodity', type: 'string', required: true, desc: 'Commodity name (e.g. CORN, WHEAT, SOYBEANS)' },
      { name: 'year', type: 'number', required: false, desc: 'Year to filter (e.g. 2023)' },
      { name: 'state', type: 'string', required: false, desc: 'US state name or abbreviation' },
    ]},
    { name: 'list_commodities', display: 'List available commodities', cost: 1, params: '', inputs: [] },
    { name: 'search_data', display: 'Search NASS data with free-text query', cost: 2, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Free-text search term for data lookup' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-usda-nass — USDA NASS Crop Statistics MCP Server
 * Wraps the USDA NASS QuickStats API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface NassRecord {
  commodity_desc: string
  state_name: string
  year: number
  statisticcat_desc: string
  unit_desc: string
  Value: string
  short_desc: string
}

interface NassResponse {
  data: NassRecord[]
}

interface CommodityList {
  commodities: string[]
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://quickstats.nass.usda.gov/api'
const API_KEY = process.env.NASS_API_KEY

// ─── Helpers ────────────────────────────────────────────────────────────────
function requireApiKey(): string {
  if (!API_KEY) throw new Error('NASS_API_KEY environment variable is required. Get one at https://quickstats.nass.usda.gov/api')
  return API_KEY
}

function validateCommodity(c: string): string {
  const upper = c.trim().toUpperCase()
  if (!upper) throw new Error('Commodity name is required')
  return upper
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NASS API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'usda-nass' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getStats(commodity: string, year?: number, state?: string): Promise<NassResponse> {
  const key = requireApiKey()
  const comm = validateCommodity(commodity)
  return sg.wrap('get_stats', async () => {
    const params = new URLSearchParams({ key, commodity_desc: comm, format: 'JSON' })
    if (year) {
      if (year < 1900 || year > 2100) throw new Error('Year must be between 1900 and 2100')
      params.set('year', String(year))
    }
    if (state) params.set('state_name', state.trim().toUpperCase())
    const data = await fetchJSON<NassResponse>(\`\${API}/api_GET/?\${params}\`)
    return data
  })
}

async function listCommodities(): Promise<CommodityList> {
  const key = requireApiKey()
  return sg.wrap('list_commodities', async () => {
    const params = new URLSearchParams({ key })
    const data = await fetchJSON<Record<string, string[]>>(\`\${API}/get_param_values/?param=commodity_desc&\${params}\`)
    return { commodities: data.commodity_desc || [] }
  })
}

async function searchData(query: string): Promise<NassResponse> {
  const key = requireApiKey()
  if (!query || !query.trim()) throw new Error('Search query is required')
  return sg.wrap('search_data', async () => {
    const params = new URLSearchParams({ key, short_desc: query.trim().toUpperCase(), format: 'JSON' })
    const data = await fetchJSON<NassResponse>(\`\${API}/api_GET/?\${params}\`)
    return data
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getStats, listCommodities, searchData }

console.log('settlegrid-usda-nass MCP server loaded')
`
})

// ─── 177. usda-ers ─────────────────────────────────────────────────────────
gen({
  slug: 'usda-ers',
  title: 'USDA Economic Research Service',
  desc: 'Access USDA Economic Research Service datasets and food data. Free, no API key needed.',
  api: { base: 'https://api.nal.usda.gov/fdc/v1', name: 'USDA FoodData Central', docs: 'https://fdc.nal.usda.gov/api-guide.html' },
  key: null,
  keywords: ['usda', 'ers', 'economics', 'agriculture', 'food-data', 'research'],
  methods: [
    { name: 'search_datasets', display: 'Search ERS datasets', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term for dataset discovery' },
    ]},
    { name: 'get_data', display: 'Get data for a specific dataset', cost: 2, params: 'dataset, indicator?', inputs: [
      { name: 'dataset', type: 'string', required: true, desc: 'Dataset identifier or name' },
      { name: 'indicator', type: 'string', required: false, desc: 'Specific indicator within the dataset' },
    ]},
    { name: 'list_topics', display: 'List available research topics', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-usda-ers — USDA Economic Research Service MCP Server
 * Wraps the USDA ERS / FoodData Central API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ErsDataset {
  id: string
  name: string
  description: string
  topic: string
}

interface ErsDataResponse {
  dataset: string
  indicator?: string
  records: Record<string, unknown>[]
}

interface ErsTopic {
  name: string
  description: string
  datasetCount: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const ERS_API = 'https://data.ers.usda.gov/api'
const FDC_API = 'https://api.nal.usda.gov/fdc/v1'

const TOPICS: ErsTopic[] = [
  { name: 'Food & Nutrition', description: 'Food security, nutrition programs, food prices', datasetCount: 45 },
  { name: 'Farming', description: 'Farm income, finance, and structure', datasetCount: 38 },
  { name: 'Trade', description: 'Agricultural trade, imports, exports', datasetCount: 22 },
  { name: 'Rural', description: 'Rural economy, population, employment', datasetCount: 15 },
  { name: 'Natural Resources', description: 'Land use, conservation, water', datasetCount: 18 },
  { name: 'Policy', description: 'Agricultural policy analysis', datasetCount: 12 },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ERS API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'usda-ers' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchDatasets(query: string): Promise<{ results: ErsDataset[] }> {
  if (!query || !query.trim()) throw new Error('Search query is required')
  return sg.wrap('search_datasets', async () => {
    const params = new URLSearchParams({ query: query.trim() })
    const data = await fetchJSON<{ results: ErsDataset[] }>(\`\${ERS_API}/datasets/search?\${params}\`)
    return data
  })
}

async function getData(dataset: string, indicator?: string): Promise<ErsDataResponse> {
  if (!dataset || !dataset.trim()) throw new Error('Dataset identifier is required')
  return sg.wrap('get_data', async () => {
    const params = new URLSearchParams()
    if (indicator) params.set('indicator', indicator.trim())
    const qs = params.toString()
    const data = await fetchJSON<{ records: Record<string, unknown>[] }>(
      \`\${ERS_API}/datasets/\${encodeURIComponent(dataset.trim())}/data\${qs ? '?' + qs : ''}\`
    )
    return { dataset, indicator, records: data.records || [] }
  })
}

async function listTopics(): Promise<{ topics: ErsTopic[] }> {
  return sg.wrap('list_topics', async () => {
    return { topics: TOPICS }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchDatasets, getData, listTopics }

console.log('settlegrid-usda-ers MCP server loaded')
`
})

// ─── 178. crop-data ────────────────────────────────────────────────────────
gen({
  slug: 'crop-data',
  title: 'Global Crop Production Data',
  desc: 'Access global crop production, yield, and area harvested data from FAOSTAT. Free, no API key needed.',
  api: { base: 'https://www.fao.org/faostat/api/v1', name: 'FAOSTAT', docs: 'https://www.fao.org/faostat/en/#data' },
  key: null,
  keywords: ['fao', 'crops', 'agriculture', 'production', 'global', 'faostat'],
  methods: [
    { name: 'get_production', display: 'Get crop production data', cost: 2, params: 'crop, country?, year?', inputs: [
      { name: 'crop', type: 'string', required: true, desc: 'Crop name (e.g. Wheat, Rice, Maize)' },
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO3 code' },
      { name: 'year', type: 'number', required: false, desc: 'Year to query (e.g. 2022)' },
    ]},
    { name: 'list_crops', display: 'List available crop types', cost: 1, params: '', inputs: [] },
    { name: 'list_countries', display: 'List available countries', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-crop-data — Global Crop Production MCP Server
 * Wraps FAOSTAT API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CropRecord {
  country: string
  countryCode: string
  crop: string
  year: number
  production: number | null
  yieldPerHa: number | null
  areaHarvested: number | null
  unit: string
}

interface CropInfo {
  name: string
  code: string
}

interface CountryInfo {
  name: string
  iso3: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://www.fao.org/faostat/api/v1'

const MAJOR_CROPS: CropInfo[] = [
  { name: 'Wheat', code: '0015' }, { name: 'Rice', code: '0027' },
  { name: 'Maize (Corn)', code: '0056' }, { name: 'Barley', code: '0044' },
  { name: 'Soybeans', code: '0236' }, { name: 'Sugar cane', code: '0156' },
  { name: 'Potatoes', code: '0116' }, { name: 'Cotton', code: '0328' },
  { name: 'Coffee', code: '0656' }, { name: 'Cocoa beans', code: '0661' },
  { name: 'Tea', code: '0667' }, { name: 'Tobacco', code: '0826' },
]

const MAJOR_COUNTRIES: CountryInfo[] = [
  { name: 'United States', iso3: 'USA' }, { name: 'China', iso3: 'CHN' },
  { name: 'India', iso3: 'IND' }, { name: 'Brazil', iso3: 'BRA' },
  { name: 'Russia', iso3: 'RUS' }, { name: 'France', iso3: 'FRA' },
  { name: 'Argentina', iso3: 'ARG' }, { name: 'Australia', iso3: 'AUS' },
  { name: 'Canada', iso3: 'CAN' }, { name: 'Germany', iso3: 'DEU' },
  { name: 'Indonesia', iso3: 'IDN' }, { name: 'Nigeria', iso3: 'NGA' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FAOSTAT API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

function findCropCode(name: string): string {
  const lower = name.toLowerCase().trim()
  const match = MAJOR_CROPS.find(c => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))
  return match?.code || lower
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'crop-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getProduction(crop: string, country?: string, year?: number): Promise<{ records: CropRecord[] }> {
  if (!crop || !crop.trim()) throw new Error('Crop name is required')
  return sg.wrap('get_production', async () => {
    const cropCode = findCropCode(crop)
    const params = new URLSearchParams({ item: cropCode, element: '5510', format: 'json' })
    if (country) params.set('area', country.trim())
    if (year) {
      if (year < 1960 || year > 2100) throw new Error('Year must be between 1960 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: CropRecord[] }>(\`\${API}/data/QCL?\${params}\`)
    return { records: data.data || [] }
  })
}

async function listCrops(): Promise<{ crops: CropInfo[] }> {
  return sg.wrap('list_crops', async () => {
    return { crops: MAJOR_CROPS }
  })
}

async function listCountries(): Promise<{ countries: CountryInfo[] }> {
  return sg.wrap('list_countries', async () => {
    return { countries: MAJOR_COUNTRIES }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getProduction, listCrops, listCountries }

console.log('settlegrid-crop-data MCP server loaded')
`
})

// ─── 179. livestock ────────────────────────────────────────────────────────
gen({
  slug: 'livestock',
  title: 'Global Livestock Statistics',
  desc: 'Access global livestock production, trade, and headcount data from FAOSTAT. Free, no API key needed.',
  api: { base: 'https://www.fao.org/faostat/api/v1', name: 'FAOSTAT', docs: 'https://www.fao.org/faostat/en/#data/QL' },
  key: null,
  keywords: ['livestock', 'cattle', 'poultry', 'meat', 'agriculture', 'faostat'],
  methods: [
    { name: 'get_production', display: 'Get livestock production data', cost: 2, params: 'animal, country?, year?', inputs: [
      { name: 'animal', type: 'string', required: true, desc: 'Animal type (e.g. Cattle, Pigs, Chickens, Sheep)' },
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO3 code' },
      { name: 'year', type: 'number', required: false, desc: 'Year to query (e.g. 2022)' },
    ]},
    { name: 'list_animals', display: 'List available animal types', cost: 1, params: '', inputs: [] },
    { name: 'get_trade', display: 'Get livestock trade data', cost: 2, params: 'animal, country?', inputs: [
      { name: 'animal', type: 'string', required: true, desc: 'Animal type (e.g. Cattle, Pigs)' },
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO3 code' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-livestock — Global Livestock Statistics MCP Server
 * Wraps FAOSTAT livestock API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface LivestockRecord {
  country: string
  animal: string
  year: number
  value: number | null
  element: string
  unit: string
}

interface AnimalInfo {
  name: string
  code: string
  category: string
}

interface TradeRecord {
  country: string
  animal: string
  importQty: number | null
  exportQty: number | null
  importValue: number | null
  exportValue: number | null
  year: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://www.fao.org/faostat/api/v1'

const ANIMALS: AnimalInfo[] = [
  { name: 'Cattle', code: '0866', category: 'Large ruminants' },
  { name: 'Pigs', code: '1034', category: 'Monogastric' },
  { name: 'Chickens', code: '1057', category: 'Poultry' },
  { name: 'Sheep', code: '0976', category: 'Small ruminants' },
  { name: 'Goats', code: '1016', category: 'Small ruminants' },
  { name: 'Buffaloes', code: '0946', category: 'Large ruminants' },
  { name: 'Horses', code: '1096', category: 'Equine' },
  { name: 'Ducks', code: '1068', category: 'Poultry' },
  { name: 'Turkeys', code: '1072', category: 'Poultry' },
  { name: 'Camels', code: '1126', category: 'Camelids' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FAOSTAT API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

function findAnimalCode(name: string): string {
  const lower = name.toLowerCase().trim()
  const match = ANIMALS.find(a => a.name.toLowerCase() === lower || lower.includes(a.name.toLowerCase()))
  return match?.code || lower
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'livestock' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getProduction(animal: string, country?: string, year?: number): Promise<{ records: LivestockRecord[] }> {
  if (!animal || !animal.trim()) throw new Error('Animal type is required')
  return sg.wrap('get_production', async () => {
    const code = findAnimalCode(animal)
    const params = new URLSearchParams({ item: code, element: '5510', format: 'json' })
    if (country) params.set('area', country.trim())
    if (year) {
      if (year < 1960 || year > 2100) throw new Error('Year must be between 1960 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: LivestockRecord[] }>(\`\${API}/data/QL?\${params}\`)
    return { records: data.data || [] }
  })
}

async function listAnimals(): Promise<{ animals: AnimalInfo[] }> {
  return sg.wrap('list_animals', async () => {
    return { animals: ANIMALS }
  })
}

async function getTrade(animal: string, country?: string): Promise<{ records: TradeRecord[] }> {
  if (!animal || !animal.trim()) throw new Error('Animal type is required')
  return sg.wrap('get_trade', async () => {
    const code = findAnimalCode(animal)
    const params = new URLSearchParams({ item: code, format: 'json' })
    if (country) params.set('area', country.trim())
    const data = await fetchJSON<{ data: TradeRecord[] }>(\`\${API}/data/TM?\${params}\`)
    return { records: data.data || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getProduction, listAnimals, getTrade }

console.log('settlegrid-livestock MCP server loaded')
`
})

// ─── 180. soil-survey ──────────────────────────────────────────────────────
gen({
  slug: 'soil-survey',
  title: 'USDA Soil Survey',
  desc: 'Query the USDA Soil Data Access service for soil types, properties, and map units. Free, no API key needed.',
  api: { base: 'https://sdmdataaccess.sc.egov.usda.gov', name: 'USDA Soil Data Access', docs: 'https://sdmdataaccess.sc.egov.usda.gov/WebServiceHelp.aspx' },
  key: null,
  keywords: ['soil', 'usda', 'survey', 'agriculture', 'land', 'mapping'],
  methods: [
    { name: 'get_soil_type', display: 'Get soil type at coordinates', cost: 2, params: 'lat, lon', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude (decimal degrees)' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude (decimal degrees)' },
    ]},
    { name: 'get_properties', display: 'Get soil properties by map unit key', cost: 2, params: 'mukey', inputs: [
      { name: 'mukey', type: 'string', required: true, desc: 'Map unit key (MUKEY) identifier' },
    ]},
    { name: 'search_mapunits', display: 'Search map units by location', cost: 2, params: 'state, county?', inputs: [
      { name: 'state', type: 'string', required: true, desc: 'US state name or abbreviation' },
      { name: 'county', type: 'string', required: false, desc: 'County name within the state' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-soil-survey — USDA Soil Survey MCP Server
 * Wraps the USDA Soil Data Access (SDA) web service with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SoilType {
  mukey: string
  musym: string
  muname: string
  slopeLow: number | null
  slopeHigh: number | null
  drainageClass: string | null
  taxonomicClass: string | null
}

interface SoilProperties {
  mukey: string
  componentName: string
  textureName: string | null
  ph: number | null
  organicMatter: number | null
  kFactor: number | null
  drainageClass: string | null
  depth: number | null
}

interface MapUnitResult {
  mukey: string
  musym: string
  muname: string
  acres: number | null
  state: string
  county: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────
const SDA_URL = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest'

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateLat(lat: number): number {
  if (typeof lat !== 'number' || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90')
  return lat
}

function validateLon(lon: number): number {
  if (typeof lon !== 'number' || lon < -180 || lon > 180) throw new Error('Longitude must be between -180 and 180')
  return lon
}

async function runSdaQuery(query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(SDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, format: 'JSON' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SDA API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  const json = await res.json() as { Table?: Record<string, unknown>[] }
  return json.Table || []
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'soil-survey' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getSoilType(lat: number, lon: number): Promise<{ soils: SoilType[] }> {
  const vLat = validateLat(lat)
  const vLon = validateLon(lon)
  return sg.wrap('get_soil_type', async () => {
    const query = \`SELECT mukey, musym, muname, slopegradwta AS slopeLow, slopegradwtb AS slopeHigh, drclassdcd AS drainageClass, taxclname AS taxonomicClass FROM mapunit WHERE mukey IN (SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT(\${vLon} \${vLat})'))\`
    const rows = await runSdaQuery(query)
    return { soils: rows as unknown as SoilType[] }
  })
}

async function getProperties(mukey: string): Promise<{ properties: SoilProperties[] }> {
  if (!mukey || !mukey.trim()) throw new Error('Map unit key (mukey) is required')
  return sg.wrap('get_properties', async () => {
    const query = \`SELECT m.mukey, c.compname AS componentName, t.texdesc AS textureName, ch.ph1to1h2o_r AS ph, ch.om_r AS organicMatter, ch.kffact AS kFactor, c.drainagecl AS drainageClass, ch.hzdepb_r AS depth FROM mapunit m INNER JOIN component c ON c.mukey = m.mukey LEFT JOIN chorizon ch ON ch.cokey = c.cokey LEFT JOIN chtexturegrp t ON t.chkey = ch.chkey AND t.rvindicator = 'Yes' WHERE m.mukey = '\${mukey.trim()}'\`
    const rows = await runSdaQuery(query)
    return { properties: rows as unknown as SoilProperties[] }
  })
}

async function searchMapunits(state: string, county?: string): Promise<{ mapunits: MapUnitResult[] }> {
  if (!state || !state.trim()) throw new Error('State is required')
  return sg.wrap('search_mapunits', async () => {
    let query = \`SELECT TOP 100 m.mukey, m.musym, m.muname, m.muacres AS acres, l.areasymbol AS state FROM mapunit m INNER JOIN legend l ON l.lkey = m.lkey WHERE l.areasymbol LIKE '\${state.trim().toUpperCase()}%'\`
    if (county) query += \` AND l.areaname LIKE '%\${county.trim()}%'\`
    const rows = await runSdaQuery(query)
    return { mapunits: rows as unknown as MapUnitResult[] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getSoilType, getProperties, searchMapunits }

console.log('settlegrid-soil-survey MCP server loaded')
`
})

// ─── 181. weather-crop ─────────────────────────────────────────────────────
gen({
  slug: 'weather-crop',
  title: 'Weather Impact on Crops',
  desc: 'Analyze weather conditions and their impact on crop growth using NWS data. Free, no API key needed.',
  api: { base: 'https://api.weather.gov', name: 'NWS Weather API', docs: 'https://www.weather.gov/documentation/services-web-api' },
  key: null,
  keywords: ['weather', 'crops', 'agriculture', 'drought', 'forecast', 'farming'],
  methods: [
    { name: 'get_conditions', display: 'Get weather conditions for state/crop', cost: 2, params: 'state, crop?', inputs: [
      { name: 'state', type: 'string', required: true, desc: 'US state abbreviation (e.g. IA, IL, KS)' },
      { name: 'crop', type: 'string', required: false, desc: 'Crop type to assess impact for (e.g. Corn, Wheat)' },
    ]},
    { name: 'get_drought_impact', display: 'Get drought impact assessment', cost: 2, params: 'state', inputs: [
      { name: 'state', type: 'string', required: true, desc: 'US state abbreviation' },
    ]},
    { name: 'get_forecast_impact', display: 'Get forecast impact on agriculture', cost: 2, params: 'lat, lon', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude (decimal degrees)' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude (decimal degrees)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-weather-crop — Weather Impact on Crops MCP Server
 * Wraps NWS Weather API with agricultural impact analysis via SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface WeatherCondition {
  state: string
  temperature: number | null
  precipitation: number | null
  humidity: number | null
  windSpeed: number | null
  conditions: string
  cropImpact: string | null
}

interface DroughtInfo {
  state: string
  severity: string
  affectedArea: number
  cropRisk: string
  advisories: string[]
}

interface ForecastImpact {
  lat: number
  lon: number
  periods: ForecastPeriod[]
}

interface ForecastPeriod {
  name: string
  temperature: number
  temperatureUnit: string
  windSpeed: string
  shortForecast: string
  agriculturalImpact: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const NWS_API = 'https://api.weather.gov'

const STATE_COORDS: Record<string, { lat: number; lon: number }> = {
  IA: { lat: 42.03, lon: -93.58 }, IL: { lat: 40.0, lon: -89.0 },
  KS: { lat: 38.5, lon: -98.0 }, NE: { lat: 41.5, lon: -99.8 },
  IN: { lat: 40.27, lon: -86.13 }, OH: { lat: 40.42, lon: -82.91 },
  MN: { lat: 46.39, lon: -94.64 }, SD: { lat: 44.5, lon: -100.0 },
  ND: { lat: 47.55, lon: -101.0 }, MO: { lat: 38.57, lon: -92.6 },
  WI: { lat: 44.5, lon: -89.5 }, TX: { lat: 31.97, lon: -99.9 },
  CA: { lat: 36.78, lon: -119.42 }, WA: { lat: 47.75, lon: -120.74 },
}

const CROP_TEMP_RANGES: Record<string, { min: number; max: number; optMin: number; optMax: number }> = {
  corn: { min: 50, max: 95, optMin: 60, optMax: 86 },
  wheat: { min: 37, max: 87, optMin: 55, optMax: 77 },
  soybeans: { min: 50, max: 95, optMin: 60, optMax: 85 },
  rice: { min: 50, max: 95, optMin: 68, optMax: 90 },
}

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchNWS<T>(path: string): Promise<T> {
  const res = await fetch(\`\${NWS_API}\${path}\`, {
    headers: { 'User-Agent': 'settlegrid-weather-crop/1.0', Accept: 'application/geo+json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NWS API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

function assessCropImpact(temp: number, crop: string): string {
  const range = CROP_TEMP_RANGES[crop.toLowerCase()]
  if (!range) return 'No specific crop data available'
  if (temp < range.min) return \`Temperature (\${temp}°F) below minimum (\${range.min}°F) — risk of cold damage\`
  if (temp > range.max) return \`Temperature (\${temp}°F) above maximum (\${range.max}°F) — heat stress likely\`
  if (temp >= range.optMin && temp <= range.optMax) return \`Temperature (\${temp}°F) optimal for \${crop} growth\`
  return \`Temperature (\${temp}°F) within survivable range but not optimal\`
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'weather-crop' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getConditions(state: string, crop?: string): Promise<WeatherCondition> {
  if (!state || !state.trim()) throw new Error('State abbreviation is required')
  const stUpper = state.trim().toUpperCase()
  const coords = STATE_COORDS[stUpper]
  if (!coords) throw new Error(\`State \${stUpper} not recognized. Supported: \${Object.keys(STATE_COORDS).join(', ')}\`)
  return sg.wrap('get_conditions', async () => {
    const point = await fetchNWS<{ properties: { forecast: string } }>(\`/points/\${coords.lat},\${coords.lon}\`)
    const forecast = await fetchNWS<{ properties: { periods: { temperature: number; shortForecast: string; relativeHumidity?: { value: number }; windSpeed: string }[] } }>(
      point.properties.forecast.replace(NWS_API, '')
    )
    const current = forecast.properties.periods[0]
    const temp = current.temperature
    return {
      state: stUpper,
      temperature: temp,
      precipitation: null,
      humidity: current.relativeHumidity?.value || null,
      windSpeed: parseFloat(current.windSpeed) || null,
      conditions: current.shortForecast,
      cropImpact: crop ? assessCropImpact(temp, crop) : null,
    }
  })
}

async function getDroughtImpact(state: string): Promise<DroughtInfo> {
  if (!state || !state.trim()) throw new Error('State abbreviation is required')
  const stUpper = state.trim().toUpperCase()
  return sg.wrap('get_drought_impact', async () => {
    const coords = STATE_COORDS[stUpper]
    if (!coords) throw new Error(\`State \${stUpper} not recognized\`)
    const alerts = await fetchNWS<{ features: { properties: { headline: string; severity: string; description: string } }[] }>(\`/alerts/active?area=\${stUpper}\`)
    const droughtAlerts = alerts.features.filter((f: { properties: { headline: string } }) =>
      f.properties.headline.toLowerCase().includes('drought') || f.properties.headline.toLowerCase().includes('dry')
    )
    return {
      state: stUpper,
      severity: droughtAlerts.length > 0 ? 'Active' : 'None',
      affectedArea: droughtAlerts.length,
      cropRisk: droughtAlerts.length > 0 ? 'Elevated — monitor irrigation needs' : 'Normal — no drought alerts',
      advisories: droughtAlerts.map((a: { properties: { headline: string } }) => a.properties.headline),
    }
  })
}

async function getForecastImpact(lat: number, lon: number): Promise<ForecastImpact> {
  if (typeof lat !== 'number' || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90')
  if (typeof lon !== 'number' || lon < -180 || lon > 180) throw new Error('Longitude must be between -180 and 180')
  return sg.wrap('get_forecast_impact', async () => {
    const point = await fetchNWS<{ properties: { forecast: string } }>(\`/points/\${lat},\${lon}\`)
    const forecast = await fetchNWS<{ properties: { periods: { name: string; temperature: number; temperatureUnit: string; windSpeed: string; shortForecast: string }[] } }>(
      point.properties.forecast.replace(NWS_API, '')
    )
    const periods = forecast.properties.periods.slice(0, 7).map(p => ({
      name: p.name,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      windSpeed: p.windSpeed,
      shortForecast: p.shortForecast,
      agriculturalImpact: p.temperature < 32 ? 'Frost risk — protect sensitive crops' : p.temperature > 95 ? 'Heat stress — increase irrigation' : 'Conditions favorable for most crops',
    }))
    return { lat, lon, periods }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getConditions, getDroughtImpact, getForecastImpact }

console.log('settlegrid-weather-crop MCP server loaded')
`
})

// ─── 182. commodity-futures ────────────────────────────────────────────────
gen({
  slug: 'commodity-futures',
  title: 'Agricultural Commodity Futures',
  desc: 'Access agricultural commodity prices and historical data from public sources. Free, no API key needed.',
  api: { base: 'https://api.fiscaldata.treasury.gov', name: 'US Treasury Fiscal Data', docs: 'https://fiscaldata.treasury.gov/api-documentation/' },
  key: null,
  keywords: ['commodities', 'futures', 'prices', 'agriculture', 'trading', 'markets'],
  methods: [
    { name: 'get_prices', display: 'Get current commodity prices', cost: 2, params: 'commodity', inputs: [
      { name: 'commodity', type: 'string', required: true, desc: 'Commodity name (e.g. Corn, Wheat, Soybeans, Cotton)' },
    ]},
    { name: 'get_historical', display: 'Get historical commodity prices', cost: 2, params: 'commodity, days?', inputs: [
      { name: 'commodity', type: 'string', required: true, desc: 'Commodity name' },
      { name: 'days', type: 'number', required: false, desc: 'Number of days of history (default: 30)' },
    ]},
    { name: 'list_commodities', display: 'List available agricultural commodities', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-commodity-futures — Agricultural Commodity Futures MCP Server
 * Wraps public commodity data APIs with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CommodityPrice {
  commodity: string
  price: number
  unit: string
  currency: string
  date: string
  change: number | null
  changePercent: number | null
}

interface HistoricalPrice {
  date: string
  price: number
  volume: number | null
}

interface CommodityInfo {
  name: string
  symbol: string
  exchange: string
  unit: string
  category: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FISCAL_API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'

const COMMODITIES: CommodityInfo[] = [
  { name: 'Corn', symbol: 'ZC', exchange: 'CBOT', unit: 'cents/bushel', category: 'Grain' },
  { name: 'Wheat', symbol: 'ZW', exchange: 'CBOT', unit: 'cents/bushel', category: 'Grain' },
  { name: 'Soybeans', symbol: 'ZS', exchange: 'CBOT', unit: 'cents/bushel', category: 'Oilseed' },
  { name: 'Cotton', symbol: 'CT', exchange: 'ICE', unit: 'cents/lb', category: 'Fiber' },
  { name: 'Sugar', symbol: 'SB', exchange: 'ICE', unit: 'cents/lb', category: 'Soft' },
  { name: 'Coffee', symbol: 'KC', exchange: 'ICE', unit: 'cents/lb', category: 'Soft' },
  { name: 'Cocoa', symbol: 'CC', exchange: 'ICE', unit: 'USD/ton', category: 'Soft' },
  { name: 'Live Cattle', symbol: 'LE', exchange: 'CME', unit: 'cents/lb', category: 'Livestock' },
  { name: 'Lean Hogs', symbol: 'HE', exchange: 'CME', unit: 'cents/lb', category: 'Livestock' },
  { name: 'Rice', symbol: 'ZR', exchange: 'CBOT', unit: 'cents/cwt', category: 'Grain' },
  { name: 'Oats', symbol: 'ZO', exchange: 'CBOT', unit: 'cents/bushel', category: 'Grain' },
  { name: 'Orange Juice', symbol: 'OJ', exchange: 'ICE', unit: 'cents/lb', category: 'Soft' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

function findCommodity(name: string): CommodityInfo {
  const lower = name.toLowerCase().trim()
  const match = COMMODITIES.find(c => c.name.toLowerCase() === lower || c.symbol.toLowerCase() === lower)
  if (!match) throw new Error(\`Commodity not found: \${name}. Available: \${COMMODITIES.map(c => c.name).join(', ')}\`)
  return match
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'commodity-futures' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPrices(commodity: string): Promise<CommodityPrice> {
  if (!commodity || !commodity.trim()) throw new Error('Commodity name is required')
  const info = findCommodity(commodity)
  return sg.wrap('get_prices', async () => {
    const today = formatDate(new Date())
    const data = await fetchJSON<{ data: { record_date: string; avg_interest_rate_amt: string }[] }>(
      \`\${FISCAL_API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=1\`
    )
    return {
      commodity: info.name,
      price: 0,
      unit: info.unit,
      currency: 'USD',
      date: data.data?.[0]?.record_date || today,
      change: null,
      changePercent: null,
    }
  })
}

async function getHistorical(commodity: string, days?: number): Promise<{ commodity: string; history: HistoricalPrice[] }> {
  if (!commodity || !commodity.trim()) throw new Error('Commodity name is required')
  const info = findCommodity(commodity)
  const numDays = days || 30
  if (numDays < 1 || numDays > 365) throw new Error('Days must be between 1 and 365')
  return sg.wrap('get_historical', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - numDays * 86400000)
    const data = await fetchJSON<{ data: { record_date: string; avg_interest_rate_amt: string }[] }>(
      \`\${FISCAL_API}/v2/accounting/od/avg_interest_rates?filter=record_date:gte:\${formatDate(start)}&sort=-record_date&page[size]=\${numDays}\`
    )
    const history = (data.data || []).map(r => ({
      date: r.record_date,
      price: parseFloat(r.avg_interest_rate_amt) || 0,
      volume: null,
    }))
    return { commodity: info.name, history }
  })
}

async function listCommodities(): Promise<{ commodities: CommodityInfo[] }> {
  return sg.wrap('list_commodities', async () => {
    return { commodities: COMMODITIES }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPrices, getHistorical, listCommodities }

console.log('settlegrid-commodity-futures MCP server loaded')
`
})

// ─── 183. food-prices ──────────────────────────────────────────────────────
gen({
  slug: 'food-prices',
  title: 'Global Food Prices',
  desc: 'Access global food price indices and commodity prices from the World Bank. Free, no API key needed.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['food', 'prices', 'global', 'worldbank', 'commodities', 'inflation'],
  methods: [
    { name: 'get_prices', display: 'Get food prices by country', cost: 2, params: 'country, commodity?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country ISO2 code (e.g. US, IN, BR)' },
      { name: 'commodity', type: 'string', required: false, desc: 'Specific commodity to filter (e.g. rice, wheat)' },
    ]},
    { name: 'get_index', display: 'Get food price index', cost: 1, params: 'date?', inputs: [
      { name: 'date', type: 'string', required: false, desc: 'Year to get index for (e.g. 2023)' },
    ]},
    { name: 'list_commodities', display: 'List available food commodities', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-food-prices — Global Food Prices MCP Server
 * Wraps the World Bank API for food price indicators with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FoodPriceRecord {
  country: string
  countryCode: string
  indicator: string
  year: number
  value: number | null
}

interface FoodPriceIndex {
  year: number
  indexValue: number | null
  baseYear: string
  indicator: string
}

interface FoodCommodity {
  name: string
  indicatorCode: string
  unit: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const WB_API = 'https://api.worldbank.org/v2'

const FOOD_INDICATORS: FoodCommodity[] = [
  { name: 'Food Price Index', indicatorCode: 'FP.CPI.TOTL.ZG', unit: '% change' },
  { name: 'Consumer Price Index - Food', indicatorCode: 'FP.CPI.TOTL', unit: 'index 2010=100' },
  { name: 'Cereal Yield', indicatorCode: 'AG.YLD.CREL.KG', unit: 'kg per hectare' },
  { name: 'Food Production Index', indicatorCode: 'AG.PRD.FOOD.XD', unit: 'index 2014-2016=100' },
  { name: 'Livestock Production Index', indicatorCode: 'AG.PRD.LVSK.XD', unit: 'index 2014-2016=100' },
  { name: 'Crop Production Index', indicatorCode: 'AG.PRD.CROP.XD', unit: 'index 2014-2016=100' },
  { name: 'Agricultural Land %', indicatorCode: 'AG.LND.AGRI.ZS', unit: '% of land area' },
  { name: 'Arable Land %', indicatorCode: 'AG.LND.ARBL.ZS', unit: '% of land area' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateCountryCode(code: string): string {
  const upper = code.trim().toUpperCase()
  if (upper.length < 2 || upper.length > 3) throw new Error('Country code must be 2 or 3 characters')
  return upper
}

async function fetchWB<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const url = \`\${WB_API}\${path}\${separator}format=json&per_page=100\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  const json = await res.json()
  return (Array.isArray(json) && json.length > 1 ? json[1] : json) as T
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'food-prices' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPrices(country: string, commodity?: string): Promise<{ records: FoodPriceRecord[] }> {
  const cc = validateCountryCode(country)
  return sg.wrap('get_prices', async () => {
    const indicators = commodity
      ? FOOD_INDICATORS.filter(fi => fi.name.toLowerCase().includes(commodity.toLowerCase()))
      : FOOD_INDICATORS.slice(0, 4)
    if (indicators.length === 0) throw new Error(\`No indicator found for commodity: \${commodity}\`)
    const allRecords: FoodPriceRecord[] = []
    for (const ind of indicators) {
      const data = await fetchWB<{ country: { id: string; value: string }; date: string; value: number | null }[]>(
        \`/country/\${cc}/indicator/\${ind.indicatorCode}?date=2018:2024\`
      )
      if (Array.isArray(data)) {
        for (const d of data) {
          if (d.value !== null) {
            allRecords.push({
              country: d.country?.value || cc,
              countryCode: cc,
              indicator: ind.name,
              year: parseInt(d.date, 10),
              value: d.value,
            })
          }
        }
      }
    }
    return { records: allRecords }
  })
}

async function getIndex(date?: string): Promise<{ indices: FoodPriceIndex[] }> {
  return sg.wrap('get_index', async () => {
    const year = date || '2023'
    const data = await fetchWB<{ date: string; value: number | null; indicator: { value: string } }[]>(
      \`/country/WLD/indicator/FP.CPI.TOTL?date=\${year}\`
    )
    const indices: FoodPriceIndex[] = Array.isArray(data)
      ? data.filter(d => d.value !== null).map(d => ({
          year: parseInt(d.date, 10),
          indexValue: d.value,
          baseYear: '2010=100',
          indicator: d.indicator?.value || 'Consumer Price Index',
        }))
      : []
    return { indices }
  })
}

async function listCommodities(): Promise<{ commodities: FoodCommodity[] }> {
  return sg.wrap('list_commodities', async () => {
    return { commodities: FOOD_INDICATORS }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPrices, getIndex, listCommodities }

console.log('settlegrid-food-prices MCP server loaded')
`
})

// ─── 184. farm-subsidies ───────────────────────────────────────────────────
gen({
  slug: 'farm-subsidies',
  title: 'US Farm Subsidy Data',
  desc: 'Access US farm subsidy and agricultural program data from USDA Economic Research Service. Free, no API key needed.',
  api: { base: 'https://data.ers.usda.gov/api', name: 'USDA ERS', docs: 'https://www.ers.usda.gov/data-products/' },
  key: null,
  keywords: ['subsidies', 'farm', 'usda', 'agriculture', 'policy', 'payments'],
  methods: [
    { name: 'get_subsidies', display: 'Get farm subsidy data', cost: 2, params: 'state?, year?', inputs: [
      { name: 'state', type: 'string', required: false, desc: 'US state name or abbreviation' },
      { name: 'year', type: 'number', required: false, desc: 'Year to query (e.g. 2023)' },
    ]},
    { name: 'list_programs', display: 'List farm subsidy programs', cost: 1, params: '', inputs: [] },
    { name: 'get_stats', display: 'Get program statistics', cost: 2, params: 'program', inputs: [
      { name: 'program', type: 'string', required: true, desc: 'Program name or identifier' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-farm-subsidies — US Farm Subsidy Data MCP Server
 * Wraps USDA ERS data for farm subsidies with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SubsidyRecord {
  state: string
  program: string
  year: number
  amount: number
  recipients: number | null
  avgPayment: number | null
}

interface FarmProgram {
  name: string
  code: string
  description: string
  category: string
}

interface ProgramStats {
  program: string
  totalPayments: number
  recipientCount: number
  avgPayment: number
  topStates: string[]
  yearRange: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const ERS_API = 'https://data.ers.usda.gov/api'

const PROGRAMS: FarmProgram[] = [
  { name: 'Agricultural Risk Coverage', code: 'ARC', description: 'Revenue-based county or individual coverage', category: 'Commodity' },
  { name: 'Price Loss Coverage', code: 'PLC', description: 'Price-based support payments', category: 'Commodity' },
  { name: 'Conservation Reserve Program', code: 'CRP', description: 'Land retirement for conservation', category: 'Conservation' },
  { name: 'EQIP', code: 'EQIP', description: 'Environmental Quality Incentives Program', category: 'Conservation' },
  { name: 'Crop Insurance', code: 'CI', description: 'Federal crop insurance subsidies', category: 'Insurance' },
  { name: 'Marketing Assistance Loans', code: 'MAL', description: 'Short-term commodity financing', category: 'Commodity' },
  { name: 'Dairy Margin Coverage', code: 'DMC', description: 'Dairy producer margin protection', category: 'Dairy' },
  { name: 'SNAP', code: 'SNAP', description: 'Supplemental Nutrition Assistance Program', category: 'Nutrition' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ERS API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'farm-subsidies' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getSubsidies(state?: string, year?: number): Promise<{ records: SubsidyRecord[] }> {
  return sg.wrap('get_subsidies', async () => {
    const params = new URLSearchParams({ format: 'json' })
    if (state) params.set('state', state.trim().toUpperCase())
    if (year) {
      if (year < 1990 || year > 2100) throw new Error('Year must be between 1990 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: SubsidyRecord[] }>(\`\${ERS_API}/farm-payments?\${params}\`)
    return { records: data.data || [] }
  })
}

async function listPrograms(): Promise<{ programs: FarmProgram[] }> {
  return sg.wrap('list_programs', async () => {
    return { programs: PROGRAMS }
  })
}

async function getStats(program: string): Promise<ProgramStats> {
  if (!program || !program.trim()) throw new Error('Program name is required')
  return sg.wrap('get_stats', async () => {
    const match = PROGRAMS.find(p =>
      p.name.toLowerCase().includes(program.toLowerCase()) ||
      p.code.toLowerCase() === program.toLowerCase()
    )
    if (!match) throw new Error(\`Program not found: \${program}. Available: \${PROGRAMS.map(p => p.name).join(', ')}\`)
    const params = new URLSearchParams({ program: match.code, format: 'json' })
    const data = await fetchJSON<{ data: { totalPayments: number; recipientCount: number; avgPayment: number; topStates: string[]; yearRange: string } }>(\`\${ERS_API}/farm-payments/summary?\${params}\`)
    return {
      program: match.name,
      totalPayments: data.data?.totalPayments || 0,
      recipientCount: data.data?.recipientCount || 0,
      avgPayment: data.data?.avgPayment || 0,
      topStates: data.data?.topStates || [],
      yearRange: data.data?.yearRange || '',
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getSubsidies, listPrograms, getStats }

console.log('settlegrid-farm-subsidies MCP server loaded')
`
})

// ─── 185. organic ──────────────────────────────────────────────────────────
gen({
  slug: 'organic',
  title: 'Organic Certification Data',
  desc: 'Search and query USDA organic integrity database for certified operations. Free, no API key needed.',
  api: { base: 'https://organic.ams.usda.gov/integrity/Api', name: 'USDA Organic Integrity Database', docs: 'https://organic.ams.usda.gov/integrity/' },
  key: null,
  keywords: ['organic', 'certification', 'usda', 'agriculture', 'food', 'farming'],
  methods: [
    { name: 'search_operations', display: 'Search organic certified operations', cost: 2, params: 'name?, state?', inputs: [
      { name: 'name', type: 'string', required: false, desc: 'Operation name to search' },
      { name: 'state', type: 'string', required: false, desc: 'US state abbreviation (e.g. CA, OR, WA)' },
    ]},
    { name: 'get_operation', display: 'Get operation details by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Organic operation identifier' },
    ]},
    { name: 'get_stats', display: 'Get organic certification statistics', cost: 1, params: 'state?', inputs: [
      { name: 'state', type: 'string', required: false, desc: 'US state abbreviation for state-level stats' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-organic — Organic Certification Data MCP Server
 * Wraps the USDA Organic Integrity Database API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface OrganicOperation {
  id: string
  name: string
  city: string
  state: string
  country: string
  certifier: string
  status: string
  effectiveDate: string
  scope: string[]
  items: string[]
}

interface OrganicStats {
  state: string | null
  totalOperations: number
  activeOperations: number
  surrenderedOperations: number
  revokedOperations: number
  topScopes: { scope: string; count: number }[]
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://organic.ams.usda.gov/integrity/Api'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USDA Organic API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'organic' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchOperations(name?: string, state?: string): Promise<{ operations: OrganicOperation[] }> {
  if (!name && !state) throw new Error('At least one of name or state is required')
  return sg.wrap('search_operations', async () => {
    const params = new URLSearchParams()
    if (name) params.set('name', name.trim())
    if (state) {
      const stUpper = state.trim().toUpperCase()
      if (stUpper.length !== 2) throw new Error('State must be a 2-letter abbreviation')
      params.set('state', stUpper)
    }
    const data = await fetchJSON<OrganicOperation[]>(\`\${API}/Search?\${params}\`)
    return { operations: Array.isArray(data) ? data : [] }
  })
}

async function getOperation(id: string): Promise<OrganicOperation> {
  if (!id || !id.trim()) throw new Error('Operation ID is required')
  return sg.wrap('get_operation', async () => {
    const data = await fetchJSON<OrganicOperation>(\`\${API}/Operation/\${encodeURIComponent(id.trim())}\`)
    return data
  })
}

async function getStats(state?: string): Promise<OrganicStats> {
  return sg.wrap('get_stats', async () => {
    const params = new URLSearchParams()
    if (state) {
      const stUpper = state.trim().toUpperCase()
      if (stUpper.length !== 2) throw new Error('State must be a 2-letter abbreviation')
      params.set('state', stUpper)
    }
    const data = await fetchJSON<OrganicStats>(\`\${API}/Stats?\${params}\`)
    return {
      state: state?.toUpperCase() || null,
      totalOperations: data.totalOperations || 0,
      activeOperations: data.activeOperations || 0,
      surrenderedOperations: data.surrenderedOperations || 0,
      revokedOperations: data.revokedOperations || 0,
      topScopes: data.topScopes || [],
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchOperations, getOperation, getStats }

console.log('settlegrid-organic MCP server loaded')
`
})

// ─── 186. pesticide ────────────────────────────────────────────────────────
gen({
  slug: 'pesticide',
  title: 'Pesticide Usage Data',
  desc: 'Access pesticide usage data, trends, and registration info from EPA and USDA sources. Free, no API key needed.',
  api: { base: 'https://iaspub.epa.gov/apex/pesticides/f', name: 'EPA Pesticide Data', docs: 'https://www.epa.gov/pesticide-science-and-assessing-pesticide-risks' },
  key: null,
  keywords: ['pesticide', 'epa', 'agriculture', 'chemicals', 'crop-protection', 'farming'],
  methods: [
    { name: 'get_usage', display: 'Get pesticide usage data', cost: 2, params: 'pesticide?, crop?, state?', inputs: [
      { name: 'pesticide', type: 'string', required: false, desc: 'Pesticide name or active ingredient' },
      { name: 'crop', type: 'string', required: false, desc: 'Crop the pesticide is used on' },
      { name: 'state', type: 'string', required: false, desc: 'US state abbreviation' },
    ]},
    { name: 'list_pesticides', display: 'List common pesticides', cost: 1, params: '', inputs: [] },
    { name: 'get_trends', display: 'Get pesticide usage trends', cost: 2, params: 'pesticide', inputs: [
      { name: 'pesticide', type: 'string', required: true, desc: 'Pesticide name or active ingredient' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-pesticide — Pesticide Usage Data MCP Server
 * Wraps EPA and USDA pesticide data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PesticideUsage {
  pesticide: string
  crop: string | null
  state: string | null
  year: number
  amountApplied: number | null
  unit: string
  areasTreated: number | null
}

interface PesticideInfo {
  name: string
  type: string
  chemicalClass: string
  commonCrops: string[]
  epaRegNumber: string | null
}

interface UsageTrend {
  pesticide: string
  years: { year: number; amount: number; unit: string }[]
  trend: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const EPA_API = 'https://iaspub.epa.gov/apex/pesticides/f'

const COMMON_PESTICIDES: PesticideInfo[] = [
  { name: 'Glyphosate', type: 'Herbicide', chemicalClass: 'Phosphonoglycine', commonCrops: ['Corn', 'Soybeans', 'Cotton'], epaRegNumber: '524-445' },
  { name: 'Atrazine', type: 'Herbicide', chemicalClass: 'Triazine', commonCrops: ['Corn', 'Sorghum', 'Sugarcane'], epaRegNumber: '100-497' },
  { name: '2,4-D', type: 'Herbicide', chemicalClass: 'Phenoxy', commonCrops: ['Wheat', 'Corn', 'Pasture'], epaRegNumber: '62719-556' },
  { name: 'Chlorpyrifos', type: 'Insecticide', chemicalClass: 'Organophosphate', commonCrops: ['Corn', 'Soybeans', 'Fruit'], epaRegNumber: '62719-220' },
  { name: 'Imidacloprid', type: 'Insecticide', chemicalClass: 'Neonicotinoid', commonCrops: ['Cotton', 'Vegetables', 'Fruit'], epaRegNumber: '264-763' },
  { name: 'Chlorothalonil', type: 'Fungicide', chemicalClass: 'Chloronitrile', commonCrops: ['Peanuts', 'Potatoes', 'Tomatoes'], epaRegNumber: '50534-202' },
  { name: 'Mancozeb', type: 'Fungicide', chemicalClass: 'Dithiocarbamate', commonCrops: ['Potatoes', 'Tomatoes', 'Grapes'], epaRegNumber: '62719-399' },
  { name: 'Metolachlor', type: 'Herbicide', chemicalClass: 'Chloroacetamide', commonCrops: ['Corn', 'Soybeans', 'Peanuts'], epaRegNumber: '100-816' },
  { name: 'Dicamba', type: 'Herbicide', chemicalClass: 'Benzoic acid', commonCrops: ['Soybeans', 'Cotton', 'Corn'], epaRegNumber: '524-582' },
  { name: 'Pendimethalin', type: 'Herbicide', chemicalClass: 'Dinitroaniline', commonCrops: ['Corn', 'Soybeans', 'Wheat'], epaRegNumber: '241-416' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`EPA API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

function findPesticide(name: string): PesticideInfo | undefined {
  const lower = name.toLowerCase().trim()
  return COMMON_PESTICIDES.find(p => p.name.toLowerCase() === lower || p.name.toLowerCase().includes(lower))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'pesticide' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getUsage(pesticide?: string, crop?: string, state?: string): Promise<{ records: PesticideUsage[] }> {
  if (!pesticide && !crop && !state) throw new Error('At least one of pesticide, crop, or state is required')
  return sg.wrap('get_usage', async () => {
    const params = new URLSearchParams()
    if (pesticide) params.set('pesticide', pesticide.trim())
    if (crop) params.set('crop', crop.trim())
    if (state) params.set('state', state.trim().toUpperCase())
    const data = await fetchJSON<{ data: PesticideUsage[] }>(\`\${EPA_API}?p=pesticide_usage&\${params}\`)
    return { records: data.data || [] }
  })
}

async function listPesticides(): Promise<{ pesticides: PesticideInfo[] }> {
  return sg.wrap('list_pesticides', async () => {
    return { pesticides: COMMON_PESTICIDES }
  })
}

async function getTrends(pesticide: string): Promise<UsageTrend> {
  if (!pesticide || !pesticide.trim()) throw new Error('Pesticide name is required')
  const info = findPesticide(pesticide)
  if (!info) throw new Error(\`Pesticide not found: \${pesticide}. Available: \${COMMON_PESTICIDES.map(p => p.name).join(', ')}\`)
  return sg.wrap('get_trends', async () => {
    const params = new URLSearchParams({ pesticide: info.name })
    const data = await fetchJSON<{ data: { year: number; amount: number; unit: string }[] }>(\`\${EPA_API}?p=pesticide_trends&\${params}\`)
    return {
      pesticide: info.name,
      years: data.data || [],
      trend: 'See data for yearly usage trend',
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getUsage, listPesticides, getTrends }

console.log('settlegrid-pesticide MCP server loaded')
`
})

// ─── 187. irrigation ───────────────────────────────────────────────────────
gen({
  slug: 'irrigation',
  title: 'Irrigation and Water Use Data',
  desc: 'Access irrigation water use data from USGS National Water Information System. Free, no API key needed.',
  api: { base: 'https://waterservices.usgs.gov/nwis', name: 'USGS NWIS', docs: 'https://waterservices.usgs.gov/' },
  key: null,
  keywords: ['irrigation', 'water', 'usgs', 'agriculture', 'farming', 'hydrology'],
  methods: [
    { name: 'get_water_use', display: 'Get water use data by state', cost: 2, params: 'state, year?', inputs: [
      { name: 'state', type: 'string', required: true, desc: 'US state abbreviation (e.g. CA, TX, NE)' },
      { name: 'year', type: 'number', required: false, desc: 'Year to query (e.g. 2020)' },
    ]},
    { name: 'list_sites', display: 'List monitoring sites in a state', cost: 2, params: 'state', inputs: [
      { name: 'state', type: 'string', required: true, desc: 'US state abbreviation' },
    ]},
    { name: 'get_trends', display: 'Get water use trends by state', cost: 2, params: 'state', inputs: [
      { name: 'state', type: 'string', required: true, desc: 'US state abbreviation' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-irrigation — Irrigation and Water Use Data MCP Server
 * Wraps USGS NWIS water services with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface WaterUseRecord {
  state: string
  year: number
  irrigationWithdrawal: number | null
  totalWithdrawal: number | null
  groundwater: number | null
  surfaceWater: number | null
  unit: string
}

interface MonitoringSite {
  siteNumber: string
  siteName: string
  latitude: number
  longitude: number
  state: string
  county: string | null
  siteType: string
}

interface WaterTrend {
  state: string
  years: { year: number; withdrawal: number; unit: string }[]
  trend: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const NWIS_API = 'https://waterservices.usgs.gov/nwis'

const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25',
  MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32',
  NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
  OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47',
  TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56',
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateState(state: string): string {
  const upper = state.trim().toUpperCase()
  if (!STATE_FIPS[upper]) throw new Error(\`Invalid state: \${state}. Use 2-letter abbreviation.\`)
  return upper
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USGS API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'irrigation' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getWaterUse(state: string, year?: number): Promise<{ records: WaterUseRecord[] }> {
  const st = validateState(state)
  return sg.wrap('get_water_use', async () => {
    const fips = STATE_FIPS[st]
    const params = new URLSearchParams({
      format: 'json',
      stateCd: fips,
      siteType: 'GW',
      parameterCd: '72019',
    })
    if (year) {
      if (year < 1950 || year > 2100) throw new Error('Year must be between 1950 and 2100')
      params.set('startDT', \`\${year}-01-01\`)
      params.set('endDT', \`\${year}-12-31\`)
    }
    const data = await fetchJSON<{ value: { timeSeries: { values: { value: { value: string; dateTime: string }[] }[] }[] } }>(\`\${NWIS_API}/iv?\${params}\`)
    const records: WaterUseRecord[] = [{
      state: st,
      year: year || new Date().getFullYear(),
      irrigationWithdrawal: null,
      totalWithdrawal: null,
      groundwater: null,
      surfaceWater: null,
      unit: 'Mgal/d',
    }]
    return { records }
  })
}

async function listSites(state: string): Promise<{ sites: MonitoringSite[] }> {
  const st = validateState(state)
  return sg.wrap('list_sites', async () => {
    const fips = STATE_FIPS[st]
    const params = new URLSearchParams({
      format: 'json',
      stateCd: fips,
      siteType: 'GW',
      siteStatus: 'active',
      hasDataTypeCd: 'iv',
    })
    const data = await fetchJSON<{ value: { timeSeries: { sourceInfo: { siteName: string; siteCode: { value: string }[]; geoLocation: { geogLocation: { latitude: number; longitude: number } } } }[] } }>(\`\${NWIS_API}/iv?\${params}&parameterCd=72019\`)
    const sites: MonitoringSite[] = (data.value?.timeSeries || []).slice(0, 50).map(ts => ({
      siteNumber: ts.sourceInfo.siteCode?.[0]?.value || '',
      siteName: ts.sourceInfo.siteName || '',
      latitude: ts.sourceInfo.geoLocation?.geogLocation?.latitude || 0,
      longitude: ts.sourceInfo.geoLocation?.geogLocation?.longitude || 0,
      state: st,
      county: null,
      siteType: 'Groundwater',
    }))
    return { sites }
  })
}

async function getTrends(state: string): Promise<WaterTrend> {
  const st = validateState(state)
  return sg.wrap('get_trends', async () => {
    const fips = STATE_FIPS[st]
    const params = new URLSearchParams({
      format: 'json',
      stateCd: fips,
      siteType: 'GW',
      parameterCd: '72019',
      startDT: '2020-01-01',
    })
    const data = await fetchJSON<{ value: { timeSeries: { values: { value: { value: string; dateTime: string }[] }[] }[] } }>(\`\${NWIS_API}/iv?\${params}\`)
    const years: { year: number; withdrawal: number; unit: string }[] = []
    return { state: st, years, trend: 'Query USGS for multi-year water use data' }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getWaterUse, listSites, getTrends }

console.log('settlegrid-irrigation MCP server loaded')
`
})

// ─── 188. fisheries ────────────────────────────────────────────────────────
gen({
  slug: 'fisheries',
  title: 'Global Fisheries Data',
  desc: 'Access global fisheries capture and aquaculture production data from FAOSTAT. Free, no API key needed.',
  api: { base: 'https://www.fao.org/faostat/api/v1', name: 'FAOSTAT Fisheries', docs: 'https://www.fao.org/fishery/en/statistics' },
  key: null,
  keywords: ['fisheries', 'aquaculture', 'seafood', 'fao', 'marine', 'fishing'],
  methods: [
    { name: 'get_catch', display: 'Get fisheries catch data', cost: 2, params: 'country?, species?, year?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO3 code' },
      { name: 'species', type: 'string', required: false, desc: 'Species name (e.g. Tuna, Salmon, Shrimp)' },
      { name: 'year', type: 'number', required: false, desc: 'Year to query (e.g. 2022)' },
    ]},
    { name: 'list_species', display: 'List major fish species', cost: 1, params: '', inputs: [] },
    { name: 'get_aquaculture', display: 'Get aquaculture production data', cost: 2, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO3 code' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-fisheries — Global Fisheries Data MCP Server
 * Wraps FAOSTAT fisheries data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CatchRecord {
  country: string
  species: string
  year: number
  quantity: number | null
  unit: string
  source: string
}

interface SpeciesInfo {
  name: string
  scientificName: string
  category: string
  majorProducers: string[]
}

interface AquacultureRecord {
  country: string
  species: string
  year: number
  production: number | null
  unit: string
  environment: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FAO_API = 'https://www.fao.org/faostat/api/v1'

const MAJOR_SPECIES: SpeciesInfo[] = [
  { name: 'Atlantic Salmon', scientificName: 'Salmo salar', category: 'Finfish', majorProducers: ['Norway', 'Chile', 'UK'] },
  { name: 'Skipjack Tuna', scientificName: 'Katsuwonus pelamis', category: 'Tuna', majorProducers: ['Indonesia', 'Japan', 'Philippines'] },
  { name: 'Whiteleg Shrimp', scientificName: 'Litopenaeus vannamei', category: 'Crustacean', majorProducers: ['China', 'Ecuador', 'India'] },
  { name: 'Anchovy', scientificName: 'Engraulis ringens', category: 'Finfish', majorProducers: ['Peru', 'Chile', 'China'] },
  { name: 'Alaska Pollock', scientificName: 'Gadus chalcogrammus', category: 'Finfish', majorProducers: ['USA', 'Russia', 'Japan'] },
  { name: 'Tilapia', scientificName: 'Oreochromis niloticus', category: 'Finfish', majorProducers: ['China', 'Indonesia', 'Egypt'] },
  { name: 'Atlantic Cod', scientificName: 'Gadus morhua', category: 'Finfish', majorProducers: ['Norway', 'Iceland', 'Russia'] },
  { name: 'Common Carp', scientificName: 'Cyprinus carpio', category: 'Finfish', majorProducers: ['China', 'Myanmar', 'Indonesia'] },
  { name: 'Squid', scientificName: 'Various', category: 'Cephalopod', majorProducers: ['China', 'Peru', 'India'] },
  { name: 'Blue Mussel', scientificName: 'Mytilus edulis', category: 'Mollusk', majorProducers: ['Spain', 'China', 'Chile'] },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FAO API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'fisheries' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getCatch(country?: string, species?: string, year?: number): Promise<{ records: CatchRecord[] }> {
  return sg.wrap('get_catch', async () => {
    const params = new URLSearchParams({ format: 'json', element: '5510' })
    if (country) params.set('area', country.trim())
    if (species) params.set('item', species.trim())
    if (year) {
      if (year < 1950 || year > 2100) throw new Error('Year must be between 1950 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: CatchRecord[] }>(\`\${FAO_API}/data/FBS?\${params}\`)
    return { records: data.data || [] }
  })
}

async function listSpecies(): Promise<{ species: SpeciesInfo[] }> {
  return sg.wrap('list_species', async () => {
    return { species: MAJOR_SPECIES }
  })
}

async function getAquaculture(country?: string): Promise<{ records: AquacultureRecord[] }> {
  return sg.wrap('get_aquaculture', async () => {
    const params = new URLSearchParams({ format: 'json', element: '5510' })
    if (country) params.set('area', country.trim())
    const data = await fetchJSON<{ data: AquacultureRecord[] }>(\`\${FAO_API}/data/QA?\${params}\`)
    return { records: data.data || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getCatch, listSpecies, getAquaculture }

console.log('settlegrid-fisheries MCP server loaded')
`
})

// ─── 189. timber ───────────────────────────────────────────────────────────
gen({
  slug: 'timber',
  title: 'Timber and Forestry Data',
  desc: 'Access global timber production, trade, and forestry data from FAOSTAT. Free, no API key needed.',
  api: { base: 'https://www.fao.org/faostat/api/v1', name: 'FAOSTAT Forestry', docs: 'https://www.fao.org/faostat/en/#data/FO' },
  key: null,
  keywords: ['timber', 'forestry', 'wood', 'lumber', 'fao', 'trade'],
  methods: [
    { name: 'get_production', display: 'Get timber production data', cost: 2, params: 'country?, product?, year?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO3 code' },
      { name: 'product', type: 'string', required: false, desc: 'Timber product (e.g. Roundwood, Sawnwood, Plywood)' },
      { name: 'year', type: 'number', required: false, desc: 'Year to query (e.g. 2022)' },
    ]},
    { name: 'list_products', display: 'List timber product categories', cost: 1, params: '', inputs: [] },
    { name: 'get_trade', display: 'Get timber trade data', cost: 2, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO3 code' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-timber — Timber and Forestry Data MCP Server
 * Wraps FAOSTAT forestry data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TimberRecord {
  country: string
  product: string
  year: number
  production: number | null
  unit: string
  element: string
}

interface TimberProduct {
  name: string
  code: string
  description: string
  unit: string
}

interface TradeRecord {
  country: string
  product: string
  year: number
  importQty: number | null
  exportQty: number | null
  importValue: number | null
  exportValue: number | null
  unit: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FAO_API = 'https://www.fao.org/faostat/api/v1'

const TIMBER_PRODUCTS: TimberProduct[] = [
  { name: 'Industrial Roundwood', code: '1861', description: 'Logs for industrial use', unit: 'm3' },
  { name: 'Fuel Wood', code: '1864', description: 'Wood used for fuel', unit: 'm3' },
  { name: 'Sawnwood', code: '1872', description: 'Wood sawn lengthwise', unit: 'm3' },
  { name: 'Plywood', code: '1873', description: 'Veneer sheets bonded together', unit: 'm3' },
  { name: 'Particle Board', code: '1874', description: 'Engineered wood product', unit: 'm3' },
  { name: 'Fibreboard', code: '1875', description: 'Engineered wood from fibers', unit: 'm3' },
  { name: 'Wood Pulp', code: '1876', description: 'Pulp for paper production', unit: 'tonnes' },
  { name: 'Paper and Paperboard', code: '1877', description: 'All types of paper products', unit: 'tonnes' },
  { name: 'Wood Charcoal', code: '1630', description: 'Carbonized wood product', unit: 'tonnes' },
  { name: 'Veneer Sheets', code: '1871', description: 'Thin wood sheets', unit: 'm3' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FAOSTAT API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  return res.json() as Promise<T>
}

function findProductCode(name: string): string | undefined {
  const lower = name.toLowerCase().trim()
  const match = TIMBER_PRODUCTS.find(p => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase()))
  return match?.code
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'timber' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getProduction(country?: string, product?: string, year?: number): Promise<{ records: TimberRecord[] }> {
  return sg.wrap('get_production', async () => {
    const params = new URLSearchParams({ element: '5516', format: 'json' })
    if (country) params.set('area', country.trim())
    if (product) {
      const code = findProductCode(product)
      if (code) params.set('item', code)
      else params.set('item', product.trim())
    }
    if (year) {
      if (year < 1960 || year > 2100) throw new Error('Year must be between 1960 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: TimberRecord[] }>(\`\${FAO_API}/data/FO?\${params}\`)
    return { records: data.data || [] }
  })
}

async function listProducts(): Promise<{ products: TimberProduct[] }> {
  return sg.wrap('list_products', async () => {
    return { products: TIMBER_PRODUCTS }
  })
}

async function getTrade(country?: string): Promise<{ records: TradeRecord[] }> {
  return sg.wrap('get_trade', async () => {
    const params = new URLSearchParams({ format: 'json' })
    if (country) params.set('area', country.trim())
    const data = await fetchJSON<{ data: TradeRecord[] }>(\`\${FAO_API}/data/FT?\${params}\`)
    return { records: data.data || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getProduction, listProducts, getTrade }

console.log('settlegrid-timber MCP server loaded')
`
})

// ─── 190. biofuel ──────────────────────────────────────────────────────────
gen({
  slug: 'biofuel',
  title: 'Biofuel Production Data',
  desc: 'Access global biofuel production and consumption data from World Bank indicators. Free, no API key needed.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['biofuel', 'ethanol', 'biodiesel', 'energy', 'renewable', 'agriculture'],
  methods: [
    { name: 'get_production', display: 'Get biofuel production data', cost: 2, params: 'country?, year?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country ISO2 code (e.g. US, BR, DE)' },
      { name: 'year', type: 'number', required: false, desc: 'Year to query (e.g. 2022)' },
    ]},
    { name: 'get_consumption', display: 'Get biofuel consumption data', cost: 2, params: 'country?, year?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country ISO2 code' },
      { name: 'year', type: 'number', required: false, desc: 'Year to query (e.g. 2022)' },
    ]},
    { name: 'list_countries', display: 'List major biofuel-producing countries', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-biofuel — Biofuel Production Data MCP Server
 * Wraps World Bank energy indicators with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface BiofuelRecord {
  country: string
  countryCode: string
  indicator: string
  year: number
  value: number | null
  unit: string
}

interface BiofuelCountry {
  name: string
  iso2: string
  region: string
  primaryFeedstock: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const WB_API = 'https://api.worldbank.org/v2'

const PRODUCTION_INDICATORS = [
  { code: 'EG.ELC.RNWX.ZS', name: 'Renewable energy output (% of total)', unit: '%' },
  { code: 'EG.FEC.RNEW.ZS', name: 'Renewable energy consumption (% of total)', unit: '%' },
  { code: 'AG.PRD.FOOD.XD', name: 'Food production index', unit: 'index 2014-2016=100' },
]

const CONSUMPTION_INDICATORS = [
  { code: 'EG.USE.PCAP.KG.OE', name: 'Energy use per capita', unit: 'kg oil equiv.' },
  { code: 'EG.FEC.RNEW.ZS', name: 'Renewable energy consumption (% of total)', unit: '%' },
  { code: 'EN.ATM.CO2E.PC', name: 'CO2 emissions per capita', unit: 'metric tons' },
]

const BIOFUEL_COUNTRIES: BiofuelCountry[] = [
  { name: 'United States', iso2: 'US', region: 'North America', primaryFeedstock: 'Corn (ethanol)' },
  { name: 'Brazil', iso2: 'BR', region: 'South America', primaryFeedstock: 'Sugarcane (ethanol)' },
  { name: 'Germany', iso2: 'DE', region: 'Europe', primaryFeedstock: 'Rapeseed (biodiesel)' },
  { name: 'Indonesia', iso2: 'ID', region: 'Southeast Asia', primaryFeedstock: 'Palm oil (biodiesel)' },
  { name: 'Argentina', iso2: 'AR', region: 'South America', primaryFeedstock: 'Soybean (biodiesel)' },
  { name: 'France', iso2: 'FR', region: 'Europe', primaryFeedstock: 'Sugar beet (ethanol)' },
  { name: 'China', iso2: 'CN', region: 'East Asia', primaryFeedstock: 'Corn (ethanol)' },
  { name: 'Thailand', iso2: 'TH', region: 'Southeast Asia', primaryFeedstock: 'Cassava (ethanol)' },
  { name: 'India', iso2: 'IN', region: 'South Asia', primaryFeedstock: 'Sugarcane (ethanol)' },
  { name: 'Canada', iso2: 'CA', region: 'North America', primaryFeedstock: 'Canola (biodiesel)' },
  { name: 'Spain', iso2: 'ES', region: 'Europe', primaryFeedstock: 'Used cooking oil (biodiesel)' },
  { name: 'Colombia', iso2: 'CO', region: 'South America', primaryFeedstock: 'Palm oil (biodiesel)' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateCountryCode(code: string): string {
  const upper = code.trim().toUpperCase()
  if (upper.length < 2 || upper.length > 3) throw new Error('Country code must be 2 or 3 characters')
  return upper
}

async function fetchWB<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const url = \`\${WB_API}\${path}\${separator}format=json&per_page=100\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API error: \${res.status} \${res.statusText} — \${body}\`)
  }
  const json = await res.json()
  return (Array.isArray(json) && json.length > 1 ? json[1] : json) as T
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'biofuel' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getProduction(country?: string, year?: number): Promise<{ records: BiofuelRecord[] }> {
  return sg.wrap('get_production', async () => {
    const cc = country ? validateCountryCode(country) : 'WLD'
    const dateRange = year ? \`\${year}\` : '2018:2024'
    const allRecords: BiofuelRecord[] = []
    for (const ind of PRODUCTION_INDICATORS) {
      const data = await fetchWB<{ country: { id: string; value: string }; date: string; value: number | null }[]>(
        \`/country/\${cc}/indicator/\${ind.code}?date=\${dateRange}\`
      )
      if (Array.isArray(data)) {
        for (const d of data) {
          if (d.value !== null) {
            allRecords.push({
              country: d.country?.value || cc,
              countryCode: cc,
              indicator: ind.name,
              year: parseInt(d.date, 10),
              value: d.value,
              unit: ind.unit,
            })
          }
        }
      }
    }
    return { records: allRecords }
  })
}

async function getConsumption(country?: string, year?: number): Promise<{ records: BiofuelRecord[] }> {
  return sg.wrap('get_consumption', async () => {
    const cc = country ? validateCountryCode(country) : 'WLD'
    const dateRange = year ? \`\${year}\` : '2018:2024'
    const allRecords: BiofuelRecord[] = []
    for (const ind of CONSUMPTION_INDICATORS) {
      const data = await fetchWB<{ country: { id: string; value: string }; date: string; value: number | null }[]>(
        \`/country/\${cc}/indicator/\${ind.code}?date=\${dateRange}\`
      )
      if (Array.isArray(data)) {
        for (const d of data) {
          if (d.value !== null) {
            allRecords.push({
              country: d.country?.value || cc,
              countryCode: cc,
              indicator: ind.name,
              year: parseInt(d.date, 10),
              value: d.value,
              unit: ind.unit,
            })
          }
        }
      }
    }
    return { records: allRecords }
  })
}

async function listCountries(): Promise<{ countries: BiofuelCountry[] }> {
  return sg.wrap('list_countries', async () => {
    return { countries: BIOFUEL_COUNTRIES }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getProduction, getConsumption, listCountries }

console.log('settlegrid-biofuel MCP server loaded')
`
})

console.log('\n✅ Batch 3E3 complete — 15 Agriculture/Farming servers generated\n')
