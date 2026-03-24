/**
 * settlegrid-themealdb — TheMealDB MCP Server
 *
 * Free meal and recipe database with categories, ingredients, and instructions.
 *
 * Methods:
 *   search_meals(query)           — Search meals by name  (1¢)
 *   get_meal(meal_id)             — Get meal details by ID  (1¢)
 *   random_meal()                 — Get a random meal recipe  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchMealsInput {
  query: string
}

interface GetMealInput {
  meal_id: string
}

interface RandomMealInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.themealdb.com/api/json/v1/1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-themealdb/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TheMealDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'themealdb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_meals: { costCents: 1, displayName: 'Search Meals' },
      get_meal: { costCents: 1, displayName: 'Get Meal' },
      random_meal: { costCents: 1, displayName: 'Random Meal' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMeals = sg.wrap(async (args: SearchMealsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search.php?s=${encodeURIComponent(query)}`)
  const items = (data.meals ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        idMeal: item.idMeal,
        strMeal: item.strMeal,
        strCategory: item.strCategory,
        strArea: item.strArea,
        strInstructions: item.strInstructions,
        strMealThumb: item.strMealThumb,
    })),
  }
}, { method: 'search_meals' })

const getMeal = sg.wrap(async (args: GetMealInput) => {
  if (!args.meal_id || typeof args.meal_id !== 'string') throw new Error('meal_id is required')
  const meal_id = args.meal_id.trim()
  const data = await apiFetch<any>(`/lookup.php?i=${encodeURIComponent(meal_id)}`)
  const items = (data.meals ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        idMeal: item.idMeal,
        strMeal: item.strMeal,
        strCategory: item.strCategory,
        strArea: item.strArea,
        strInstructions: item.strInstructions,
        strIngredient1: item.strIngredient1,
        strIngredient2: item.strIngredient2,
        strIngredient3: item.strIngredient3,
    })),
  }
}, { method: 'get_meal' })

const randomMeal = sg.wrap(async (args: RandomMealInput) => {

  const data = await apiFetch<any>(`/random.php`)
  const items = (data.meals ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        idMeal: item.idMeal,
        strMeal: item.strMeal,
        strCategory: item.strCategory,
        strArea: item.strArea,
        strInstructions: item.strInstructions,
        strMealThumb: item.strMealThumb,
    })),
  }
}, { method: 'random_meal' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMeals, getMeal, randomMeal }

console.log('settlegrid-themealdb MCP server ready')
console.log('Methods: search_meals, get_meal, random_meal')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
