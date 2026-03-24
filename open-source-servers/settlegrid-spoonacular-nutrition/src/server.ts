/**
 * settlegrid-spoonacular-nutrition — Spoonacular Nutrition MCP Server
 *
 * Wraps Spoonacular API with SettleGrid billing.
 * Free key from https://spoonacular.com/food-api/console.
 *
 * Methods:
 *   search_recipes_spoon(query, diet?, limit?) — search recipes (2¢)
 *   get_nutrition_info(ingredient) — nutrition info (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface RecipeInput { query: string; diet?: string; limit?: number }
interface NutritionInput { ingredient: string }

const API_BASE = 'https://api.spoonacular.com'
const API_KEY = process.env.SPOONACULAR_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${API_BASE}${path}${sep}apiKey=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'spoonacular-nutrition',
  pricing: { defaultCostCents: 2, methods: { search_recipes_spoon: { costCents: 2, displayName: 'Search Recipes' }, get_nutrition_info: { costCents: 2, displayName: 'Nutrition Info' } } },
})

const searchRecipesSpoon = sg.wrap(async (args: RecipeInput) => {
  if (!args.query) throw new Error('query is required')
  if (!API_KEY) throw new Error('SPOONACULAR_API_KEY not set')
  const limit = args.limit ?? 10
  let path = `/recipes/complexSearch?query=${encodeURIComponent(args.query)}&number=${limit}&addRecipeNutrition=true`
  if (args.diet) path += `&diet=${args.diet}`
  const data = await apiFetch<any>(path)
  return {
    total: data.totalResults,
    recipes: (data.results || []).map((r: any) => ({
      id: r.id, title: r.title, image: r.image,
      ready_minutes: r.readyInMinutes, servings: r.servings,
      calories: r.nutrition?.nutrients?.find((n: any) => n.name === 'Calories')?.amount,
      protein: r.nutrition?.nutrients?.find((n: any) => n.name === 'Protein')?.amount,
    })),
  }
}, { method: 'search_recipes_spoon' })

const getNutritionInfo = sg.wrap(async (args: NutritionInput) => {
  if (!args.ingredient) throw new Error('ingredient is required')
  if (!API_KEY) throw new Error('SPOONACULAR_API_KEY not set')
  const data = await apiFetch<any>(`/recipes/parseIngredients?ingredientList=${encodeURIComponent(args.ingredient)}&servings=1`)
  const item = Array.isArray(data) ? data[0] : data
  return {
    name: item?.name, amount: item?.amount, unit: item?.unit,
    nutrients: item?.nutrition?.nutrients?.slice(0, 15).map((n: any) => ({
      name: n.name, amount: n.amount, unit: n.unit, daily_pct: n.percentOfDailyNeeds,
    })),
  }
}, { method: 'get_nutrition_info' })

export { searchRecipesSpoon, getNutritionInfo }

console.log('settlegrid-spoonacular-nutrition MCP server ready')
console.log('Methods: search_recipes_spoon, get_nutrition_info')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
