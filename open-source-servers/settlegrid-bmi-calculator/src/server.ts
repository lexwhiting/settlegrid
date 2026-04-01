/**
 * settlegrid-bmi-calculator — Health Metrics Calculator MCP Server
 *
 * Calculates BMI, BMR, and TDEE with detailed health category information.
 * All calculations done locally using standard medical formulas.
 *
 * Methods:
 *   calculate_bmi(weight, height)      — Calculate Body Mass Index      (1¢)
 *   calculate_bmr(weight, height, age) — Calculate Basal Metabolic Rate (1¢)
 *   calculate_tdee(bmr, activity)      — Calculate daily energy needs   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CalculateBmiInput {
  weight_kg: number
  height_cm: number
}

interface CalculateBmrInput {
  weight_kg: number
  height_cm: number
  age: number
  sex: string
}

interface CalculateTdeeInput {
  bmr: number
  activity_level: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const BMI_CATEGORIES = [
  { max: 16, label: 'Severe Thinness', risk: 'high' },
  { max: 17, label: 'Moderate Thinness', risk: 'moderate' },
  { max: 18.5, label: 'Mild Thinness', risk: 'low' },
  { max: 25, label: 'Normal', risk: 'minimal' },
  { max: 30, label: 'Overweight', risk: 'low' },
  { max: 35, label: 'Obese Class I', risk: 'moderate' },
  { max: 40, label: 'Obese Class II', risk: 'high' },
  { max: Infinity, label: 'Obese Class III', risk: 'very high' },
]

const ACTIVITY_MULTIPLIERS: Record<string, { multiplier: number; description: string }> = {
  sedentary: { multiplier: 1.2, description: 'Little or no exercise, desk job' },
  light: { multiplier: 1.375, description: 'Light exercise 1-3 days/week' },
  moderate: { multiplier: 1.55, description: 'Moderate exercise 3-5 days/week' },
  active: { multiplier: 1.725, description: 'Hard exercise 6-7 days/week' },
  very_active: { multiplier: 1.9, description: 'Very hard exercise, physical job' },
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bmi-calculator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      calculate_bmi: { costCents: 1, displayName: 'Calculate BMI' },
      calculate_bmr: { costCents: 1, displayName: 'Calculate BMR' },
      calculate_tdee: { costCents: 1, displayName: 'Calculate TDEE' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const calculateBmi = sg.wrap(async (args: CalculateBmiInput) => {
  if (!Number.isFinite(args.weight_kg) || !Number.isFinite(args.height_cm)) {
    throw new Error('weight_kg and height_cm are required as numbers')
  }
  if (args.weight_kg < 10 || args.weight_kg > 500) {
    throw new Error('weight_kg must be between 10 and 500')
  }
  if (args.height_cm < 50 || args.height_cm > 300) {
    throw new Error('height_cm must be between 50 and 300')
  }

  const heightM = args.height_cm / 100
  const bmi = args.weight_kg / (heightM * heightM)
  const rounded = Math.round(bmi * 10) / 10
  const cat = BMI_CATEGORIES.find(c => bmi < c.max) ?? BMI_CATEGORIES[BMI_CATEGORIES.length - 1]

  const idealWeightLow = Math.round(18.5 * heightM * heightM * 10) / 10
  const idealWeightHigh = Math.round(24.9 * heightM * heightM * 10) / 10

  return {
    bmi: rounded,
    category: cat.label,
    health_risk: cat.risk,
    weight_kg: args.weight_kg,
    height_cm: args.height_cm,
    ideal_weight_range_kg: { min: idealWeightLow, max: idealWeightHigh },
    disclaimer: 'BMI is a screening tool, not a diagnostic measure. Consult a healthcare provider.',
  }
}, { method: 'calculate_bmi' })

const calculateBmr = sg.wrap(async (args: CalculateBmrInput) => {
  if (!Number.isFinite(args.weight_kg) || !Number.isFinite(args.height_cm) || !Number.isFinite(args.age)) {
    throw new Error('weight_kg, height_cm, and age must be numbers')
  }
  if (!args.sex) {
    throw new Error('sex is required ("male" or "female")')
  }

  const s = args.sex.toLowerCase()
  if (s !== 'male' && s !== 'female') {
    throw new Error('sex must be "male" or "female"')
  }
  if (args.age < 1 || args.age > 120) {
    throw new Error('age must be between 1 and 120')
  }

  const bmr = s === 'male'
    ? 88.362 + 13.397 * args.weight_kg + 4.799 * args.height_cm - 5.677 * args.age
    : 447.593 + 9.247 * args.weight_kg + 3.098 * args.height_cm - 4.330 * args.age

  return {
    bmr_kcal: Math.round(bmr),
    formula: 'Mifflin-St Jeor (revised Harris-Benedict)',
    sex: args.sex,
    weight_kg: args.weight_kg,
    height_cm: args.height_cm,
    age: args.age,
    note: 'BMR is the calories your body burns at complete rest',
  }
}, { method: 'calculate_bmr' })

const calculateTdee = sg.wrap(async (args: CalculateTdeeInput) => {
  if (!Number.isFinite(args.bmr) || args.bmr <= 0) {
    throw new Error('bmr must be a positive number')
  }
  if (!args.activity_level) {
    throw new Error('activity_level is required')
  }

  const key = args.activity_level.toLowerCase().replace(/ /g, '_')
  const activity = ACTIVITY_MULTIPLIERS[key]
  if (!activity) {
    throw new Error(`Unknown activity level. Available: ${Object.keys(ACTIVITY_MULTIPLIERS).join(', ')}`)
  }

  const tdee = args.bmr * activity.multiplier
  return {
    tdee_kcal: Math.round(tdee),
    bmr: args.bmr,
    activity_level: key,
    activity_description: activity.description,
    multiplier: activity.multiplier,
    macros_suggestion: {
      protein_g: Math.round(tdee * 0.3 / 4),
      carbs_g: Math.round(tdee * 0.4 / 4),
      fat_g: Math.round(tdee * 0.3 / 9),
    },
    available_levels: Object.keys(ACTIVITY_MULTIPLIERS),
  }
}, { method: 'calculate_tdee' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { calculateBmi, calculateBmr, calculateTdee }

console.log('settlegrid-bmi-calculator MCP server ready')
console.log('Methods: calculate_bmi, calculate_bmr, calculate_tdee')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
