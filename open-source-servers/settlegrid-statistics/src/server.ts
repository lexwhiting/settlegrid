/**
 * settlegrid-statistics — Statistical Calculations MCP Server
 *
 * Provides statistical calculations with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   descriptive(data)                     (1¢)
 *   percentile(data, p)                   (1¢)
 *   correlation(x, y)                     (1¢)
 *   regression(x, y)                      (2¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface DataInput { data: number[] }
interface PercentileInput { data: number[]; p: number }
interface TwoVarInput { x: number[]; y: number[] }

function mean(arr: number[]): number { return arr.reduce((s, v) => s + v, 0) / arr.length }
function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
function stddev(arr: number[]): number {
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}
function mode(arr: number[]): number[] {
  const freq: Record<number, number> = {}
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1
  const maxFreq = Math.max(...Object.values(freq))
  return Object.entries(freq).filter(([, f]) => f === maxFreq).map(([v]) => Number(v))
}

const sg = settlegrid.init({
  toolSlug: "statistics",
  pricing: {
    defaultCostCents: 1,
    methods: {
      descriptive: { costCents: 1, displayName: "Get descriptive statistics" },
      percentile: { costCents: 1, displayName: "Calculate percentile" },
      correlation: { costCents: 1, displayName: "Pearson correlation coefficient" },
      regression: { costCents: 2, displayName: "Linear regression" },
    },
  },
})

const descriptive = sg.wrap(async (args: DataInput) => {
  if (!Array.isArray(args.data) || args.data.length === 0) throw new Error("data array is required")
  if (args.data.length > 10000) throw new Error("Maximum 10,000 values")
  const sorted = [...args.data].sort((a, b) => a - b)
  const m = mean(args.data)
  const sd = stddev(args.data)
  return {
    count: args.data.length, mean: Math.round(m * 10000) / 10000,
    median: median(args.data), mode: mode(args.data),
    min: sorted[0], max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
    std_dev: Math.round(sd * 10000) / 10000,
    variance: Math.round(sd * sd * 10000) / 10000,
    sum: args.data.reduce((s, v) => s + v, 0),
  }
}, { method: "descriptive" })

const percentile = sg.wrap(async (args: PercentileInput) => {
  if (!Array.isArray(args.data) || args.data.length === 0) throw new Error("data array is required")
  if (args.p === undefined || args.p < 0 || args.p > 100) throw new Error("p must be 0-100")
  const sorted = [...args.data].sort((a, b) => a - b)
  const idx = (args.p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  const value = lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
  return { percentile: args.p, value: Math.round(value * 10000) / 10000, count: sorted.length }
}, { method: "percentile" })

const correlation = sg.wrap(async (args: TwoVarInput) => {
  if (!Array.isArray(args.x) || !Array.isArray(args.y)) throw new Error("x and y arrays are required")
  if (args.x.length !== args.y.length) throw new Error("x and y must have equal length")
  if (args.x.length < 2) throw new Error("Need at least 2 data points")
  const mx = mean(args.x), my = mean(args.y)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < args.x.length; i++) {
    const xi = args.x[i] - mx, yi = args.y[i] - my
    num += xi * yi; dx += xi * xi; dy += yi * yi
  }
  const r = num / Math.sqrt(dx * dy)
  return { r: Math.round(r * 10000) / 10000, r_squared: Math.round(r * r * 10000) / 10000, n: args.x.length, strength: Math.abs(r) > 0.7 ? "strong" : Math.abs(r) > 0.3 ? "moderate" : "weak" }
}, { method: "correlation" })

const regression = sg.wrap(async (args: TwoVarInput) => {
  if (!Array.isArray(args.x) || !Array.isArray(args.y)) throw new Error("x and y arrays are required")
  if (args.x.length !== args.y.length) throw new Error("x and y must have equal length")
  if (args.x.length < 2) throw new Error("Need at least 2 data points")
  const n = args.x.length
  const mx = mean(args.x), my = mean(args.y)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (args.x[i] - mx) * (args.y[i] - my); den += (args.x[i] - mx) ** 2 }
  const slope = num / den
  const intercept = my - slope * mx
  return { slope: Math.round(slope * 10000) / 10000, intercept: Math.round(intercept * 10000) / 10000, equation: `y = ${Math.round(slope * 10000) / 10000}x + ${Math.round(intercept * 10000) / 10000}`, n }
}, { method: "regression" })

export { descriptive, percentile, correlation, regression }

console.log("settlegrid-statistics MCP server ready")
console.log("Methods: descriptive, percentile, correlation, regression")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
