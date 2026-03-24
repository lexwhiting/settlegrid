/**
 * settlegrid-edamam — Edamam MCP Server
 *
 * Recipe search and nutrition analysis with detailed dietary information.
 *
 * Methods:
 *   search_recipes(query)         — Search recipes by keyword  (2¢)
 *   search_food(query)            — Search food database for nutrition info  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchRecipesInput {
  query: string
}

interface SearchFoodInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.edamam.com/api'
const API_KEY = process.env.EDAMAM_APP_ID ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-edamam/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Edamam API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'edamam',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_recipes: { costCents: 2, displayName: 'Search Recipes' },
      search_food: { costCents: 2, displayName: 'Search Food' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRecipes = sg.wrap(async (args: SearchRecipesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/recipes/v2?type=public&q=${encodeURIComponent(query)}&app_key=${process.env.EDAMAM_APP_KEY}&app_id=${API_KEY}`)
  const items = (data.hits ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        recipe.label: item.recipe.label,
        recipe.source: item.recipe.source,
        recipe.url: item.recipe.url,
        recipe.calories: item.recipe.calories,
        recipe.dietLabels: item.recipe.dietLabels,
    })),
  }
}, { method: 'search_recipes' })

const searchFood = sg.wrap(async (args: SearchFoodInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/food-database/v2/parser?ingr=${encodeURIComponent(query)}&app_key=${process.env.EDAMAM_APP_KEY}&app_id=${API_KEY}`)
  const items = (data.hints ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        food.foodId: item.food.foodId,
        food.label: item.food.label,
        food.nutrients: item.food.nutrients,
        food.category: item.food.category,
    })),
  }
}, { method: 'search_food' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRecipes, searchFood }

console.log('settlegrid-edamam MCP server ready')
console.log('Methods: search_recipes, search_food')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
