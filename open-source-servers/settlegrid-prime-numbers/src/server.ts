/**
 * settlegrid-prime-numbers — Prime Number MCP Server
 *
 * Provides prime number operations with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   is_prime(number)                      (1¢)
 *   next_prime(after)                     (1¢)
 *   factorize(number)                     (1¢)
 *   generate(count)                       (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface NumInput { number: number }
interface NextInput { after: number }
interface GenInput { count?: number; start?: number }

function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n < 4) return true
  if (n % 2 === 0 || n % 3 === 0) return false
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false
  }
  return true
}

function primeFactors(n: number): number[] {
  const factors: number[] = []
  let d = 2
  while (d * d <= n) {
    while (n % d === 0) { factors.push(d); n /= d }
    d++
  }
  if (n > 1) factors.push(n)
  return factors
}

const sg = settlegrid.init({
  toolSlug: "prime-numbers",
  pricing: {
    defaultCostCents: 1,
    methods: {
      is_prime: { costCents: 1, displayName: "Check if number is prime" },
      next_prime: { costCents: 1, displayName: "Get next prime after number" },
      factorize: { costCents: 1, displayName: "Prime factorization" },
      generate: { costCents: 1, displayName: "Generate N prime numbers" },
    },
  },
})

const isPrimeCheck = sg.wrap(async (args: NumInput) => {
  if (args.number === undefined || typeof args.number !== "number") throw new Error("number is required")
  if (args.number > 1e12) throw new Error("Number too large (max 10^12)")
  const prime = isPrime(args.number)
  return { number: args.number, is_prime: prime, ...(prime ? {} : { smallest_factor: primeFactors(args.number)[0] }) }
}, { method: "is_prime" })

const nextPrime = sg.wrap(async (args: NextInput) => {
  if (args.after === undefined || typeof args.after !== "number") throw new Error("after is required")
  if (args.after > 1e12) throw new Error("Number too large")
  let n = Math.floor(args.after) + 1
  if (n < 2) n = 2
  while (!isPrime(n)) n++
  return { after: args.after, next_prime: n, gap: n - args.after }
}, { method: "next_prime" })

const factorize = sg.wrap(async (args: NumInput) => {
  if (args.number === undefined || typeof args.number !== "number") throw new Error("number is required")
  if (args.number < 2 || args.number > 1e12) throw new Error("Number must be between 2 and 10^12")
  const factors = primeFactors(args.number)
  const unique = [...new Set(factors)]
  return { number: args.number, factors, unique_factors: unique, is_prime: factors.length === 1 }
}, { method: "factorize" })

const generate = sg.wrap(async (args: GenInput) => {
  const count = args.count ?? 20
  if (count > 1000) throw new Error("Maximum 1000 primes")
  const start = args.start ?? 2
  const primes: number[] = []
  let n = start
  while (primes.length < count) {
    if (isPrime(n)) primes.push(n)
    n++
  }
  return { count: primes.length, start, primes }
}, { method: "generate" })

export { isPrimeCheck, nextPrime, factorize, generate }

console.log("settlegrid-prime-numbers MCP server ready")
console.log("Methods: is_prime, next_prime, factorize, generate")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
