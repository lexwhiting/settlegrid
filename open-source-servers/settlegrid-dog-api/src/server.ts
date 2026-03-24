/**
 * settlegrid-dog-api — Dog CEO API MCP Server
 *
 * Wraps the Dog CEO API API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_random()                             (1¢)
 *   list_breeds()                            (1¢)
 *   get_breed_images(breed)                  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRandomInput {
}

interface ListBreedsInput {
}

interface GetBreedImagesInput {
  breed: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://dog.ceo/api'
const USER_AGENT = 'settlegrid-dog-api/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Dog CEO API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dog-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Get a random dog image' },
      list_breeds: { costCents: 1, displayName: 'List all dog breeds' },
      get_breed_images: { costCents: 1, displayName: 'Get images for a specific breed' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: GetRandomInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/breeds/image/random', {
    params,
  })

  return data
}, { method: 'get_random' })

const listBreeds = sg.wrap(async (args: ListBreedsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/breeds/list/all', {
    params,
  })

  return data
}, { method: 'list_breeds' })

const getBreedImages = sg.wrap(async (args: GetBreedImagesInput) => {
  if (!args.breed || typeof args.breed !== 'string') {
    throw new Error('breed is required (breed name (e.g. labrador, poodle))')
  }

  const params: Record<string, string> = {}
  params['breed'] = String(args.breed)

  const data = await apiFetch<Record<string, unknown>>(`/breed/${encodeURIComponent(String(args.breed))}/images/random/3`, {
    params,
  })

  return data
}, { method: 'get_breed_images' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, listBreeds, getBreedImages }

console.log('settlegrid-dog-api MCP server ready')
console.log('Methods: get_random, list_breeds, get_breed_images')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
