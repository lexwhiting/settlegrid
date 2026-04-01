/**
 * settlegrid-cooking-conversion — Cooking Unit Conversion MCP Server
 *
 * Converts between cooking measurements (cups, tablespoons, grams, etc.)
 * with ingredient-specific density adjustments.
 *
 * Methods:
 *   convert(value, from, to, ingredient?)  — Convert units        (1c)
 *   get_substitutions(ingredient)           — Ingredient subs     (1c)
 *   scale_recipe(ingredients, factor)       — Scale recipe amounts (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface ConvertInput {
  value: number
  from: string
  to: string
  ingredient?: string
}

interface GetSubsInput {
  ingredient: string
}

interface ScaleInput {
  ingredients: Array<{ name: string; amount: number; unit: string }>
  factor: number
}

// --- Data -------------------------------------------------------------------

// Volume conversions (all in mL)
const VOLUME_ML: Record<string, number> = {
  ml: 1, milliliter: 1, l: 1000, liter: 1000,
  tsp: 4.929, teaspoon: 4.929,
  tbsp: 14.787, tablespoon: 14.787,
  fl_oz: 29.574, fluid_ounce: 29.574,
  cup: 236.588,
  pint: 473.176, pt: 473.176,
  quart: 946.353, qt: 946.353,
  gallon: 3785.41, gal: 3785.41,
}

// Weight conversions (all in grams)
const WEIGHT_G: Record<string, number> = {
  g: 1, gram: 1, kg: 1000, kilogram: 1000,
  oz: 28.3495, ounce: 28.3495,
  lb: 453.592, pound: 453.592,
  mg: 0.001, milligram: 0.001,
}

// Ingredient densities (g per cup)
const DENSITIES: Record<string, number> = {
  water: 236, milk: 244, flour: 125, sugar: 200,
  brown_sugar: 220, powdered_sugar: 120, butter: 227,
  oil: 218, honey: 340, rice: 185, oats: 90,
  salt: 288, baking_soda: 220, cocoa_powder: 86,
  cream_cheese: 232, sour_cream: 230, yogurt: 245,
}

const SUBSTITUTIONS: Record<string, Array<{ substitute: string; ratio: string; notes: string }>> = {
  butter: [
    { substitute: 'coconut oil', ratio: '1:1', notes: 'Works well in baking' },
    { substitute: 'applesauce', ratio: '1:0.5', notes: 'Reduces fat, adds moisture' },
    { substitute: 'Greek yogurt', ratio: '1:0.5', notes: 'Lower calorie, adds protein' },
  ],
  egg: [
    { substitute: 'flax egg (1 tbsp flax + 3 tbsp water)', ratio: '1:1', notes: 'Vegan, good for binding' },
    { substitute: 'mashed banana (1/4 cup)', ratio: '1:1', notes: 'Adds sweetness and moisture' },
    { substitute: 'applesauce (1/4 cup)', ratio: '1:1', notes: 'Good for moisture in cakes' },
  ],
  milk: [
    { substitute: 'oat milk', ratio: '1:1', notes: 'Creamy, good for baking' },
    { substitute: 'almond milk', ratio: '1:1', notes: 'Lighter flavor' },
    { substitute: 'coconut milk', ratio: '1:1', notes: 'Rich, slight coconut flavor' },
  ],
  flour: [
    { substitute: 'almond flour', ratio: '1:1', notes: 'Gluten-free, denser result' },
    { substitute: 'oat flour', ratio: '1:1', notes: 'Mild flavor, slightly dense' },
    { substitute: 'coconut flour', ratio: '1:0.25', notes: 'Very absorbent, use less' },
  ],
  sugar: [
    { substitute: 'honey', ratio: '1:0.75', notes: 'Reduce liquid by 1/4 cup, lower oven by 25F' },
    { substitute: 'maple syrup', ratio: '1:0.75', notes: 'Similar to honey adjustments' },
    { substitute: 'stevia', ratio: '1 cup : 1 tsp', notes: 'Much sweeter, adjust to taste' },
  ],
}

// --- SettleGrid Init --------------------------------------------------------

const sg = settlegrid.init({
  toolSlug: 'cooking-conversion',
  pricing: {
    defaultCostCents: 1,
    methods: {
      convert: { costCents: 1, displayName: 'Convert Units' },
      get_substitutions: { costCents: 1, displayName: 'Get Substitutions' },
      scale_recipe: { costCents: 1, displayName: 'Scale Recipe' },
    },
  },
})

// --- Handlers ---------------------------------------------------------------

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!Number.isFinite(args.value) || !args.from || !args.to) {
    throw new Error('value, from, and to are required')
  }

  const fromKey = args.from.toLowerCase().replace(/ /g, '_')
  const toKey = args.to.toLowerCase().replace(/ /g, '_')
  const fromVol = VOLUME_ML[fromKey]
  const toVol = VOLUME_ML[toKey]
  const fromWt = WEIGHT_G[fromKey]
  const toWt = WEIGHT_G[toKey]

  // Volume to volume
  if (fromVol && toVol) {
    const result = (args.value * fromVol) / toVol
    return { value: args.value, from: args.from, to: args.to, result: Math.round(result * 1000) / 1000, conversion_type: 'volume' }
  }

  // Weight to weight
  if (fromWt && toWt) {
    const result = (args.value * fromWt) / toWt
    return { value: args.value, from: args.from, to: args.to, result: Math.round(result * 1000) / 1000, conversion_type: 'weight' }
  }

  // Volume to weight (needs ingredient density)
  if (fromVol && toWt && args.ingredient) {
    const density = DENSITIES[args.ingredient.toLowerCase().replace(/ /g, '_')]
    if (!density) throw new Error(`Density unknown for "${args.ingredient}". Available: ${Object.keys(DENSITIES).join(', ')}`)
    const cups = (args.value * fromVol) / VOLUME_ML['cup']
    const grams = cups * density
    const result = grams / toWt
    return { value: args.value, from: args.from, to: args.to, result: Math.round(result * 1000) / 1000, ingredient: args.ingredient, conversion_type: 'volume-to-weight' }
  }

  // Weight to volume
  if (fromWt && toVol && args.ingredient) {
    const density = DENSITIES[args.ingredient.toLowerCase().replace(/ /g, '_')]
    if (!density) throw new Error(`Density unknown for "${args.ingredient}". Available: ${Object.keys(DENSITIES).join(', ')}`)
    const grams = args.value * fromWt
    const cups = grams / density
    const ml = cups * VOLUME_ML['cup']
    const result = ml / toVol
    return { value: args.value, from: args.from, to: args.to, result: Math.round(result * 1000) / 1000, ingredient: args.ingredient, conversion_type: 'weight-to-volume' }
  }

  throw new Error('Cannot convert between volume and weight without an ingredient. Provide ingredient parameter.')
}, { method: 'convert' })

const getSubstitutions = sg.wrap(async (args: GetSubsInput) => {
  if (!args.ingredient) throw new Error('ingredient is required')
  const key = args.ingredient.toLowerCase().replace(/ /g, '_')
  const subs = SUBSTITUTIONS[key]
  if (!subs) throw new Error(`No substitutions for "${args.ingredient}". Available: ${Object.keys(SUBSTITUTIONS).join(', ')}`)
  return { ingredient: args.ingredient, substitutions: subs, count: subs.length }
}, { method: 'get_substitutions' })

const scaleRecipe = sg.wrap(async (args: ScaleInput) => {
  if (!args.ingredients?.length || !Number.isFinite(args.factor)) throw new Error('ingredients and factor required')
  if (args.factor <= 0 || args.factor > 100) throw new Error('factor must be between 0 and 100')
  const scaled = args.ingredients.map(i => ({
    name: i.name,
    original: `${i.amount} ${i.unit}`,
    scaled_amount: Math.round(i.amount * args.factor * 1000) / 1000,
    unit: i.unit,
  }))
  return { factor: args.factor, ingredients: scaled, count: scaled.length }
}, { method: 'scale_recipe' })

// --- Exports ----------------------------------------------------------------

export { convert, getSubstitutions, scaleRecipe }

console.log('settlegrid-cooking-conversion MCP server ready')
console.log('Methods: convert, get_substitutions, scale_recipe')
console.log('Pricing: 1c per call | Powered by SettleGrid')
