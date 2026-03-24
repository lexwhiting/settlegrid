/**
 * settlegrid-superhero — Superhero API MCP Server
 *
 * Browse superhero data — powerstats, biography, and images.
 *
 * Methods:
 *   get_all()                     — Get full list of superheroes  (1¢)
 *   get_hero(id)                  — Get superhero details by ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAllInput {

}

interface GetHeroInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://akabab.github.io/superhero-api/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-superhero/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Superhero API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'superhero',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_all: { costCents: 1, displayName: 'Get All Heroes' },
      get_hero: { costCents: 1, displayName: 'Get Hero' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAll = sg.wrap(async (args: GetAllInput) => {

  const data = await apiFetch<any>(`/all.json`)
  return {
    id: data.id,
    name: data.name,
    powerstats: data.powerstats,
    appearance: data.appearance,
    biography: data.biography,
  }
}, { method: 'get_all' })

const getHero = sg.wrap(async (args: GetHeroInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/id/${id}.json`)
  return {
    id: data.id,
    name: data.name,
    powerstats: data.powerstats,
    appearance: data.appearance,
    biography: data.biography,
    images: data.images,
  }
}, { method: 'get_hero' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAll, getHero }

console.log('settlegrid-superhero MCP server ready')
console.log('Methods: get_all, get_hero')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
