import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "bmi-calculator", pricing: { defaultCostCents: 1, methods: {
  calculate_bmi: { costCents: 1, displayName: "Calculate BMI" },
  calculate_bmr: { costCents: 1, displayName: "Calculate BMR" },
  calculate_tdee: { costCents: 1, displayName: "Calculate TDEE" },
}}})
const calculateBmi = sg.wrap(async (args: { weight_kg: number; height_cm: number }) => {
  if (!args.weight_kg || !args.height_cm) throw new Error("weight_kg and height_cm required")
  if (args.weight_kg < 10 || args.weight_kg > 500) throw new Error("weight_kg must be 10-500")
  if (args.height_cm < 50 || args.height_cm > 300) throw new Error("height_cm must be 50-300")
  const heightM = args.height_cm / 100
  const bmi = args.weight_kg / (heightM * heightM)
  const category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : bmi < 35 ? "Obese Class I" : bmi < 40 ? "Obese Class II" : "Obese Class III"
  return { bmi: Math.round(bmi * 10) / 10, category, weight_kg: args.weight_kg, height_cm: args.height_cm }
}, { method: "calculate_bmi" })
const calculateBmr = sg.wrap(async (args: { weight_kg: number; height_cm: number; age: number; sex: string }) => {
  if (!args.weight_kg || !args.height_cm || !args.age || !args.sex) throw new Error("weight_kg, height_cm, age, sex required")
  const s = args.sex.toLowerCase()
  const bmr = s === "male" ? 88.362 + 13.397 * args.weight_kg + 4.799 * args.height_cm - 5.677 * args.age : 447.593 + 9.247 * args.weight_kg + 3.098 * args.height_cm - 4.330 * args.age
  return { bmr_kcal: Math.round(bmr), formula: "Mifflin-St Jeor", sex: args.sex }
}, { method: "calculate_bmr" })
const calculateTdee = sg.wrap(async (args: { bmr: number; activity_level: string }) => {
  if (!args.bmr || !args.activity_level) throw new Error("bmr and activity_level required")
  const multipliers: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
  const m = multipliers[args.activity_level.toLowerCase()]
  if (!m) throw new Error(`Unknown activity. Available: ${Object.keys(multipliers).join(", ")}`)
  return { tdee_kcal: Math.round(args.bmr * m), bmr: args.bmr, activity_level: args.activity_level, multiplier: m }
}, { method: "calculate_tdee" })
export { calculateBmi, calculateBmr, calculateTdee }
console.log("settlegrid-bmi-calculator MCP server ready | 1c/call | Powered by SettleGrid")
