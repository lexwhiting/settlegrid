/**
 * settlegrid-swapi — SWAPI Star Wars MCP Server
 *
 * Wraps SWAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_people(name) — Star Wars characters (1¢)
 *   search_planets(name) — Star Wars planets (1¢)
 *   search_starships(name) — Star Wars starships (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { name: string }

const API_BASE = 'https://swapi.dev/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'swapi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_people: { costCents: 1, displayName: 'Search People' },
      search_planets: { costCents: 1, displayName: 'Search Planets' },
      search_starships: { costCents: 1, displayName: 'Search Starships' },
    },
  },
})

const searchPeople = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/people/?search=${encodeURIComponent(args.name)}`)
  return {
    count: data.count,
    results: (data.results || []).map((p: any) => ({
      name: p.name, height: p.height, mass: p.mass, hair_color: p.hair_color,
      eye_color: p.eye_color, birth_year: p.birth_year, gender: p.gender,
    })),
  }
}, { method: 'search_people' })

const searchPlanets = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/planets/?search=${encodeURIComponent(args.name)}`)
  return {
    count: data.count,
    results: (data.results || []).map((p: any) => ({
      name: p.name, climate: p.climate, terrain: p.terrain, population: p.population,
      diameter: p.diameter, gravity: p.gravity, orbital_period: p.orbital_period,
    })),
  }
}, { method: 'search_planets' })

const searchStarships = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/starships/?search=${encodeURIComponent(args.name)}`)
  return {
    count: data.count,
    results: (data.results || []).map((s: any) => ({
      name: s.name, model: s.model, manufacturer: s.manufacturer,
      cost: s.cost_in_credits, length: s.length, crew: s.crew,
      passengers: s.passengers, hyperdrive_rating: s.hyperdrive_rating,
      starship_class: s.starship_class,
    })),
  }
}, { method: 'search_starships' })

export { searchPeople, searchPlanets, searchStarships }

console.log('settlegrid-swapi MCP server ready')
console.log('Methods: search_people, search_planets, search_starships')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
