/**
 * settlegrid-calorie-ninjas — Calorie Ninjas MCP Server
 *
 * Natural language nutrition lookup — calories, macros, and micronutrients.
 *
 * Methods:
 *   get_nutrition(query)          — Get nutrition info for a food item (natural language)  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetNutritionInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.calorieninjas.com/v1'
const API_KEY = process.env.CALORIE_NINJAS_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-calorie-ninjas/1.0', 'X-Api-Key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Calorie Ninjas API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'calorie-ninjas',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_nutrition: { costCents: 2, displayName: 'Get Nutrition' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getNutrition = sg.wrap(async (args: GetNutritionInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/nutrition?query=${encodeURIComponent(query)}`)
  const items = (data.items ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        name: item.name,
        calories: item.calories,
        protein_g: item.protein_g,
        fat_total_g: item.fat_total_g,
        carbohydrates_total_g: item.carbohydrates_total_g,
        fiber_g: item.fiber_g,
        sugar_g: item.sugar_g,
    })),
  }
}, { method: 'get_nutrition' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getNutrition }

console.log('settlegrid-calorie-ninjas MCP server ready')
console.log('Methods: get_nutrition')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
