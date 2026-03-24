/**
 * settlegrid-cocktaildb — TheCocktailDB MCP Server
 *
 * Wraps the TheCocktailDB API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(s)                                (1¢)
 *   get_random()                             (1¢)
 *   get_by_ingredient(i)                     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  s: string
}

interface GetRandomInput {
}

interface GetByIngredientInput {
  i: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1'
const USER_AGENT = 'settlegrid-cocktaildb/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`TheCocktailDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cocktaildb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search cocktails by name' },
      get_random: { costCents: 1, displayName: 'Get a random cocktail recipe' },
      get_by_ingredient: { costCents: 1, displayName: 'Filter cocktails by ingredient' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.s || typeof args.s !== 'string') {
    throw new Error('s is required (cocktail name to search)')
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

const getByIngredient = sg.wrap(async (args: GetByIngredientInput) => {
  if (!args.i || typeof args.i !== 'string') {
    throw new Error('i is required (ingredient name (e.g. vodka, gin))')
  }

  const params: Record<string, string> = {}
  params['i'] = args.i

  const data = await apiFetch<Record<string, unknown>>('/filter.php', {
    params,
  })

  return data
}, { method: 'get_by_ingredient' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getRandom, getByIngredient }

console.log('settlegrid-cocktaildb MCP server ready')
console.log('Methods: search, get_random, get_by_ingredient')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
