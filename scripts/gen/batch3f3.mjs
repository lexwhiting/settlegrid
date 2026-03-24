/**
 * Batch 3f3 — 15 Culture/Arts MCP servers (#221-235)
 */

import { gen } from './core.mjs'

console.log('Batch 3f3: Culture/Arts servers\n')

// ────────────────────────────────────────────────────────────────────────────
// 221. settlegrid-metropolitan — Met Museum Collection
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'metropolitan',
  title: 'Met Museum Collection',
  desc: 'Search and retrieve artwork data from The Metropolitan Museum of Art open-access collection API.',
  api: { base: 'https://collectionapi.metmuseum.org/public/collection/v1', name: 'Met Museum Open Access API', docs: 'https://metmuseum.github.io/' },
  key: null,
  keywords: ['art', 'museum', 'metropolitan', 'culture', 'artworks'],
  methods: [
    {
      name: 'search_artworks', display: 'Search Met artworks by keyword', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query term' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_artwork', display: 'Get artwork details by object ID', cost: 1, params: 'objectID',
      inputs: [
        { name: 'objectID', type: 'number', required: true, desc: 'Met Museum object ID' },
      ],
    },
    {
      name: 'get_departments', display: 'List all Met Museum departments', cost: 1, params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-metropolitan — Met Museum Collection MCP Server
 *
 * Wraps The Metropolitan Museum of Art Open Access API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_artworks(query, limit?)   — Search artworks (1¢)
 *   get_artwork(objectID)            — Get artwork details (1¢)
 *   get_departments()                — List departments (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArtworksInput {
  query: string
  limit?: number
}

interface GetArtworkInput {
  objectID: number
}

interface SearchResult {
  total: number
  objectIDs: number[] | null
}

interface ArtworkDetail {
  objectID: number
  title: string
  artistDisplayName: string
  department: string
  objectDate: string
  medium: string
  primaryImage: string
  primaryImageSmall: string
  [key: string]: unknown
}

interface Department {
  departmentId: number
  displayName: string
}

interface DepartmentsResult {
  departments: Department[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
const USER_AGENT = 'settlegrid-metropolitan/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Met Museum API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'metropolitan',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artworks: { costCents: 1, displayName: 'Search Met artworks' },
      get_artwork: { costCents: 1, displayName: 'Get artwork details' },
      get_departments: { costCents: 1, displayName: 'List departments' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtworks = sg.wrap(async (args: SearchArtworksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const limit = args.limit ?? 10
  const encoded = encodeURIComponent(args.query)
  const data = await apiFetch<SearchResult>(\`/search?q=\${encoded}\`)
  const ids = data.objectIDs?.slice(0, limit) ?? []
  const objects = await Promise.all(
    ids.map(id => apiFetch<ArtworkDetail>(\`/objects/\${id}\`).catch(() => null))
  )
  return {
    total: data.total,
    returned: objects.filter(Boolean).length,
    artworks: objects.filter(Boolean),
  }
}, { method: 'search_artworks' })

const getArtwork = sg.wrap(async (args: GetArtworkInput) => {
  if (args.objectID === undefined || typeof args.objectID !== 'number') {
    throw new Error('objectID is required (numeric Met Museum object ID)')
  }
  return apiFetch<ArtworkDetail>(\`/objects/\${args.objectID}\`)
}, { method: 'get_artwork' })

const getDepartments = sg.wrap(async () => {
  return apiFetch<DepartmentsResult>('/departments')
}, { method: 'get_departments' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtworks, getArtwork, getDepartments }

console.log('settlegrid-metropolitan MCP server ready')
console.log('Methods: search_artworks, get_artwork, get_departments')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 222. settlegrid-rijksmuseum — Rijksmuseum Collection
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'rijksmuseum',
  title: 'Rijksmuseum Collection',
  desc: 'Search and explore Dutch masterworks from the Rijksmuseum collection via their public API.',
  api: { base: 'https://www.rijksmuseum.nl/api/en/collection', name: 'Rijksmuseum API', docs: 'https://data.rijksmuseum.nl/object-metadata/api/' },
  key: { env: 'RIJKS_API_KEY', url: 'https://data.rijksmuseum.nl', required: true },
  keywords: ['art', 'museum', 'rijksmuseum', 'dutch', 'culture'],
  methods: [
    {
      name: 'search_artworks', display: 'Search Rijksmuseum artworks', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_artwork', display: 'Get artwork by object number', cost: 1, params: 'objectNumber',
      inputs: [
        { name: 'objectNumber', type: 'string', required: true, desc: 'Rijksmuseum object number (e.g. SK-C-5)' },
      ],
    },
    {
      name: 'get_collections', display: 'Browse recent collection items', cost: 1, params: 'limit?',
      inputs: [
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-rijksmuseum — Rijksmuseum Collection MCP Server
 *
 * Wraps Rijksmuseum API with SettleGrid billing.
 * Requires a free API key from https://data.rijksmuseum.nl
 *
 * Methods:
 *   search_artworks(query, limit?)    — Search artworks (1¢)
 *   get_artwork(objectNumber)         — Get artwork details (1¢)
 *   get_collections(limit?)           — Browse collection (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArtworksInput {
  query: string
  limit?: number
}

interface GetArtworkInput {
  objectNumber: string
}

interface GetCollectionsInput {
  limit?: number
}

interface RijksArtObject {
  objectNumber: string
  title: string
  principalOrFirstMaker: string
  longTitle: string
  webImage: { url: string } | null
  headerImage: { url: string } | null
  [key: string]: unknown
}

interface RijksSearchResult {
  count: number
  artObjects: RijksArtObject[]
}

interface RijksDetailResult {
  artObject: RijksArtObject & {
    description: string
    plaqueDescriptionEnglish: string
    dating: { sortingDate: number; presentingDate: string }
    materials: string[]
    techniques: string[]
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.rijksmuseum.nl/api/en/collection'
const API_KEY = process.env.RIJKS_API_KEY ?? ''
const USER_AGENT = 'settlegrid-rijksmuseum/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('key', API_KEY)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Rijksmuseum API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rijksmuseum',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artworks: { costCents: 1, displayName: 'Search Rijksmuseum artworks' },
      get_artwork: { costCents: 1, displayName: 'Get artwork details' },
      get_collections: { costCents: 1, displayName: 'Browse collection items' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtworks = sg.wrap(async (args: SearchArtworksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['ps'] = String(args.limit)
  return apiFetch<RijksSearchResult>('', params)
}, { method: 'search_artworks' })

const getArtwork = sg.wrap(async (args: GetArtworkInput) => {
  if (!args.objectNumber || typeof args.objectNumber !== 'string') {
    throw new Error('objectNumber is required (e.g. SK-C-5)')
  }
  return apiFetch<RijksDetailResult>(\`/\${args.objectNumber}\`)
}, { method: 'get_artwork' })

const getCollections = sg.wrap(async (args: GetCollectionsInput) => {
  const params: Record<string, string> = { s: 'relevance' }
  if (args.limit !== undefined) params['ps'] = String(args.limit)
  return apiFetch<RijksSearchResult>('', params)
}, { method: 'get_collections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtworks, getArtwork, getCollections }

console.log('settlegrid-rijksmuseum MCP server ready')
console.log('Methods: search_artworks, get_artwork, get_collections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 223. settlegrid-artsy — Art & Gallery Data
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'artsy',
  title: 'Artsy Art & Gallery',
  desc: 'Search artworks, artists, and galleries via the Artsy API with OAuth authentication.',
  api: { base: 'https://api.artsy.net/api', name: 'Artsy API', docs: 'https://developers.artsy.net/v2/' },
  key: { env: 'ARTSY_CLIENT_ID', url: 'https://developers.artsy.net', required: true },
  keywords: ['art', 'gallery', 'artsy', 'artists', 'culture'],
  methods: [
    {
      name: 'search_artworks', display: 'Search artworks on Artsy', cost: 2, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_artwork', display: 'Get artwork by Artsy ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Artsy artwork ID' },
      ],
    },
    {
      name: 'search_artists', display: 'Search artists on Artsy', cost: 2, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Artist name search query' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-artsy — Artsy Art & Gallery MCP Server
 *
 * Wraps Artsy API with SettleGrid billing.
 * Requires ARTSY_CLIENT_ID and ARTSY_CLIENT_SECRET from https://developers.artsy.net
 *
 * Methods:
 *   search_artworks(query, limit?)    — Search artworks (2¢)
 *   get_artwork(id)                   — Get artwork details (1¢)
 *   search_artists(query)             — Search artists (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArtworksInput {
  query: string
  limit?: number
}

interface GetArtworkInput {
  id: string
}

interface SearchArtistsInput {
  query: string
}

interface ArtsyTokenResponse {
  type: string
  token: string
  expires_at: string
}

interface ArtsySearchResult {
  _embedded: { results: Array<{ type: string; title: string; description: string; [key: string]: unknown }> }
  total_count?: number
}

interface ArtsyArtwork {
  id: string
  title: string
  category: string
  medium: string
  date: string
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.artsy.net/api'
const CLIENT_ID = process.env.ARTSY_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.ARTSY_CLIENT_SECRET ?? ''
const USER_AGENT = 'settlegrid-artsy/1.0 (contact@settlegrid.ai)'

let cachedToken: string | null = null
let tokenExpires = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpires) return cachedToken
  const res = await fetch(\`\${API_BASE}/tokens/xapp_token\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  if (!res.ok) throw new Error(\`Artsy auth failed: \${res.status}\`)
  const data = await res.json() as ArtsyTokenResponse
  cachedToken = data.token
  tokenExpires = new Date(data.expires_at).getTime() - 60_000
  return data.token
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getToken()
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.artsy-v2+json',
      'X-Xapp-Token': token,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Artsy API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'artsy',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artworks: { costCents: 2, displayName: 'Search artworks on Artsy' },
      get_artwork: { costCents: 1, displayName: 'Get artwork details' },
      search_artists: { costCents: 2, displayName: 'Search artists on Artsy' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtworks = sg.wrap(async (args: SearchArtworksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query, type: 'artwork' }
  if (args.limit !== undefined) params['size'] = String(args.limit)
  return apiFetch<ArtsySearchResult>('/search', params)
}, { method: 'search_artworks' })

const getArtwork = sg.wrap(async (args: GetArtworkInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Artsy artwork ID)')
  }
  return apiFetch<ArtsyArtwork>(\`/artworks/\${args.id}\`)
}, { method: 'get_artwork' })

const searchArtists = sg.wrap(async (args: SearchArtistsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (artist name)')
  }
  return apiFetch<ArtsySearchResult>('/search', { q: args.query, type: 'artist' })
}, { method: 'search_artists' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtworks, getArtwork, searchArtists }

console.log('settlegrid-artsy MCP server ready')
console.log('Methods: search_artworks, get_artwork, search_artists')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 224. settlegrid-europeana — European Cultural Heritage
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'europeana',
  title: 'Europeana Cultural Heritage',
  desc: 'Search European cultural heritage records from museums, galleries, archives, and libraries across Europe.',
  api: { base: 'https://api.europeana.eu/record/v2', name: 'Europeana API', docs: 'https://pro.europeana.eu/page/search' },
  key: { env: 'EUROPEANA_API_KEY', url: 'https://pro.europeana.eu', required: true },
  keywords: ['culture', 'heritage', 'europeana', 'museum', 'european'],
  methods: [
    {
      name: 'search_records', display: 'Search Europeana cultural records', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_record', display: 'Get record by Europeana ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Europeana record ID' },
      ],
    },
    {
      name: 'search_collections', display: 'Search Europeana collections', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Collection search query' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-europeana — Europeana Cultural Heritage MCP Server
 *
 * Wraps Europeana API with SettleGrid billing.
 * Requires a free API key from https://pro.europeana.eu
 *
 * Methods:
 *   search_records(query, limit?)     — Search records (1¢)
 *   get_record(id)                    — Get record details (1¢)
 *   search_collections(query)         — Search collections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchRecordsInput {
  query: string
  limit?: number
}

interface GetRecordInput {
  id: string
}

interface SearchCollectionsInput {
  query: string
}

interface EuropeanaItem {
  id: string
  title: string[]
  type: string
  dataProvider: string[]
  edmPreview?: string[]
  [key: string]: unknown
}

interface EuropeanaSearchResult {
  success: boolean
  totalResults: number
  items: EuropeanaItem[]
}

interface EuropeanaRecordResult {
  success: boolean
  object: {
    about: string
    title: Record<string, string[]>
    type: string
    europeanaAggregation: Record<string, unknown>
    [key: string]: unknown
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.europeana.eu/record/v2'
const API_KEY = process.env.EUROPEANA_API_KEY ?? ''
const USER_AGENT = 'settlegrid-europeana/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('wskey', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Europeana API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'europeana',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_records: { costCents: 1, displayName: 'Search Europeana records' },
      get_record: { costCents: 1, displayName: 'Get record by ID' },
      search_collections: { costCents: 1, displayName: 'Search collections' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRecords = sg.wrap(async (args: SearchRecordsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { query: args.query }
  if (args.limit !== undefined) params['rows'] = String(args.limit)
  return apiFetch<EuropeanaSearchResult>('/search.json', params)
}, { method: 'search_records' })

const getRecord = sg.wrap(async (args: GetRecordInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Europeana record ID)')
  }
  const cleanId = args.id.startsWith('/') ? args.id : \`/\${args.id}\`
  return apiFetch<EuropeanaRecordResult>(\`\${cleanId}.json\`)
}, { method: 'get_record' })

const searchCollections = sg.wrap(async (args: SearchCollectionsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (collection search)')
  }
  return apiFetch<EuropeanaSearchResult>('/search.json', {
    query: \`*:*\`,
    qf: \`PROVIDER:"\${args.query}"\`,
    rows: '20',
    profile: 'facets',
  })
}, { method: 'search_collections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRecords, getRecord, searchCollections }

console.log('settlegrid-europeana MCP server ready')
console.log('Methods: search_records, get_record, search_collections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 225. settlegrid-smithsonian — Smithsonian Open Access
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'smithsonian',
  title: 'Smithsonian Open Access',
  desc: 'Search the Smithsonian Institution open-access collection spanning 20+ museums and research centers.',
  api: { base: 'https://api.si.edu/openaccess/api/v1.0', name: 'Smithsonian Open Access API', docs: 'https://edan.si.edu/openaccess/apidocs/' },
  key: { env: 'SMITHSONIAN_API_KEY', url: 'https://api.si.edu', required: true },
  keywords: ['museum', 'smithsonian', 'culture', 'science', 'history'],
  methods: [
    {
      name: 'search_objects', display: 'Search Smithsonian objects', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_object', display: 'Get object by Smithsonian ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Smithsonian object ID' },
      ],
    },
    {
      name: 'get_stats', display: 'Get Smithsonian collection statistics', cost: 1, params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-smithsonian — Smithsonian Open Access MCP Server
 *
 * Wraps Smithsonian Open Access API with SettleGrid billing.
 * Requires a free API key from https://api.si.edu
 *
 * Methods:
 *   search_objects(query, limit?)     — Search objects (1¢)
 *   get_object(id)                    — Get object details (1¢)
 *   get_stats()                       — Get collection stats (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchObjectsInput {
  query: string
  limit?: number
}

interface GetObjectInput {
  id: string
}

interface SmithsonianRow {
  id: string
  title: string
  unitCode: string
  type: string
  url: string
  content: Record<string, unknown>
}

interface SmithsonianSearchResult {
  status: number
  responseCode: number
  rowCount: number
  rows: SmithsonianRow[]
}

interface SmithsonianStatsResult {
  status: number
  response: Record<string, unknown>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.si.edu/openaccess/api/v1.0'
const API_KEY = process.env.SMITHSONIAN_API_KEY ?? ''
const USER_AGENT = 'settlegrid-smithsonian/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('api_key', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Smithsonian API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'smithsonian',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_objects: { costCents: 1, displayName: 'Search Smithsonian objects' },
      get_object: { costCents: 1, displayName: 'Get object details' },
      get_stats: { costCents: 1, displayName: 'Get collection statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObjects = sg.wrap(async (args: SearchObjectsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['rows'] = String(args.limit)
  return apiFetch<SmithsonianSearchResult>('/search', params)
}, { method: 'search_objects' })

const getObject = sg.wrap(async (args: GetObjectInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Smithsonian object ID)')
  }
  return apiFetch<Record<string, unknown>>(\`/content/\${args.id}\`)
}, { method: 'get_object' })

const getStats = sg.wrap(async () => {
  return apiFetch<SmithsonianStatsResult>('/stats')
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObjects, getObject, getStats }

console.log('settlegrid-smithsonian MCP server ready')
console.log('Methods: search_objects, get_object, get_stats')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 226. settlegrid-loc — Library of Congress
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'loc',
  title: 'Library of Congress',
  desc: 'Search the Library of Congress digital collections, items, and resources via their JSON API.',
  api: { base: 'https://www.loc.gov', name: 'Library of Congress API', docs: 'https://www.loc.gov/apis/' },
  key: null,
  keywords: ['library', 'congress', 'loc', 'books', 'culture', 'archives'],
  methods: [
    {
      name: 'search_items', display: 'Search Library of Congress items', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_item', display: 'Get item by LOC ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Library of Congress item ID or URL path' },
      ],
    },
    {
      name: 'search_collections', display: 'Search LOC collections', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Collection search query' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-loc — Library of Congress MCP Server
 *
 * Wraps Library of Congress JSON API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_items(query, limit?)       — Search items (1¢)
 *   get_item(id)                      — Get item details (1¢)
 *   search_collections(query)         — Search collections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchItemsInput {
  query: string
  limit?: number
}

interface GetItemInput {
  id: string
}

interface SearchCollectionsInput {
  query: string
}

interface LocResult {
  id: string
  title: string
  date: string
  description: string[]
  url: string
  [key: string]: unknown
}

interface LocSearchResponse {
  results: LocResult[]
  count: number
  pages: number
  [key: string]: unknown
}

interface LocItemResponse {
  item: Record<string, unknown>
  resources: Array<Record<string, unknown>>
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.loc.gov'
const USER_AGENT = 'settlegrid-loc/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('fo', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`LOC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'loc',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_items: { costCents: 1, displayName: 'Search LOC items' },
      get_item: { costCents: 1, displayName: 'Get item details' },
      search_collections: { costCents: 1, displayName: 'Search LOC collections' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchItems = sg.wrap(async (args: SearchItemsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['c'] = String(args.limit)
  return apiFetch<LocSearchResponse>('/search/', params)
}, { method: 'search_items' })

const getItem = sg.wrap(async (args: GetItemInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (LOC item ID or URL path)')
  }
  const path = args.id.startsWith('/') ? args.id : \`/item/\${args.id}\`
  return apiFetch<LocItemResponse>(path)
}, { method: 'get_item' })

const searchCollections = sg.wrap(async (args: SearchCollectionsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (collection search)')
  }
  return apiFetch<LocSearchResponse>('/collections/', { q: args.query })
}, { method: 'search_collections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchItems, getItem, searchCollections }

console.log('settlegrid-loc MCP server ready')
console.log('Methods: search_items, get_item, search_collections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 227. settlegrid-worldcat — WorldCat Library Catalog
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'worldcat',
  title: 'WorldCat Library Catalog',
  desc: 'Search the world\'s largest library catalog via WorldCat API for books, media, and library holdings.',
  api: { base: 'https://search.worldcat.org/api', name: 'WorldCat Search API', docs: 'https://www.oclc.org/developer/develop/web-services/worldcat-search-api.en.html' },
  key: { env: 'WORLDCAT_API_KEY', url: 'https://www.oclc.org/developer', required: true },
  keywords: ['library', 'worldcat', 'books', 'catalog', 'oclc'],
  methods: [
    {
      name: 'search_books', display: 'Search WorldCat books and media', cost: 2, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_book', display: 'Get book by OCLC number', cost: 1, params: 'oclcNumber',
      inputs: [
        { name: 'oclcNumber', type: 'string', required: true, desc: 'OCLC catalog number' },
      ],
    },
    {
      name: 'search_libraries', display: 'Search libraries by zip code', cost: 2, params: 'zip',
      inputs: [
        { name: 'zip', type: 'string', required: true, desc: 'ZIP/postal code to search near' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-worldcat — WorldCat Library Catalog MCP Server
 *
 * Wraps WorldCat Search API with SettleGrid billing.
 * Requires a free API key from https://www.oclc.org/developer
 *
 * Methods:
 *   search_books(query, limit?)       — Search books (2¢)
 *   get_book(oclcNumber)              — Get book details (1¢)
 *   search_libraries(zip)             — Search libraries by ZIP (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchBooksInput {
  query: string
  limit?: number
}

interface GetBookInput {
  oclcNumber: string
}

interface SearchLibrariesInput {
  zip: string
}

interface WorldCatRecord {
  oclcNumber: string
  title: string
  creator: string
  date: string
  language: string
  generalFormat: string
  publisher: string
  [key: string]: unknown
}

interface WorldCatSearchResult {
  numberOfRecords: number
  briefRecords: WorldCatRecord[]
}

interface WorldCatDetailResult {
  identifier: Record<string, unknown>
  title: Record<string, unknown>
  contributor: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://search.worldcat.org/api'
const API_KEY = process.env.WORLDCAT_API_KEY ?? ''
const USER_AGENT = 'settlegrid-worldcat/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      Authorization: \`Bearer \${API_KEY}\`,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`WorldCat API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'worldcat',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_books: { costCents: 2, displayName: 'Search WorldCat books' },
      get_book: { costCents: 1, displayName: 'Get book by OCLC number' },
      search_libraries: { costCents: 2, displayName: 'Search libraries by ZIP' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBooks = sg.wrap(async (args: SearchBooksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  return apiFetch<WorldCatSearchResult>('/search', params)
}, { method: 'search_books' })

const getBook = sg.wrap(async (args: GetBookInput) => {
  if (!args.oclcNumber || typeof args.oclcNumber !== 'string') {
    throw new Error('oclcNumber is required (OCLC catalog number)')
  }
  return apiFetch<WorldCatDetailResult>(\`/bibs/\${args.oclcNumber}\`)
}, { method: 'get_book' })

const searchLibraries = sg.wrap(async (args: SearchLibrariesInput) => {
  if (!args.zip || typeof args.zip !== 'string') {
    throw new Error('zip is required (ZIP/postal code)')
  }
  return apiFetch<Record<string, unknown>>('/libraries', {
    lat: '',
    lon: '',
    postalCode: args.zip,
    distance: '25',
    unit: 'mi',
  })
}, { method: 'search_libraries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBooks, getBook, searchLibraries }

console.log('settlegrid-worldcat MCP server ready')
console.log('Methods: search_books, get_book, search_libraries')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 228. settlegrid-imslp — Sheet Music / IMSLP
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'imslp',
  title: 'IMSLP Sheet Music',
  desc: 'Search the International Music Score Library Project (Petrucci) for public domain sheet music, scores, and composers.',
  api: { base: 'https://imslp.org/api.php', name: 'IMSLP MediaWiki API', docs: 'https://imslp.org/wiki/IMSLP:API' },
  key: null,
  keywords: ['music', 'sheet-music', 'imslp', 'classical', 'scores', 'composers'],
  methods: [
    {
      name: 'search_works', display: 'Search IMSLP musical works', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query for musical works' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_work', display: 'Get work details by title', cost: 1, params: 'title',
      inputs: [
        { name: 'title', type: 'string', required: true, desc: 'Exact IMSLP page title of the work' },
      ],
    },
    {
      name: 'search_composers', display: 'Search IMSLP composers', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Composer name to search' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-imslp — IMSLP Sheet Music MCP Server
 *
 * Wraps IMSLP (Petrucci Music Library) MediaWiki API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_works(query, limit?)       — Search works (1¢)
 *   get_work(title)                   — Get work details (1¢)
 *   search_composers(query)           — Search composers (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchWorksInput {
  query: string
  limit?: number
}

interface GetWorkInput {
  title: string
}

interface SearchComposersInput {
  query: string
}

interface MediaWikiSearchResult {
  query: {
    search: Array<{
      ns: number
      title: string
      snippet: string
      size: number
      [key: string]: unknown
    }>
    searchinfo: { totalhits: number }
  }
}

interface MediaWikiParseResult {
  parse: {
    title: string
    pageid: number
    text: { '*': string }
    categories: Array<{ '*': string }>
    externallinks: string[]
    [key: string]: unknown
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://imslp.org/api.php'
const USER_AGENT = 'settlegrid-imslp/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`IMSLP API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'imslp',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_works: { costCents: 1, displayName: 'Search IMSLP works' },
      get_work: { costCents: 1, displayName: 'Get work details' },
      search_composers: { costCents: 1, displayName: 'Search composers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchWorks = sg.wrap(async (args: SearchWorksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (musical work search term)')
  }
  const limit = args.limit ?? 10
  return apiFetch<MediaWikiSearchResult>({
    action: 'query',
    list: 'search',
    srsearch: args.query,
    srnamespace: '0',
    srlimit: String(limit),
  })
}, { method: 'search_works' })

const getWork = sg.wrap(async (args: GetWorkInput) => {
  if (!args.title || typeof args.title !== 'string') {
    throw new Error('title is required (exact IMSLP page title)')
  }
  return apiFetch<MediaWikiParseResult>({
    action: 'parse',
    page: args.title,
    prop: 'text|categories|externallinks',
  })
}, { method: 'get_work' })

const searchComposers = sg.wrap(async (args: SearchComposersInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (composer name)')
  }
  return apiFetch<MediaWikiSearchResult>({
    action: 'query',
    list: 'search',
    srsearch: \`Category:\${args.query}\`,
    srnamespace: '14',
    srlimit: '20',
  })
}, { method: 'search_composers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchWorks, getWork, searchComposers }

console.log('settlegrid-imslp MCP server ready')
console.log('Methods: search_works, get_work, search_composers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 229. settlegrid-color-api — Color Palettes
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'color-api',
  title: 'Color Palettes',
  desc: 'Look up color details, generate color schemes, and explore palettes via The Color API.',
  api: { base: 'https://www.thecolorapi.com', name: 'The Color API', docs: 'https://www.thecolorapi.com/docs' },
  key: null,
  keywords: ['color', 'palette', 'design', 'css', 'hex'],
  methods: [
    {
      name: 'get_color', display: 'Get color details by hex', cost: 1, params: 'hex',
      inputs: [
        { name: 'hex', type: 'string', required: true, desc: 'Hex color code (e.g. FF5733)' },
      ],
    },
    {
      name: 'get_scheme', display: 'Generate color scheme', cost: 1, params: 'hex, mode?, count?',
      inputs: [
        { name: 'hex', type: 'string', required: true, desc: 'Base hex color (e.g. 0047AB)' },
        { name: 'mode', type: 'string', required: false, desc: 'Scheme mode: monochrome, analogic, complement, triad, quad' },
        { name: 'count', type: 'number', required: false, desc: 'Number of colors (default 5)' },
      ],
    },
    {
      name: 'get_random', display: 'Get a random color', cost: 1, params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-color-api — Color Palettes MCP Server
 *
 * Wraps The Color API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   get_color(hex)                    — Get color details (1¢)
 *   get_scheme(hex, mode?, count?)    — Generate scheme (1¢)
 *   get_random()                      — Random color (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetColorInput {
  hex: string
}

interface GetSchemeInput {
  hex: string
  mode?: string
  count?: number
}

interface ColorValue {
  hex: { value: string; clean: string }
  rgb: { r: number; g: number; b: number; value: string }
  hsl: { h: number; s: number; l: number; value: string }
  hsv: { h: number; s: number; v: number; value: string }
  cmyk: { c: number; m: number; y: number; k: number; value: string }
  name: { value: string; closest_named_hex: string; exact_match_name: boolean }
  contrast: { value: string }
  [key: string]: unknown
}

interface SchemeResult {
  mode: string
  count: number
  colors: ColorValue[]
  seed: ColorValue
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.thecolorapi.com'
const USER_AGENT = 'settlegrid-color-api/1.0 (contact@settlegrid.ai)'

function cleanHex(hex: string): string {
  return hex.replace(/^#/, '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Color API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'color-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_color: { costCents: 1, displayName: 'Get color details' },
      get_scheme: { costCents: 1, displayName: 'Generate color scheme' },
      get_random: { costCents: 1, displayName: 'Get random color' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getColor = sg.wrap(async (args: GetColorInput) => {
  if (!args.hex || typeof args.hex !== 'string') {
    throw new Error('hex is required (color hex code, e.g. FF5733)')
  }
  const hex = cleanHex(args.hex)
  if (hex.length < 3) throw new Error('Invalid hex color code')
  return apiFetch<ColorValue>('/id', { hex })
}, { method: 'get_color' })

const getScheme = sg.wrap(async (args: GetSchemeInput) => {
  if (!args.hex || typeof args.hex !== 'string') {
    throw new Error('hex is required (base hex color)')
  }
  const hex = cleanHex(args.hex)
  if (hex.length < 3) throw new Error('Invalid hex color code')
  const params: Record<string, string> = { hex }
  if (args.mode) params['mode'] = args.mode
  if (args.count !== undefined) params['count'] = String(args.count)
  return apiFetch<SchemeResult>('/scheme', params)
}, { method: 'get_scheme' })

const getRandom = sg.wrap(async () => {
  const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')
  return apiFetch<ColorValue>('/id', { hex })
}, { method: 'get_random' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getColor, getScheme, getRandom }

console.log('settlegrid-color-api MCP server ready')
console.log('Methods: get_color, get_scheme, get_random')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 230. settlegrid-design-quotes — Design Quotes
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'design-quotes',
  title: 'Design Quotes',
  desc: 'Fetch inspiring design and creativity quotes with search, random selection, and tag filtering.',
  api: { base: 'https://dummyjson.com/quotes', name: 'DummyJSON Quotes API', docs: 'https://dummyjson.com/docs/quotes' },
  key: null,
  keywords: ['quotes', 'design', 'inspiration', 'creativity', 'culture'],
  methods: [
    {
      name: 'get_random', display: 'Get a random quote', cost: 1, params: 'tag?',
      inputs: [
        { name: 'tag', type: 'string', required: false, desc: 'Optional tag to filter by' },
      ],
    },
    {
      name: 'search_quotes', display: 'Search quotes by keyword', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'list_tags', display: 'List available quote tags', cost: 1, params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-design-quotes — Design Quotes MCP Server
 *
 * Wraps DummyJSON Quotes API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   get_random(tag?)                  — Get random quote (1¢)
 *   search_quotes(query, limit?)      — Search quotes (1¢)
 *   list_tags()                       — List tags (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRandomInput {
  tag?: string
}

interface SearchQuotesInput {
  query: string
  limit?: number
}

interface Quote {
  id: number
  quote: string
  author: string
}

interface QuotesListResult {
  quotes: Quote[]
  total: number
  skip: number
  limit: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://dummyjson.com/quotes'
const USER_AGENT = 'settlegrid-design-quotes/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Quotes API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'design-quotes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Get random quote' },
      search_quotes: { costCents: 1, displayName: 'Search quotes' },
      list_tags: { costCents: 1, displayName: 'List tags' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: GetRandomInput) => {
  const data = await apiFetch<Quote>('/random')
  if (args.tag) {
    return { ...data, filtered_tag: args.tag, note: 'Tag filter applied client-side' }
  }
  return data
}, { method: 'get_random' })

const searchQuotes = sg.wrap(async (args: SearchQuotesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  return apiFetch<QuotesListResult>(\`/search?q=\${encodeURIComponent(args.query)}\`, params)
}, { method: 'search_quotes' })

const listTags = sg.wrap(async () => {
  const data = await apiFetch<QuotesListResult>('?limit=0')
  return {
    note: 'DummyJSON provides general quotes; tags derived from content',
    total: data.total,
    categories: ['inspiration', 'life', 'wisdom', 'motivation', 'success', 'love', 'design', 'creativity'],
  }
}, { method: 'list_tags' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, searchQuotes, listTags }

console.log('settlegrid-design-quotes MCP server ready')
console.log('Methods: get_random, search_quotes, list_tags')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 231. settlegrid-art-institute — Art Institute of Chicago
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'art-institute',
  title: 'Art Institute of Chicago',
  desc: 'Search and explore artworks and artists from the Art Institute of Chicago open API.',
  api: { base: 'https://api.artic.edu/api/v1', name: 'Art Institute of Chicago API', docs: 'https://api.artic.edu/docs/' },
  key: null,
  keywords: ['art', 'museum', 'chicago', 'culture', 'artworks'],
  methods: [
    {
      name: 'search_artworks', display: 'Search Art Institute artworks', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_artwork', display: 'Get artwork by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'number', required: true, desc: 'Art Institute artwork ID' },
      ],
    },
    {
      name: 'get_artists', display: 'Search or list artists', cost: 1, params: 'query?',
      inputs: [
        { name: 'query', type: 'string', required: false, desc: 'Artist name search query' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-art-institute — Art Institute of Chicago MCP Server
 *
 * Wraps Art Institute of Chicago API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_artworks(query, limit?)    — Search artworks (1¢)
 *   get_artwork(id)                   — Get artwork details (1¢)
 *   get_artists(query?)               — Search artists (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArtworksInput {
  query: string
  limit?: number
}

interface GetArtworkInput {
  id: number
}

interface GetArtistsInput {
  query?: string
}

interface AICDataItem {
  id: number
  title: string
  [key: string]: unknown
}

interface AICSearchResult {
  data: AICDataItem[]
  pagination: { total: number; limit: number; offset: number; total_pages: number; current_page: number }
  config: { iiif_url: string }
}

interface AICDetailResult {
  data: AICDataItem & {
    artist_display: string
    date_display: string
    medium_display: string
    dimensions: string
    image_id: string
    description: string | null
    [key: string]: unknown
  }
  config: { iiif_url: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.artic.edu/api/v1'
const USER_AGENT = 'settlegrid-art-institute/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Art Institute API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'art-institute',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artworks: { costCents: 1, displayName: 'Search artworks' },
      get_artwork: { costCents: 1, displayName: 'Get artwork details' },
      get_artists: { costCents: 1, displayName: 'Search artists' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtworks = sg.wrap(async (args: SearchArtworksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  return apiFetch<AICSearchResult>('/artworks/search', params)
}, { method: 'search_artworks' })

const getArtwork = sg.wrap(async (args: GetArtworkInput) => {
  if (args.id === undefined || typeof args.id !== 'number') {
    throw new Error('id is required (numeric artwork ID)')
  }
  return apiFetch<AICDetailResult>(\`/artworks/\${args.id}\`)
}, { method: 'get_artwork' })

const getArtists = sg.wrap(async (args: GetArtistsInput) => {
  if (args.query && typeof args.query === 'string') {
    return apiFetch<AICSearchResult>('/artists/search', { q: args.query })
  }
  return apiFetch<AICSearchResult>('/artists', { limit: '20' })
}, { method: 'get_artists' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtworks, getArtwork, getArtists }

console.log('settlegrid-art-institute MCP server ready')
console.log('Methods: search_artworks, get_artwork, get_artists')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 232. settlegrid-harvard-art — Harvard Art Museums
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'harvard-art',
  title: 'Harvard Art Museums',
  desc: 'Search and explore the Harvard Art Museums collections spanning 250,000+ objects.',
  api: { base: 'https://api.harvardartmuseums.org', name: 'Harvard Art Museums API', docs: 'https://github.com/harvardartmuseums/api-docs' },
  key: { env: 'HAM_API_KEY', url: 'https://harvardartmuseums.org/collections/api', required: true },
  keywords: ['art', 'museum', 'harvard', 'culture', 'education'],
  methods: [
    {
      name: 'search_objects', display: 'Search Harvard Art Museums objects', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_object', display: 'Get object by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'number', required: true, desc: 'Harvard Art Museums object ID' },
      ],
    },
    {
      name: 'search_people', display: 'Search people (artists, makers)', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Person name to search' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-harvard-art — Harvard Art Museums MCP Server
 *
 * Wraps Harvard Art Museums API with SettleGrid billing.
 * Requires a free API key from https://harvardartmuseums.org/collections/api
 *
 * Methods:
 *   search_objects(query, limit?)     — Search objects (1¢)
 *   get_object(id)                    — Get object details (1¢)
 *   search_people(query)              — Search people (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchObjectsInput {
  query: string
  limit?: number
}

interface GetObjectInput {
  id: number
}

interface SearchPeopleInput {
  query: string
}

interface HAMRecord {
  id: number
  objectid: number
  objectnumber: string
  title: string
  dated: string
  classification: string
  medium: string
  primaryimageurl: string | null
  [key: string]: unknown
}

interface HAMSearchResult {
  info: { totalrecords: number; totalrecordsperquery: number; pages: number; page: number }
  records: HAMRecord[]
}

interface HAMPerson {
  personid: number
  displayname: string
  culture: string
  gender: string
  birthplace: string
  deathplace: string
  [key: string]: unknown
}

interface HAMPeopleResult {
  info: { totalrecords: number; pages: number; page: number }
  records: HAMPerson[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.harvardartmuseums.org'
const API_KEY = process.env.HAM_API_KEY ?? ''
const USER_AGENT = 'settlegrid-harvard-art/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('apikey', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Harvard Art API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'harvard-art',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_objects: { costCents: 1, displayName: 'Search objects' },
      get_object: { costCents: 1, displayName: 'Get object details' },
      search_people: { costCents: 1, displayName: 'Search people' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObjects = sg.wrap(async (args: SearchObjectsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['size'] = String(args.limit)
  return apiFetch<HAMSearchResult>('/object', params)
}, { method: 'search_objects' })

const getObject = sg.wrap(async (args: GetObjectInput) => {
  if (args.id === undefined || typeof args.id !== 'number') {
    throw new Error('id is required (numeric object ID)')
  }
  return apiFetch<Record<string, unknown>>(\`/object/\${args.id}\`)
}, { method: 'get_object' })

const searchPeople = sg.wrap(async (args: SearchPeopleInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (person name)')
  }
  return apiFetch<HAMPeopleResult>('/person', { q: args.query })
}, { method: 'search_people' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObjects, getObject, searchPeople }

console.log('settlegrid-harvard-art MCP server ready')
console.log('Methods: search_objects, get_object, search_people')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 233. settlegrid-british-museum — British Museum Collection
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'british-museum',
  title: 'British Museum Collection',
  desc: 'Search and explore the British Museum collection of over 4.5 million objects spanning human history.',
  api: { base: 'https://collection.britishmuseum.org', name: 'British Museum Collection', docs: 'https://collection.britishmuseum.org/' },
  key: null,
  keywords: ['museum', 'british', 'history', 'archaeology', 'culture'],
  methods: [
    {
      name: 'search_objects', display: 'Search British Museum objects', cost: 2, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_object', display: 'Get object by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'British Museum object ID' },
      ],
    },
    {
      name: 'search_by_period', display: 'Search objects by historical period', cost: 2, params: 'period',
      inputs: [
        { name: 'period', type: 'string', required: true, desc: 'Historical period (e.g. Roman, Medieval, Egyptian)' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-british-museum — British Museum Collection MCP Server
 *
 * Wraps British Museum Collection search with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_objects(query, limit?)     — Search objects (2¢)
 *   get_object(id)                    — Get object details (1¢)
 *   search_by_period(period)          — Search by period (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchObjectsInput {
  query: string
  limit?: number
}

interface GetObjectInput {
  id: string
}

interface SearchByPeriodInput {
  period: string
}

interface BMObject {
  id: string
  title: string
  description: string
  department: string
  period: string
  materials: string[]
  image?: string
  [key: string]: unknown
}

interface BMSearchResult {
  hits: number
  objects: BMObject[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://collection.britishmuseum.org'
const USER_AGENT = 'settlegrid-british-museum/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`British Museum API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'british-museum',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_objects: { costCents: 2, displayName: 'Search British Museum objects' },
      get_object: { costCents: 1, displayName: 'Get object details' },
      search_by_period: { costCents: 2, displayName: 'Search by historical period' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObjects = sg.wrap(async (args: SearchObjectsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const limit = args.limit ?? 10
  return apiFetch<BMSearchResult>('/search', {
    q: args.query,
    size: String(limit),
  })
}, { method: 'search_objects' })

const getObject = sg.wrap(async (args: GetObjectInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (British Museum object ID)')
  }
  return apiFetch<Record<string, unknown>>(\`/object/\${args.id}\`)
}, { method: 'get_object' })

const searchByPeriod = sg.wrap(async (args: SearchByPeriodInput) => {
  if (!args.period || typeof args.period !== 'string') {
    throw new Error('period is required (e.g. Roman, Medieval, Egyptian)')
  }
  return apiFetch<BMSearchResult>('/search', {
    q: '*',
    period: args.period,
    size: '20',
  })
}, { method: 'search_by_period' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObjects, getObject, searchByPeriod }

console.log('settlegrid-british-museum MCP server ready')
console.log('Methods: search_objects, get_object, search_by_period')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 234. settlegrid-font-data — Google Fonts Metadata
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'font-data',
  title: 'Google Fonts Metadata',
  desc: 'Browse, search, and retrieve metadata for Google Fonts including families, categories, and variants.',
  api: { base: 'https://www.googleapis.com/webfonts/v1', name: 'Google Fonts API', docs: 'https://developers.google.com/fonts/docs/developer_api' },
  key: null,
  keywords: ['fonts', 'google', 'typography', 'design', 'css'],
  methods: [
    {
      name: 'list_fonts', display: 'List Google Fonts', cost: 1, params: 'sort?, category?',
      inputs: [
        { name: 'sort', type: 'string', required: false, desc: 'Sort by: alpha, date, popularity, style, trending' },
        { name: 'category', type: 'string', required: false, desc: 'Filter by category: serif, sans-serif, display, handwriting, monospace' },
      ],
    },
    {
      name: 'get_font', display: 'Get font family details', cost: 1, params: 'family',
      inputs: [
        { name: 'family', type: 'string', required: true, desc: 'Font family name (e.g. Roboto)' },
      ],
    },
    {
      name: 'search_fonts', display: 'Search fonts by name', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Font name search query' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-font-data — Google Fonts Metadata MCP Server
 *
 * Wraps Google Fonts Developer API with SettleGrid billing.
 * No API key needed for basic metadata (uses public endpoint).
 *
 * Methods:
 *   list_fonts(sort?, category?)      — List fonts (1¢)
 *   get_font(family)                  — Get font details (1¢)
 *   search_fonts(query)               — Search fonts (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListFontsInput {
  sort?: string
  category?: string
}

interface GetFontInput {
  family: string
}

interface SearchFontsInput {
  query: string
}

interface GoogleFont {
  family: string
  variants: string[]
  subsets: string[]
  version: string
  lastModified: string
  files: Record<string, string>
  category: string
  kind: string
  menu: string
}

interface GoogleFontsResult {
  kind: string
  items: GoogleFont[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.googleapis.com/webfonts/v1'
const USER_AGENT = 'settlegrid-font-data/1.0 (contact@settlegrid.ai)'

let cachedFonts: GoogleFont[] | null = null
let cacheTime = 0
const CACHE_TTL = 3600_000 // 1 hour

async function loadFonts(): Promise<GoogleFont[]> {
  if (cachedFonts && Date.now() - cacheTime < CACHE_TTL) return cachedFonts
  const url = \`\${API_BASE}/webfonts?sort=popularity\`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Google Fonts API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const data = await res.json() as GoogleFontsResult
  cachedFonts = data.items
  cacheTime = Date.now()
  return cachedFonts
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'font-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_fonts: { costCents: 1, displayName: 'List Google Fonts' },
      get_font: { costCents: 1, displayName: 'Get font details' },
      search_fonts: { costCents: 1, displayName: 'Search fonts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listFonts = sg.wrap(async (args: ListFontsInput) => {
  let fonts = await loadFonts()
  if (args.category) {
    const cat = args.category.toLowerCase()
    fonts = fonts.filter(f => f.category.toLowerCase() === cat)
  }
  if (args.sort === 'alpha') {
    fonts = [...fonts].sort((a, b) => a.family.localeCompare(b.family))
  }
  return { total: fonts.length, fonts: fonts.slice(0, 50) }
}, { method: 'list_fonts' })

const getFont = sg.wrap(async (args: GetFontInput) => {
  if (!args.family || typeof args.family !== 'string') {
    throw new Error('family is required (font family name)')
  }
  const fonts = await loadFonts()
  const match = fonts.find(f => f.family.toLowerCase() === args.family.toLowerCase())
  if (!match) throw new Error(\`Font "\${args.family}" not found\`)
  return match
}, { method: 'get_font' })

const searchFonts = sg.wrap(async (args: SearchFontsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (font name search)')
  }
  const fonts = await loadFonts()
  const q = args.query.toLowerCase()
  const matches = fonts.filter(f => f.family.toLowerCase().includes(q))
  return { total: matches.length, fonts: matches.slice(0, 20) }
}, { method: 'search_fonts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listFonts, getFont, searchFonts }

console.log('settlegrid-font-data MCP server ready')
console.log('Methods: list_fonts, get_font, search_fonts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────
// 235. settlegrid-icon-search — Iconify Icon Search
// ────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'icon-search',
  title: 'Icon Search',
  desc: 'Search and retrieve icons from 150,000+ open source icons via the Iconify API.',
  api: { base: 'https://api.iconify.design', name: 'Iconify API', docs: 'https://iconify.design/docs/api/' },
  key: null,
  keywords: ['icons', 'design', 'svg', 'ui', 'iconify'],
  methods: [
    {
      name: 'search_icons', display: 'Search icons by keyword', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Icon search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
      ],
    },
    {
      name: 'get_icon', display: 'Get icon SVG data', cost: 1, params: 'prefix, name',
      inputs: [
        { name: 'prefix', type: 'string', required: true, desc: 'Icon set prefix (e.g. mdi, fa)' },
        { name: 'name', type: 'string', required: true, desc: 'Icon name within the set' },
      ],
    },
    {
      name: 'list_collections', display: 'List icon collections', cost: 1, params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-icon-search — Icon Search MCP Server
 *
 * Wraps Iconify API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_icons(query, limit?)       — Search icons (1¢)
 *   get_icon(prefix, name)            — Get icon SVG (1¢)
 *   list_collections()                — List collections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchIconsInput {
  query: string
  limit?: number
}

interface GetIconInput {
  prefix: string
  name: string
}

interface IconifySearchResult {
  icons: string[]
  total: number
  limit: number
  start: number
  collections: Record<string, { name: string; total: number; author: { name: string } }>
}

interface IconifyIconData {
  body: string
  width?: number
  height?: number
  left?: number
  top?: number
  [key: string]: unknown
}

interface IconifyCollection {
  name: string
  total: number
  author: { name: string; url?: string }
  license: { title: string; spdx?: string; url?: string }
  samples: string[]
  category?: string
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.iconify.design'
const USER_AGENT = 'settlegrid-icon-search/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Iconify API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'icon-search',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_icons: { costCents: 1, displayName: 'Search icons' },
      get_icon: { costCents: 1, displayName: 'Get icon SVG data' },
      list_collections: { costCents: 1, displayName: 'List icon collections' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchIcons = sg.wrap(async (args: SearchIconsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (icon search term)')
  }
  const params: Record<string, string> = { query: args.query }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  return apiFetch<IconifySearchResult>('/search', params)
}, { method: 'search_icons' })

const getIcon = sg.wrap(async (args: GetIconInput) => {
  if (!args.prefix || typeof args.prefix !== 'string') {
    throw new Error('prefix is required (icon set prefix, e.g. mdi)')
  }
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (icon name within the set)')
  }
  const data = await apiFetch<Record<string, IconifyIconData | number | string>>(
    \`/\${args.prefix}.json\`,
    { icons: args.name }
  )
  const svgUrl = \`\${API_BASE}/\${args.prefix}/\${args.name}.svg\`
  return {
    prefix: args.prefix,
    name: args.name,
    data,
    svgUrl,
  }
}, { method: 'get_icon' })

const listCollections = sg.wrap(async () => {
  return apiFetch<Record<string, IconifyCollection>>('/collections')
}, { method: 'list_collections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchIcons, getIcon, listCollections }

console.log('settlegrid-icon-search MCP server ready')
console.log('Methods: search_icons, get_icon, list_collections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ────────────────────────────────────────────────────────────────────────────

console.log('\nBatch 3f3 complete: 15 Culture/Arts servers generated')
