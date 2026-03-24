/**
 * settlegrid-cocktail-recipes — Cocktail Recipes MCP Server
 *
 * Wraps TheCocktailDB API with SettleGrid billing.
 * No API key needed — free tier.
 *
 * Methods:
 *   search_cocktail(name) — search cocktails (1¢)
 *   get_random_cocktail() — random cocktail (1¢)
 *   list_by_ingredient(ingredient) — cocktails by ingredient (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { name: string }
interface IngredientInput { ingredient: string }

const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function parseDrink(d: any) {
  const ingredients: string[] = []
  for (let i = 1; i <= 15; i++) {
    const ing = d[`strIngredient${i}`]
    const meas = d[`strMeasure${i}`]
    if (ing) ingredients.push(`${meas ? meas.trim() + ' ' : ''}${ing}`)
  }
  return {
    id: d.idDrink, name: d.strDrink, category: d.strCategory,
    glass: d.strGlass, alcoholic: d.strAlcoholic,
    instructions: d.strInstructions, ingredients, image: d.strDrinkThumb,
  }
}

const sg = settlegrid.init({
  toolSlug: 'cocktail-recipes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_cocktail: { costCents: 1, displayName: 'Search Cocktail' },
      get_random_cocktail: { costCents: 1, displayName: 'Random Cocktail' },
      list_by_ingredient: { costCents: 1, displayName: 'By Ingredient' },
    },
  },
})

const searchCocktail = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/search.php?s=${encodeURIComponent(args.name)}`)
  return { drinks: (data.drinks || []).map(parseDrink) }
}, { method: 'search_cocktail' })

const getRandomCocktail = sg.wrap(async () => {
  const data = await apiFetch<any>('/random.php')
  return { drink: data.drinks?.[0] ? parseDrink(data.drinks[0]) : null }
}, { method: 'get_random_cocktail' })

const listByIngredient = sg.wrap(async (args: IngredientInput) => {
  if (!args.ingredient) throw new Error('ingredient is required')
  const data = await apiFetch<any>(`/filter.php?i=${encodeURIComponent(args.ingredient)}`)
  return {
    ingredient: args.ingredient,
    drinks: (data.drinks || []).map((d: any) => ({ id: d.idDrink, name: d.strDrink, image: d.strDrinkThumb })),
  }
}, { method: 'list_by_ingredient' })

export { searchCocktail, getRandomCocktail, listByIngredient }

console.log('settlegrid-cocktail-recipes MCP server ready')
console.log('Methods: search_cocktail, get_random_cocktail, list_by_ingredient')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
