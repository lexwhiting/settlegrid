/**
 * settlegrid-harry-potter — Harry Potter API MCP Server
 *
 * Get Harry Potter character data from the HP API.
 *
 * Methods:
 *   get_characters()              — Get all Harry Potter characters  (1¢)
 *   get_students()                — Get Hogwarts students only  (1¢)
 *   get_staff()                   — Get Hogwarts staff only  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCharactersInput {

}

interface GetStudentsInput {

}

interface GetStaffInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://hp-api.onrender.com/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-harry-potter/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Harry Potter API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'harry-potter',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_characters: { costCents: 1, displayName: 'Get Characters' },
      get_students: { costCents: 1, displayName: 'Get Students' },
      get_staff: { costCents: 1, displayName: 'Get Staff' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCharacters = sg.wrap(async (args: GetCharactersInput) => {

  const data = await apiFetch<any>(`/characters`)
  return {
    name: data.name,
    house: data.house,
    species: data.species,
    wizard: data.wizard,
    ancestry: data.ancestry,
    patronus: data.patronus,
    actor: data.actor,
  }
}, { method: 'get_characters' })

const getStudents = sg.wrap(async (args: GetStudentsInput) => {

  const data = await apiFetch<any>(`/characters/students`)
  return {
    name: data.name,
    house: data.house,
    species: data.species,
    wizard: data.wizard,
    ancestry: data.ancestry,
    patronus: data.patronus,
  }
}, { method: 'get_students' })

const getStaff = sg.wrap(async (args: GetStaffInput) => {

  const data = await apiFetch<any>(`/characters/staff`)
  return {
    name: data.name,
    house: data.house,
    species: data.species,
    wizard: data.wizard,
    ancestry: data.ancestry,
    patronus: data.patronus,
  }
}, { method: 'get_staff' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCharacters, getStudents, getStaff }

console.log('settlegrid-harry-potter MCP server ready')
console.log('Methods: get_characters, get_students, get_staff')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
