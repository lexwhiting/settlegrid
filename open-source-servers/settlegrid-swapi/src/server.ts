/**
 * settlegrid-swapi — Star Wars API MCP Server
 *
 * Methods:
 *   search_people(query)    — Search characters    (1¢)
 *   search_planets(query)   — Search planets       (1¢)
 *   get_film(episode)       — Get film details     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface FilmInput { episode: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://swapi.dev/api'

async function swapiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SWAPI ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'swapi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_people: { costCents: 1, displayName: 'Search People' },
      search_planets: { costCents: 1, displayName: 'Search Planets' },
      get_film: { costCents: 1, displayName: 'Get Film' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPeople = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await swapiFetch<{ count: number; results: Array<{ name: string; height: string; mass: string; hair_color: string; birth_year: string; gender: string; homeworld: string }> }>(`/people/?search=${q}`)
  return {
    query: args.query,
    count: data.count,
    people: data.results.map((p) => ({
      name: p.name,
      height: p.height,
      mass: p.mass,
      hairColor: p.hair_color,
      birthYear: p.birth_year,
      gender: p.gender,
    })),
  }
}, { method: 'search_people' })

const searchPlanets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await swapiFetch<{ count: number; results: Array<{ name: string; climate: string; terrain: string; population: string; diameter: string; gravity: string }> }>(`/planets/?search=${q}`)
  return {
    query: args.query,
    count: data.count,
    planets: data.results.map((p) => ({
      name: p.name,
      climate: p.climate,
      terrain: p.terrain,
      population: p.population,
      diameter: p.diameter,
      gravity: p.gravity,
    })),
  }
}, { method: 'search_planets' })

const getFilm = sg.wrap(async (args: FilmInput) => {
  if (typeof args.episode !== 'number' || args.episode < 1 || args.episode > 6) {
    throw new Error('episode must be 1-6')
  }
  const data = await swapiFetch<{ results: Array<{ title: string; episode_id: number; opening_crawl: string; director: string; producer: string; release_date: string }> }>('/films/')
  const film = data.results.find((f) => f.episode_id === args.episode)
  if (!film) throw new Error(`Film not found for episode ${args.episode}`)
  return {
    title: film.title,
    episode: film.episode_id,
    openingCrawl: film.opening_crawl?.slice(0, 500),
    director: film.director,
    producer: film.producer,
    releaseDate: film.release_date,
  }
}, { method: 'get_film' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPeople, searchPlanets, getFilm }

console.log('settlegrid-swapi MCP server ready')
console.log('Methods: search_people, search_planets, get_film')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
