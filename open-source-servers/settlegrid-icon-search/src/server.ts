/**
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
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Iconify API ${res.status}: ${body.slice(0, 200)}`)
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
    `/${args.prefix}.json`,
    { icons: args.name }
  )
  const svgUrl = `${API_BASE}/${args.prefix}/${args.name}.svg`
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
