/**
 * settlegrid-fibonacci — Fibonacci Sequence MCP Server
 *
 * Provides Fibonacci calculations with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_nth(n)                            (1¢)
 *   generate(count)                       (1¢)
 *   is_fibonacci(number)                  (1¢)
 *   golden_ratio(n)                       (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface NthInput { n: number }
interface GenInput { count?: number; start_index?: number }
interface CheckInput { number: number }
interface GoldenInput { n?: number }

function fib(n: number): number {
  if (n <= 0) return 0
  if (n === 1) return 1
  let a = 0, b = 1
  for (let i = 2; i <= n; i++) { const c = a + b; a = b; b = c }
  return b
}

function isFib(num: number): boolean {
  if (num < 0) return false
  const isPerfectSquare = (n: number) => { const s = Math.sqrt(n); return s === Math.floor(s) }
  return isPerfectSquare(5 * num * num + 4) || isPerfectSquare(5 * num * num - 4)
}

const sg = settlegrid.init({
  toolSlug: "fibonacci",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_nth: { costCents: 1, displayName: "Get nth Fibonacci number" },
      generate: { costCents: 1, displayName: "Generate Fibonacci sequence" },
      is_fibonacci: { costCents: 1, displayName: "Check if number is Fibonacci" },
      golden_ratio: { costCents: 1, displayName: "Approximate golden ratio" },
    },
  },
})

const getNth = sg.wrap(async (args: NthInput) => {
  if (args.n === undefined || typeof args.n !== "number") throw new Error("n is required")
  if (args.n < 0 || args.n > 78) throw new Error("n must be between 0 and 78 (safe integer range)")
  const value = fib(args.n)
  return { n: args.n, fibonacci: value, previous: args.n > 0 ? fib(args.n - 1) : null, next: fib(args.n + 1) }
}, { method: "get_nth" })

const generate = sg.wrap(async (args: GenInput) => {
  const count = args.count ?? 20
  if (count > 79) throw new Error("Maximum 79 Fibonacci numbers (safe integer range)")
  const start = args.start_index ?? 0
  const sequence = []
  for (let i = start; i < start + count; i++) {
    sequence.push({ index: i, value: fib(i) })
  }
  return { count: sequence.length, start_index: start, sequence }
}, { method: "generate" })

const isFibonacci = sg.wrap(async (args: CheckInput) => {
  if (args.number === undefined || typeof args.number !== "number") throw new Error("number is required")
  const result = isFib(args.number)
  let index: number | null = null
  if (result) {
    for (let i = 0; i <= 78; i++) { if (fib(i) === args.number) { index = i; break } }
  }
  return { number: args.number, is_fibonacci: result, ...(index !== null ? { index } : {}) }
}, { method: "is_fibonacci" })

const goldenRatio = sg.wrap(async (args: GoldenInput) => {
  const n = args.n ?? 50
  if (n < 2 || n > 78) throw new Error("n must be between 2 and 78")
  const a = fib(n)
  const b = fib(n - 1)
  const ratio = a / b
  const phi = (1 + Math.sqrt(5)) / 2
  return { n, fib_n: a, fib_n_minus_1: b, ratio, golden_ratio: phi, error: Math.abs(ratio - phi) }
}, { method: "golden_ratio" })

export { getNth, generate, isFibonacci, goldenRatio }

console.log("settlegrid-fibonacci MCP server ready")
console.log("Methods: get_nth, generate, is_fibonacci, golden_ratio")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
