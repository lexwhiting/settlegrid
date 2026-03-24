/**
 * settlegrid-exercisedb — ExerciseDB MCP Server
 *
 * Exercise database with body part targeting, equipment, and GIF animations.
 *
 * Methods:
 *   search_exercises(query)       — Search exercises by name  (2¢)
 *   list_by_bodypart(bodypart)    — List exercises targeting a body part  (2¢)
 *   list_by_equipment(equipment)  — List exercises using specific equipment  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchExercisesInput {
  query: string
}

interface ListByBodypartInput {
  bodypart: string
}

interface ListByEquipmentInput {
  equipment: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://exercisedb.p.rapidapi.com'
const API_KEY = process.env.RAPIDAPI_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-exercisedb/1.0', 'X-RapidAPI-Key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ExerciseDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'exercisedb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_exercises: { costCents: 2, displayName: 'Search Exercises' },
      list_by_bodypart: { costCents: 2, displayName: 'List by Body Part' },
      list_by_equipment: { costCents: 2, displayName: 'List by Equipment' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchExercises = sg.wrap(async (args: SearchExercisesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/exercises/name/${encodeURIComponent(query)}?limit=10`)
  return {
    id: data.id,
    name: data.name,
    bodyPart: data.bodyPart,
    equipment: data.equipment,
    target: data.target,
    gifUrl: data.gifUrl,
  }
}, { method: 'search_exercises' })

const listByBodypart = sg.wrap(async (args: ListByBodypartInput) => {
  if (!args.bodypart || typeof args.bodypart !== 'string') throw new Error('bodypart is required')
  const bodypart = args.bodypart.trim()
  const data = await apiFetch<any>(`/exercises/bodyPart/${encodeURIComponent(bodypart)}?limit=10`)
  return {
    id: data.id,
    name: data.name,
    equipment: data.equipment,
    target: data.target,
    gifUrl: data.gifUrl,
  }
}, { method: 'list_by_bodypart' })

const listByEquipment = sg.wrap(async (args: ListByEquipmentInput) => {
  if (!args.equipment || typeof args.equipment !== 'string') throw new Error('equipment is required')
  const equipment = args.equipment.trim()
  const data = await apiFetch<any>(`/exercises/equipment/${encodeURIComponent(equipment)}?limit=10`)
  return {
    id: data.id,
    name: data.name,
    bodyPart: data.bodyPart,
    target: data.target,
    gifUrl: data.gifUrl,
  }
}, { method: 'list_by_equipment' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchExercises, listByBodypart, listByEquipment }

console.log('settlegrid-exercisedb MCP server ready')
console.log('Methods: search_exercises, list_by_bodypart, list_by_equipment')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
