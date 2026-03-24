import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "nutrition-calculator", pricing: { defaultCostCents: 1, methods: {
  get_food_nutrition: { costCents: 1, displayName: "Get Food Nutrition" },
  calculate_meal: { costCents: 1, displayName: "Calculate Meal" },
}}})
const foods: Record<string, { serving: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number }> = {
  chicken_breast: { serving: "100g", calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0 },
  brown_rice: { serving: "100g cooked", calories: 123, protein_g: 2.7, carbs_g: 26, fat_g: 1, fiber_g: 1.8 },
  broccoli: { serving: "100g", calories: 34, protein_g: 2.8, carbs_g: 7, fat_g: 0.4, fiber_g: 2.6 },
  egg: { serving: "1 large (50g)", calories: 72, protein_g: 6.3, carbs_g: 0.4, fat_g: 5, fiber_g: 0 },
  salmon: { serving: "100g", calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13, fiber_g: 0 },
  banana: { serving: "1 medium (118g)", calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1 },
  avocado: { serving: "100g", calories: 160, protein_g: 2, carbs_g: 9, fat_g: 15, fiber_g: 7 },
  oats: { serving: "100g dry", calories: 389, protein_g: 17, carbs_g: 66, fat_g: 7, fiber_g: 11 },
  greek_yogurt: { serving: "100g", calories: 59, protein_g: 10, carbs_g: 3.6, fat_g: 0.7, fiber_g: 0 },
  sweet_potato: { serving: "100g", calories: 86, protein_g: 1.6, carbs_g: 20, fat_g: 0.1, fiber_g: 3 },
}
const getFoodNutrition = sg.wrap(async (args: { food: string }) => {
  if (!args.food) throw new Error("food is required")
  const f = foods[args.food.toLowerCase().replace(/ /g, "_")]
  if (!f) throw new Error(`Unknown. Available: ${Object.keys(foods).join(", ")}`)
  return { food: args.food, ...f }
}, { method: "get_food_nutrition" })
const calculateMeal = sg.wrap(async (args: { items: string[] }) => {
  if (!args.items || args.items.length === 0) throw new Error("items array is required")
  let total = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  const details = args.items.map(item => {
    const f = foods[item.toLowerCase().replace(/ /g, "_")]
    if (!f) throw new Error(`Unknown food: ${item}`)
    total.calories += f.calories; total.protein_g += f.protein_g; total.carbs_g += f.carbs_g; total.fat_g += f.fat_g; total.fiber_g += f.fiber_g
    return { food: item, ...f }
  })
  return { items: details, total, macro_split: { protein_pct: Math.round(total.protein_g * 4 / (total.calories || 1) * 100), carbs_pct: Math.round(total.carbs_g * 4 / (total.calories || 1) * 100), fat_pct: Math.round(total.fat_g * 9 / (total.calories || 1) * 100) } }
}, { method: "calculate_meal" })
export { getFoodNutrition, calculateMeal }
console.log("settlegrid-nutrition-calculator MCP server ready | 1c/call | Powered by SettleGrid")
