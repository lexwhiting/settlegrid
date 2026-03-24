/**
 * settlegrid-nutrition-data — USDA FoodData Central MCP Server
 *
 * Wraps the USDA FoodData Central API with SettleGrid billing.
 * Requires a free API key from https://fdc.nal.usda.gov/api-key-signup.html
 *
 * Methods:
 *   search_food(query)             — Search foods by name/keyword   (1¢)
 *   get_nutrients(fdcId)           — Nutrient breakdown for a food  (2¢)
 *   get_food_details(fdcId)        — Full food details + nutrients  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchFoodInput {
  query: string
  limit?: number
  dataType?: 'Foundation' | 'SR Legacy' | 'Branded' | 'Survey'
}

interface GetNutrientsInput {
  fdcId: number
}

interface GetFoodDetailsInput {
  fdcId: number
}

interface FdcNutrient {
  nutrientId: number
  nutrientName: string
  unitName: string
  value: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1'

function getUsdaKey(): string {
  const key = process.env.USDA_API_KEY
  if (!key) throw new Error('USDA_API_KEY environment variable is required')
  return key
}

async function fdcFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${FDC_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${getUsdaKey()}`
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USDA FDC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// Key nutrients to extract (keep response focused)
const KEY_NUTRIENTS = new Set([
  'Energy', 'Protein', 'Total lipid (fat)', 'Carbohydrate, by difference',
  'Fiber, total dietary', 'Sugars, Total', 'Calcium, Ca', 'Iron, Fe',
  'Sodium, Na', 'Vitamin C, total ascorbic acid', 'Vitamin A, RAE',
  'Cholesterol', 'Fatty acids, total saturated', 'Potassium, K',
])

function formatNutrients(nutrients: FdcNutrient[]) {
  return nutrients
    .filter((n) => KEY_NUTRIENTS.has(n.nutrientName))
    .map((n) => ({
      name: n.nutrientName,
      value: n.value,
      unit: n.unitName,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nutrition-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_food: { costCents: 1, displayName: 'Search Foods' },
      get_nutrients: { costCents: 2, displayName: 'Get Nutrients' },
      get_food_details: { costCents: 2, displayName: 'Food Details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFood = sg.wrap(async (args: SearchFoodInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (e.g. "chicken breast", "banana")')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)

  const body: Record<string, unknown> = {
    query: args.query.trim(),
    pageSize: limit,
  }
  if (args.dataType) {
    body.dataType = [args.dataType]
  }

  const data = await fdcFetch<{
    totalHits: number
    foods: Array<{
      fdcId: number
      description: string
      dataType: string
      brandOwner?: string
      brandName?: string
      foodCategory?: string
      servingSize?: number
      servingSizeUnit?: string
    }>
  }>('/foods/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    query: args.query,
    totalHits: data.totalHits,
    foods: data.foods.map((f) => ({
      fdcId: f.fdcId,
      description: f.description,
      dataType: f.dataType,
      brand: f.brandOwner ?? f.brandName ?? null,
      category: f.foodCategory ?? null,
      serving: f.servingSize
        ? `${f.servingSize} ${f.servingSizeUnit ?? 'g'}`
        : null,
    })),
  }
}, { method: 'search_food' })

const getNutrients = sg.wrap(async (args: GetNutrientsInput) => {
  if (!args.fdcId || typeof args.fdcId !== 'number') {
    throw new Error('fdcId is required (numeric FDC ID from search results)')
  }

  const data = await fdcFetch<{
    fdcId: number
    description: string
    foodNutrients: FdcNutrient[]
    servingSize?: number
    servingSizeUnit?: string
  }>(`/food/${args.fdcId}`)

  return {
    fdcId: data.fdcId,
    description: data.description,
    serving: data.servingSize
      ? `${data.servingSize} ${data.servingSizeUnit ?? 'g'}`
      : 'per 100g',
    nutrients: formatNutrients(data.foodNutrients),
    totalNutrientsAvailable: data.foodNutrients.length,
  }
}, { method: 'get_nutrients' })

const getFoodDetails = sg.wrap(async (args: GetFoodDetailsInput) => {
  if (!args.fdcId || typeof args.fdcId !== 'number') {
    throw new Error('fdcId is required (numeric FDC ID from search results)')
  }

  const data = await fdcFetch<{
    fdcId: number
    description: string
    dataType: string
    foodCategory?: { description: string }
    brandOwner?: string
    brandName?: string
    ingredients?: string
    servingSize?: number
    servingSizeUnit?: string
    foodPortions?: Array<{
      amount: number
      measureUnit: { name: string }
      gramWeight: number
    }>
    foodNutrients: FdcNutrient[]
    publicationDate?: string
  }>(`/food/${args.fdcId}`)

  return {
    fdcId: data.fdcId,
    description: data.description,
    dataType: data.dataType,
    category: data.foodCategory?.description ?? null,
    brand: data.brandOwner ?? data.brandName ?? null,
    ingredients: data.ingredients?.slice(0, 500) ?? null,
    serving: data.servingSize
      ? `${data.servingSize} ${data.servingSizeUnit ?? 'g'}`
      : 'per 100g',
    portions: (data.foodPortions ?? []).slice(0, 10).map((p) => ({
      amount: p.amount,
      unit: p.measureUnit.name,
      gramWeight: p.gramWeight,
    })),
    nutrients: formatNutrients(data.foodNutrients),
    publishedDate: data.publicationDate ?? null,
  }
}, { method: 'get_food_details' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFood, getNutrients, getFoodDetails }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'nutrition-data',
//   pricing: { defaultCostCents: 1, methods: { get_nutrients: { costCents: 2 }, get_food_details: { costCents: 2 } } },
//   routes: { ... },
// })

console.log('settlegrid-nutrition-data MCP server ready')
console.log('Methods: search_food, get_nutrients, get_food_details')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
