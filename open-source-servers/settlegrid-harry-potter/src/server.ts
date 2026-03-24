/**
 * settlegrid-harry-potter — Harry Potter API MCP Server
 *
 * Methods:
 *   get_characters(house?)   — Get characters      (1¢)
 *   get_character(id)        — Get character by ID  (1¢)
 *   get_spells()             — Get all spells       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CharactersInput { house?: string }
interface CharacterInput { id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://hp-api.onrender.com/api'

async function hpFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HP API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const VALID_HOUSES = new Set(['gryffindor', 'slytherin', 'hufflepuff', 'ravenclaw'])

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'harry-potter',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_characters: { costCents: 1, displayName: 'Get Characters' },
      get_character: { costCents: 1, displayName: 'Get Character' },
      get_spells: { costCents: 1, displayName: 'Get Spells' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCharacters = sg.wrap(async (args: CharactersInput) => {
  let path = '/characters'
  if (args.house) {
    const house = args.house.toLowerCase().trim()
    if (!VALID_HOUSES.has(house)) throw new Error(`house must be one of: ${[...VALID_HOUSES].join(', ')}`)
    path = `/characters/house/${house}`
  }
  const data = await hpFetch<Array<{ id: string; name: string; house: string; species: string; actor: string; patronus: string; alive: boolean }>>(path)
  return {
    count: data.length,
    characters: data.slice(0, 25).map((c) => ({
      id: c.id,
      name: c.name,
      house: c.house,
      species: c.species,
      actor: c.actor,
      patronus: c.patronus,
      alive: c.alive,
    })),
  }
}, { method: 'get_characters' })

const getCharacter = sg.wrap(async (args: CharacterInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const data = await hpFetch<Array<{ id: string; name: string; house: string; species: string; gender: string; dateOfBirth: string; actor: string; patronus: string; wand: { wood: string; core: string; length: number }; alive: boolean }>>(`/character/${encodeURIComponent(args.id)}`)
  if (!data.length) throw new Error(`Character not found: ${args.id}`)
  const c = data[0]
  return {
    id: c.id,
    name: c.name,
    house: c.house,
    species: c.species,
    gender: c.gender,
    dateOfBirth: c.dateOfBirth,
    actor: c.actor,
    patronus: c.patronus,
    wand: c.wand,
    alive: c.alive,
  }
}, { method: 'get_character' })

const getSpells = sg.wrap(async () => {
  const data = await hpFetch<Array<{ id: string; name: string; description: string }>>('/spells')
  return { count: data.length, spells: data.map((s) => ({ id: s.id, name: s.name, description: s.description })) }
}, { method: 'get_spells' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCharacters, getCharacter, getSpells }

console.log('settlegrid-harry-potter MCP server ready')
console.log('Methods: get_characters, get_character, get_spells')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
