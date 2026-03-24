/**
 * settlegrid-pokeapi — PokeAPI MCP Server
 *
 * Wraps the PokeAPI API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_pokemon(nameOrId)                    (1¢)
 *   list_pokemon()                           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPokemonInput {
  nameOrId: string
}

interface ListPokemonInput {
  limit?: number
  offset?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pokeapi.co/api/v2'
const USER_AGENT = 'settlegrid-pokeapi/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`PokeAPI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pokeapi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_pokemon: { costCents: 1, displayName: 'Get Pokemon data by name or ID' },
      list_pokemon: { costCents: 1, displayName: 'List Pokemon with pagination' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPokemon = sg.wrap(async (args: GetPokemonInput) => {
  if (!args.nameOrId || typeof args.nameOrId !== 'string') {
    throw new Error('nameOrId is required (pokemon name or id (e.g. pikachu, 25))')
  }

  const params: Record<string, string> = {}
  params['nameOrId'] = String(args.nameOrId)

  const data = await apiFetch<Record<string, unknown>>(`/pokemon/${encodeURIComponent(String(args.nameOrId))}`, {
    params,
  })

  return data
}, { method: 'get_pokemon' })

const listPokemon = sg.wrap(async (args: ListPokemonInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  if (args.offset !== undefined) params['offset'] = String(args.offset)

  const data = await apiFetch<Record<string, unknown>>('/pokemon', {
    params,
  })

  return data
}, { method: 'list_pokemon' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPokemon, listPokemon }

console.log('settlegrid-pokeapi MCP server ready')
console.log('Methods: get_pokemon, list_pokemon')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
