/**
 * settlegrid-meal-recipes — Meal Recipes MCP Server
 *
 * Wraps TheMealDB API with SettleGrid billing.
 * No API key needed — free tier.
 *
 * Methods:
 *   search_meal(name) — search meals (1¢)
 *   get_random_meal() — random meal (1¢)
 *   filter_by_category(category) — filter by category (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { name: string }
interface CategoryInput { category: string }

const API_BASE = 'https://www.themealdb.com/api/json/v1/1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function parseMeal(m: any) {
  const ingredients: string[] = []
  for (let i = 1; i <= 20; i++) {
    const ing = m[`strIngredient${i}`]
    const meas = m[`strMeasure${i}`]
    if (ing && ing.trim()) ingredients.push(`${meas ? meas.trim() + ' ' : ''}${ing}`)
  }
  return {
    id: m.idMeal, name: m.strMeal, category: m.strCategory, area: m.strArea,
    instructions: m.strInstructions, ingredients, image: m.strMealThumb,
    youtube: m.strYoutube, source: m.strSource, tags: m.strTags,
  }
}

const sg = settlegrid.init({
  toolSlug: 'meal-recipes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_meal: { costCents: 1, displayName: 'Search Meal' },
      get_random_meal: { costCents: 1, displayName: 'Random Meal' },
      filter_by_category: { costCents: 1, displayName: 'Filter By Category' },
    },
  },
})

const searchMeal = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/search.php?s=${encodeURIComponent(args.name)}`)
  return { meals: (data.meals || []).map(parseMeal) }
}, { method: 'search_meal' })

const getRandomMeal = sg.wrap(async () => {
  const data = await apiFetch<any>('/random.php')
  return { meal: data.meals?.[0] ? parseMeal(data.meals[0]) : null }
}, { method: 'get_random_meal' })

const filterByCategory = sg.wrap(async (args: CategoryInput) => {
  if (!args.category) throw new Error('category is required')
  const data = await apiFetch<any>(`/filter.php?c=${encodeURIComponent(args.category)}`)
  return {
    category: args.category,
    meals: (data.meals || []).map((m: any) => ({ id: m.idMeal, name: m.strMeal, image: m.strMealThumb })),
  }
}, { method: 'filter_by_category' })

export { searchMeal, getRandomMeal, filterByCategory }

console.log('settlegrid-meal-recipes MCP server ready')
console.log('Methods: search_meal, get_random_meal, filter_by_category')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
