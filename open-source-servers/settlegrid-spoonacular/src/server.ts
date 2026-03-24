/**
 * settlegrid-spoonacular — Spoonacular MCP Server
 *
 * Comprehensive recipe and food API with meal planning and nutrition.
 *
 * Methods:
 *   search_recipes(query)         — Search recipes by query  (2¢)
 *   get_recipe(recipe_id)         — Get recipe details including instructions  (2¢)
 *   search_ingredients(query)     — Search food ingredients  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchRecipesInput {
  query: string
}

interface GetRecipeInput {
  recipe_id: number
}

interface SearchIngredientsInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.spoonacular.com'
const API_KEY = process.env.SPOONACULAR_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-spoonacular/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Spoonacular API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spoonacular',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_recipes: { costCents: 2, displayName: 'Search Recipes' },
      get_recipe: { costCents: 2, displayName: 'Get Recipe' },
      search_ingredients: { costCents: 2, displayName: 'Search Ingredients' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRecipes = sg.wrap(async (args: SearchRecipesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/recipes/complexSearch?query=${encodeURIComponent(query)}&number=10&apiKey=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        image: item.image,
        sourceUrl: item.sourceUrl,
    })),
  }
}, { method: 'search_recipes' })

const getRecipe = sg.wrap(async (args: GetRecipeInput) => {
  if (typeof args.recipe_id !== 'number') throw new Error('recipe_id is required and must be a number')
  const recipe_id = args.recipe_id
  const data = await apiFetch<any>(`/recipes/${recipe_id}/information?apiKey=${API_KEY}`)
  return {
    id: data.id,
    title: data.title,
    instructions: data.instructions,
    readyInMinutes: data.readyInMinutes,
    servings: data.servings,
    sourceUrl: data.sourceUrl,
  }
}, { method: 'get_recipe' })

const searchIngredients = sg.wrap(async (args: SearchIngredientsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/food/ingredients/search?query=${encodeURIComponent(query)}&number=10&apiKey=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        image: item.image,
    })),
  }
}, { method: 'search_ingredients' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRecipes, getRecipe, searchIngredients }

console.log('settlegrid-spoonacular MCP server ready')
console.log('Methods: search_recipes, get_recipe, search_ingredients')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
