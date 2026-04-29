/**
 * settlegrid-allergy-data — Allergen Information MCP Server
 *
 * Comprehensive allergen database with cross-reactivity data and
 * food labeling guidance. All data stored locally.
 *
 * Methods:
 *   get_allergen(name)              — Get allergen details           (1¢)
 *   check_cross_reactivity(name)    — Check cross-reactive allergens (1¢)
 *   get_food_labels(allergen)       — Get food labeling terms        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAllergenInput {
  name: string
}

interface CheckCrossReactivityInput {
  allergen: string
}

interface GetFoodLabelsInput {
  allergen: string
}

interface AllergenData {
  type: string
  prevalence_pct: number
  symptoms: string[]
  avoidance: string[]
  emergency: boolean
  icd10_code: string
}

// ─── Data ───────────────────────────────────────────────────────────────────

const ALLERGENS: Record<string, AllergenData> = {
  peanut: {
    type: 'food', prevalence_pct: 2.5,
    symptoms: ['hives', 'swelling', 'anaphylaxis', 'GI distress', 'wheezing'],
    avoidance: ['Check labels for peanut/tree nut warnings', 'Carry epinephrine auto-injector', 'Inform restaurants'],
    emergency: true, icd10_code: 'T78.01',
  },
  shellfish: {
    type: 'food', prevalence_pct: 2.0,
    symptoms: ['hives', 'swelling', 'GI distress', 'anaphylaxis', 'tingling in mouth'],
    avoidance: ['Avoid crustaceans and mollusks', 'Check Asian sauces and dressings', 'Be cautious with fish stock'],
    emergency: true, icd10_code: 'T78.02',
  },
  milk: {
    type: 'food', prevalence_pct: 6.0,
    symptoms: ['hives', 'wheezing', 'vomiting', 'abdominal cramps', 'diarrhea'],
    avoidance: ['Read all food labels for casein/whey', 'Check medications for lactose', 'Use dairy-free alternatives'],
    emergency: true, icd10_code: 'T78.07',
  },
  egg: {
    type: 'food', prevalence_pct: 2.5,
    symptoms: ['skin rash', 'hives', 'nasal congestion', 'vomiting', 'anaphylaxis'],
    avoidance: ['Check baked goods', 'Some vaccines contain egg protein', 'Read labels for albumin'],
    emergency: true, icd10_code: 'T78.08',
  },
  tree_nuts: {
    type: 'food', prevalence_pct: 1.2,
    symptoms: ['itching', 'hives', 'swelling', 'anaphylaxis', 'abdominal pain'],
    avoidance: ['Avoid all tree nut varieties', 'Check for cross-contamination in facilities', 'Read cosmetic labels'],
    emergency: true, icd10_code: 'T78.05',
  },
  dust_mites: {
    type: 'environmental', prevalence_pct: 20,
    symptoms: ['sneezing', 'runny nose', 'itchy eyes', 'asthma exacerbation', 'eczema flare'],
    avoidance: ['Allergen-proof mattress covers', 'HEPA filter vacuum', 'Maintain humidity below 50%', 'Wash bedding weekly in hot water'],
    emergency: false, icd10_code: 'J30.89',
  },
  pollen: {
    type: 'environmental', prevalence_pct: 30,
    symptoms: ['sneezing', 'congestion', 'itchy/watery eyes', 'fatigue', 'sinus pressure'],
    avoidance: ['Monitor pollen counts', 'Keep windows closed', 'Shower after outdoor activity', 'Use HEPA air purifier'],
    emergency: false, icd10_code: 'J30.1',
  },
  latex: {
    type: 'contact', prevalence_pct: 1,
    symptoms: ['skin rash', 'hives', 'itching', 'anaphylaxis', 'rhinitis'],
    avoidance: ['Use non-latex gloves', 'Alert medical and dental providers', 'Check for latex in balloons and rubber bands'],
    emergency: true, icd10_code: 'T78.40',
  },
  penicillin: {
    type: 'drug', prevalence_pct: 10,
    symptoms: ['rash', 'hives', 'anaphylaxis', 'fever', 'wheezing'],
    avoidance: ['Medical alert bracelet', 'Inform all healthcare providers', 'Ask about penicillin skin testing'],
    emergency: true, icd10_code: 'Z88.0',
  },
  soy: {
    type: 'food', prevalence_pct: 0.4,
    symptoms: ['hives', 'itching', 'tingling in mouth', 'abdominal pain', 'wheezing'],
    avoidance: ['Check labels for soy lecithin', 'Avoid soy sauce and tofu', 'Check processed foods'],
    emergency: false, icd10_code: 'T78.09',
  },
}

const CROSS_REACTIVITY: Record<string, Array<{ allergen: string; likelihood: string }>> = {
  peanut: [
    { allergen: 'lupin', likelihood: 'high' },
    { allergen: 'soy', likelihood: 'low' },
    { allergen: 'tree nuts', likelihood: 'moderate' },
  ],
  latex: [
    { allergen: 'banana', likelihood: 'high' },
    { allergen: 'avocado', likelihood: 'high' },
    { allergen: 'kiwi', likelihood: 'high' },
    { allergen: 'chestnut', likelihood: 'moderate' },
  ],
  pollen: [
    { allergen: 'apple (birch pollen)', likelihood: 'high' },
    { allergen: 'pear (birch pollen)', likelihood: 'moderate' },
    { allergen: 'cherry (birch pollen)', likelihood: 'moderate' },
    { allergen: 'celery (mugwort pollen)', likelihood: 'moderate' },
  ],
  shellfish: [
    { allergen: 'dust mites', likelihood: 'moderate' },
    { allergen: 'cockroach', likelihood: 'moderate' },
  ],
  milk: [
    { allergen: 'goat milk', likelihood: 'high' },
    { allergen: 'sheep milk', likelihood: 'high' },
    { allergen: 'beef (rare)', likelihood: 'low' },
  ],
  penicillin: [
    { allergen: 'amoxicillin', likelihood: 'high' },
    { allergen: 'cephalosporins', likelihood: 'low' },
    { allergen: 'carbapenems', likelihood: 'very low' },
  ],
}

const FOOD_LABEL_TERMS: Record<string, string[]> = {
  milk: ['casein', 'whey', 'lactalbumin', 'lactoglobulin', 'ghee', 'curds', 'rennet casein'],
  egg: ['albumin', 'globulin', 'lysozyme', 'mayonnaise', 'meringue', 'ovalbumin', 'ovomucin'],
  peanut: ['arachis oil', 'beer nuts', 'ground nuts', 'monkey nuts', 'earth nuts'],
  soy: ['edamame', 'miso', 'soy lecithin', 'textured vegetable protein', 'tempeh', 'tofu'],
  wheat: ['bulgur', 'couscous', 'durum', 'einkorn', 'emmer', 'kamut', 'semolina', 'spelt'],
  shellfish: ['surimi', 'glucosamine', 'bouillabaisse', 'crevette', 'scampi'],
  tree_nuts: ['marzipan', 'nougat', 'praline', 'gianduja', 'nut meal', 'nut paste'],
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'allergy-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_allergen: { costCents: 1, displayName: 'Get Allergen Info' },
      check_cross_reactivity: { costCents: 1, displayName: 'Check Cross-Reactivity' },
      get_food_labels: { costCents: 1, displayName: 'Get Food Label Terms' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAllergen = sg.wrap(async (args: GetAllergenInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (e.g. "peanut", "latex", "dust_mites")')
  }
  const key = args.name.toLowerCase().replace(/ /g, '_')
  const a = ALLERGENS[key]
  if (!a) {
    throw new Error(`Unknown allergen "${args.name}". Available: ${Object.keys(ALLERGENS).join(', ')}`)
  }
  return {
    allergen: key,
    ...a,
    disclaimer: 'For informational purposes only. Consult an allergist for diagnosis and treatment.',
  }
}, { method: 'get_allergen' })

const checkCrossReactivity = sg.wrap(async (args: CheckCrossReactivityInput) => {
  if (!args.allergen || typeof args.allergen !== 'string') {
    throw new Error('allergen is required (e.g. "peanut", "latex")')
  }
  const key = args.allergen.toLowerCase().replace(/ /g, '_')
  const crossReactive = CROSS_REACTIVITY[key]
  return {
    allergen: key,
    cross_reactive_with: crossReactive ?? [],
    has_data: !!crossReactive,
    note: crossReactive
      ? 'Cross-reactivity is possible but not guaranteed for every individual'
      : 'No well-established cross-reactivity data in database',
  }
}, { method: 'check_cross_reactivity' })

const getFoodLabels = sg.wrap(async (args: GetFoodLabelsInput) => {
  if (!args.allergen || typeof args.allergen !== 'string') {
    throw new Error('allergen is required (e.g. "milk", "egg", "peanut")')
  }
  const key = args.allergen.toLowerCase().replace(/ /g, '_')
  const terms = FOOD_LABEL_TERMS[key]
  if (!terms) {
    throw new Error(`No label data for "${args.allergen}". Available: ${Object.keys(FOOD_LABEL_TERMS).join(', ')}`)
  }
  return {
    allergen: key,
    hidden_label_terms: terms,
    count: terms.length,
    advice: 'Always read the full ingredient list. Manufacturers may change formulations.',
  }
}, { method: 'get_food_labels' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAllergen, checkCrossReactivity, getFoodLabels }

console.log('settlegrid-allergy-data MCP server ready')
console.log('Methods: get_allergen, check_cross_reactivity, get_food_labels')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
