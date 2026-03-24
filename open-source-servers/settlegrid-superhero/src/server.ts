/**
 * settlegrid-superhero — Superhero API MCP Server
 *
 * Methods:
 *   search_heroes(query)  — Search heroes     (1¢)
 *   get_hero(id)          — Get hero details  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetHeroInput { id: number }

interface Hero {
  id: number
  name: string
  slug: string
  powerstats: { intelligence: number; strength: number; speed: number; durability: number; power: number; combat: number }
  appearance: { gender: string; race: string; height: string[]; weight: string[] }
  biography: { fullName: string; publisher: string; alignment: string; firstAppearance: string }
  images: { sm: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://akabab.github.io/superhero-api/api'
let heroCache: Hero[] | null = null

async function getAllHeroes(): Promise<Hero[]> {
  if (heroCache) return heroCache
  const res = await fetch(`${BASE}/all.json`)
  if (!res.ok) throw new Error(`Superhero API ${res.status}`)
  heroCache = await res.json() as Hero[]
  return heroCache
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'superhero',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_heroes: { costCents: 1, displayName: 'Search Heroes' },
      get_hero: { costCents: 1, displayName: 'Get Hero' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchHeroes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = args.query.toLowerCase().trim()
  const all = await getAllHeroes()
  const matches = all.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 10)
  return {
    query: args.query,
    count: matches.length,
    heroes: matches.map((h) => ({
      id: h.id,
      name: h.name,
      publisher: h.biography?.publisher,
      alignment: h.biography?.alignment,
      powerstats: h.powerstats,
    })),
  }
}, { method: 'search_heroes' })

const getHero = sg.wrap(async (args: GetHeroInput) => {
  if (typeof args.id !== 'number' || args.id <= 0) throw new Error('id must be a positive number')
  const res = await fetch(`${BASE}/id/${args.id}.json`)
  if (!res.ok) throw new Error(`Hero not found: ${args.id}`)
  const h = await res.json() as Hero
  return {
    id: h.id,
    name: h.name,
    powerstats: h.powerstats,
    appearance: h.appearance,
    biography: h.biography,
    image: h.images?.sm,
  }
}, { method: 'get_hero' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchHeroes, getHero }

console.log('settlegrid-superhero MCP server ready')
console.log('Methods: search_heroes, get_hero')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
