/**
 * settlegrid-mealdb — TheMealDB MCP Server
 *
 * Wraps the TheMealDB API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(s)                                (1¢)
 *   get_random()                             (1¢)
 *   get_categories()                         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  s: string
}

interface GetRandomInput {
}

interface GetCategoriesInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.themealdb.com/api/json/v1/1'
const USER_AGENT = 'settlegrid-mealdb/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TheMealDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mealdb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search meals by name' },
      get_random: { costCents: 1, displayName: 'Get a random meal recipe' },
      get_categories: { costCents: 1, displayName: 'Get all meal categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.s || typeof args.s !== 'string') {
    throw new Error('s is required (meal name to search)')
  }

  const params: Record<string, string> = {}
  params['s'] = args.s

  const data = await apiFetch<Record<string, unknown>>('/search.php', {
    params,
  })

  return data
}, { method: 'search' })

const getRandom = sg.wrap(async (args: GetRandomInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/random.php', {
    params,
  })

  return data
}, { method: 'get_random' })

const getCategories = sg.wrap(async (args: GetCategoriesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/categories.php', {
    params,
  })

  return data
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getRandom, getCategories }

console.log('settlegrid-mealdb MCP server ready')
console.log('Methods: search, get_random, get_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
