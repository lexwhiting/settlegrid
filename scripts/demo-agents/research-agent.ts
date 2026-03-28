#!/usr/bin/env npx tsx
/**
 * SettleGrid Demo Agent 1: Research Agent
 *
 * Demonstrates an agent that receives a research question, discovers
 * relevant data tools on the SettleGrid marketplace, selects the best
 * one based on pricing and relevance, and simulates calling it.
 *
 * Run:
 *   npx tsx scripts/demo-agents/research-agent.ts
 *   npx tsx scripts/demo-agents/research-agent.ts "What is the GDP of France?"
 */

import {
  discoverTools,
  getToolDetails,
  formatPricing,
  costCents,
  budgetCheck,
  simulateCall,
  heading,
  step,
  result,
  separator,
  toolTable,
  log,
  type DiscoveredTool,
} from './lib.js'

// ─── Configuration ──────────────────────────────────────────────────────────────

const DEFAULT_QUESTION = "What's the weather in Tokyo?"
const BUDGET_CENTS = 50 // $0.50 budget per query

// Map question keywords to discovery search terms and categories
const TOPIC_MAP: Record<string, { query: string; category?: string }> = {
  weather: { query: 'weather', category: 'data' },
  gdp: { query: 'economics GDP', category: 'data' },
  population: { query: 'population demographics', category: 'data' },
  news: { query: 'news headlines', category: 'data' },
  stock: { query: 'stock market finance', category: 'finance' },
  currency: { query: 'currency exchange', category: 'finance' },
  translate: { query: 'translation language', category: 'nlp' },
}

// ─── Agent Logic ────────────────────────────────────────────────────────────────

function inferSearchParams(question: string): { query: string; category?: string } {
  const lower = question.toLowerCase()
  for (const [keyword, params] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(keyword)) return params
  }
  // Fallback: use the first few meaningful words as the search query
  const words = question
    .replace(/[?!.,]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3)
  return { query: words.join(' ') || 'data' }
}

function selectBestTool(
  tools: DiscoveredTool[],
  question: string,
): DiscoveredTool | null {
  if (tools.length === 0) return null

  // Prefer: within budget, then highest invocation count (proxy for quality)
  const affordable = budgetCheck(tools, BUDGET_CENTS)
  if (affordable.length === 0) {
    log('select', 'No tools within budget, selecting cheapest overall')
    return tools.sort((a, b) => costCents(a.pricing) - costCents(b.pricing))[0]
  }

  // Among affordable tools, pick the one with the most invocations
  return affordable.sort((a, b) => b.invocations - a.invocations)[0]
}

function simulateResearchResult(question: string): string {
  const lower = question.toLowerCase()
  if (lower.includes('weather')) return 'Weather in Tokyo: 15C, partly cloudy, humidity 62%'
  if (lower.includes('gdp')) return 'France GDP (2025): $3.05 trillion USD, growth rate 1.1%'
  if (lower.includes('population')) return 'World population (2025): 8.1 billion'
  if (lower.includes('stock')) return 'S&P 500: 5,842.31 (+0.43%)'
  return `Research result for: "${question}" [simulated data]`
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const question = process.argv[2] ?? DEFAULT_QUESTION

  heading('SettleGrid Research Agent')
  console.log(`Question: "${question}"`)
  console.log(`Budget:   $${(BUDGET_CENTS / 100).toFixed(2)}`)
  separator()

  // Step 1: Infer what to search for
  step(1, 'Analyzing question to determine relevant tool categories')
  const searchParams = inferSearchParams(question)
  result('Search query', searchParams.query)
  result('Category', searchParams.category ?? '(any)')
  separator()

  // Step 2: Discover tools
  step(2, 'Discovering tools on SettleGrid marketplace')
  const tools = await discoverTools(searchParams.query, searchParams.category, 10)
  toolTable(tools)
  separator()

  // Step 3: Select best tool
  step(3, 'Selecting best tool based on pricing and relevance')
  const selected = selectBestTool(tools, question)

  if (!selected) {
    console.log('  No tools found. In production, the agent would fall back to')
    console.log('  a broader search or use a built-in capability.')
    separator()

    // Show what would happen with a hypothetical tool
    step(4, '[Fallback] Simulating with a hypothetical tool')
    const hypothetical: DiscoveredTool = {
      name: 'General Data API',
      slug: 'general-data-api',
      description: 'Hypothetical general-purpose data tool',
      category: 'data',
      tags: [],
      version: '1.0.0',
      pricing: { defaultCostCents: 5 },
      invocations: 0,
      developer: 'SettleGrid',
      developerSlug: 'settlegrid',
      url: 'https://settlegrid.ai/tools/general-data-api',
      developerUrl: null,
    }
    result('Tool', `${hypothetical.name} (${hypothetical.slug})`)
    result('Price', formatPricing(hypothetical.pricing))
    const simResult = simulateCall(hypothetical, { question })
    separator()
    step(5, 'Formatting results')
    result('Answer', simulateResearchResult(question))
    result('Cost', `$${((simResult.costCents as number) / 100).toFixed(2)}`)
    result('Remaining budget', `$${((BUDGET_CENTS - (simResult.costCents as number)) / 100).toFixed(2)}`)
  } else {
    result('Selected', `${selected.name} (${selected.slug})`)
    result('Price', formatPricing(selected.pricing))
    result('Developer', selected.developer)
    result('Invocations', selected.invocations.toLocaleString())
    separator()

    // Step 4: Get full tool details
    step(4, 'Fetching full tool details')
    const details = await getToolDetails(selected.slug)
    if (details) {
      result('Version', details.currentVersion)
      result('Rating', details.averageRating > 0 ? `${details.averageRating}/5 (${details.reviewCount} reviews)` : 'No reviews yet')
    } else {
      result('Details', '(could not fetch — tool detail endpoint may be unavailable)')
    }
    separator()

    // Step 5: Simulate the call
    step(5, 'Calling tool (simulated)')
    const simResult = simulateCall(selected, { question, format: 'json' })
    separator()

    // Step 6: Return results
    step(6, 'Formatting results')
    result('Answer', simulateResearchResult(question))
    result('Cost', `$${((simResult.costCents as number) / 100).toFixed(2)}`)
    result('Remaining budget', `$${((BUDGET_CENTS - (simResult.costCents as number)) / 100).toFixed(2)}`)
  }

  separator()
  heading('Workflow Complete')
  console.log('This demo proved the end-to-end SettleGrid agent workflow:')
  console.log('  1. Agent received a task (research question)')
  console.log('  2. Agent discovered tools via the SettleGrid Discovery API')
  console.log('  3. Agent evaluated pricing against its budget')
  console.log('  4. Agent selected the best tool and fetched details')
  console.log('  5. Agent called the tool (simulated) with x402 payment')
  console.log('  6. Agent returned formatted results to the user')
  console.log()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
