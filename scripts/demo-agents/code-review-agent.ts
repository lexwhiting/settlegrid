#!/usr/bin/env npx tsx
/**
 * SettleGrid Demo Agent 2: Code Review Agent
 *
 * Demonstrates an agent that takes a code snippet, discovers code
 * analysis tools on SettleGrid, checks pricing against a budget,
 * selects multiple complementary tools, and simulates running them
 * to produce an aggregated review.
 *
 * Run:
 *   npx tsx scripts/demo-agents/code-review-agent.ts
 */

import {
  discoverTools,
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

const BUDGET_CENTS = 50 // $0.50 total budget for the review

const SAMPLE_CODE = `
function fetchUserData(userId) {
  const response = fetch('/api/users/' + userId)
  const data = response.json()
  if (data.error) {
    console.log('Error: ' + data.error)
    return null
  }
  return { name: data.name, email: data.email, password: data.password }
}

const processItems = (items) => {
  for (let i = 0; i < items.length; i++) {
    eval(items[i].action)
    items[i].processed = true
  }
  return items
}
`.trim()

// The analysis categories we want to search for
const ANALYSIS_CATEGORIES = [
  { query: 'code linting', category: 'code', label: 'Linting' },
  { query: 'security vulnerability', category: 'code', label: 'Security Analysis' },
  { query: 'code quality', category: 'code', label: 'Quality Metrics' },
]

// Simulated findings for each analysis type
const SIMULATED_FINDINGS: Record<string, string[]> = {
  'Linting': [
    'Line 2: Missing `await` on fetch() call (async function not declared)',
    'Line 3: Missing `await` on response.json()',
    'Line 5: console.log used — prefer structured logging',
    'Line 11: Arrow function `processItems` should use explicit return type',
  ],
  'Security Analysis': [
    'CRITICAL: Line 13: eval() usage — arbitrary code execution vulnerability',
    'HIGH: Line 8: Returning password field — sensitive data exposure',
    'MEDIUM: Line 2: String concatenation in URL — potential injection vector',
    'INFO: No input validation on userId parameter',
  ],
  'Quality Metrics': [
    'Complexity score: 4/10 (low)',
    'Maintainability index: 62/100 (moderate)',
    'No TypeScript types — type safety score: 0/10',
    'No error handling beyond null return — resilience score: 2/10',
  ],
}

// ─── Agent Logic ────────────────────────────────────────────────────────────────

interface ToolSelection {
  label: string
  tool: DiscoveredTool
}

/**
 * Select tools within budget, spreading across analysis categories.
 * Allocates budget proportionally across categories.
 */
function selectToolsWithinBudget(
  categoryResults: { label: string; tools: DiscoveredTool[] }[],
  totalBudgetCents: number,
): ToolSelection[] {
  const selected: ToolSelection[] = []
  let remainingBudget = totalBudgetCents

  for (const { label, tools } of categoryResults) {
    // Find cheapest tool in this category that fits remaining budget
    const affordable = budgetCheck(tools, remainingBudget)
    if (affordable.length > 0) {
      // Pick the one with most invocations (most battle-tested)
      const best = affordable.sort((a, b) => b.invocations - a.invocations)[0]
      selected.push({ label, tool: best })
      remainingBudget -= costCents(best.pricing)
      log('budget', `Allocated ${formatPricing(best.pricing)} for ${label} — $${(remainingBudget / 100).toFixed(2)} remaining`)
    } else if (tools.length > 0) {
      log('budget', `Skipping ${label} — cheapest tool ($${(costCents(tools[0].pricing) / 100).toFixed(2)}) exceeds remaining budget ($${(remainingBudget / 100).toFixed(2)})`)
    }
  }

  return selected
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  heading('SettleGrid Code Review Agent')
  console.log(`Budget: $${(BUDGET_CENTS / 100).toFixed(2)}`)
  separator()

  // Step 1: Show the code under review
  step(1, 'Code to review:')
  console.log()
  for (const line of SAMPLE_CODE.split('\n')) {
    console.log(`    ${line}`)
  }
  console.log()
  separator()

  // Step 2: Discover tools across analysis categories
  step(2, 'Discovering code analysis tools on SettleGrid')
  const categoryResults: { label: string; tools: DiscoveredTool[] }[] = []

  for (const { query, category, label } of ANALYSIS_CATEGORIES) {
    console.log()
    result('Category', label)
    const tools = await discoverTools(query, category, 5)
    toolTable(tools)
    categoryResults.push({ label, tools })
  }
  separator()

  // Step 3: Select tools within budget
  step(3, `Selecting tools within $${(BUDGET_CENTS / 100).toFixed(2)} budget`)
  const selections = selectToolsWithinBudget(categoryResults, BUDGET_CENTS)

  if (selections.length === 0) {
    console.log()
    console.log('  No tools discovered (marketplace may be empty or API unreachable).')
    console.log('  Demonstrating the workflow with hypothetical tools instead.')
    console.log()

    // Create hypothetical tools to show the full flow
    const hypotheticalTools: ToolSelection[] = ANALYSIS_CATEGORIES.map(({ label }, i) => ({
      label,
      tool: {
        name: `${label} Tool`,
        slug: `${label.toLowerCase().replace(/\s+/g, '-')}-tool`,
        description: `Hypothetical ${label.toLowerCase()} tool`,
        category: 'code',
        tags: [],
        version: '1.0.0',
        pricing: { defaultCostCents: 10 + i * 5 },
        invocations: 1000 - i * 200,
        developer: 'SettleGrid',
        developerSlug: 'settlegrid',
        url: `https://settlegrid.ai/tools/${label.toLowerCase().replace(/\s+/g, '-')}`,
        developerUrl: null,
      },
    }))

    runReviewWithTools(hypotheticalTools)
    return
  }

  console.log()
  result('Tools selected', `${selections.length}/${ANALYSIS_CATEGORIES.length} categories covered`)
  let totalCost = 0
  for (const { label, tool } of selections) {
    const cost = costCents(tool.pricing)
    totalCost += cost
    result(label, `${tool.name} — ${formatPricing(tool.pricing)}`)
  }
  result('Total cost', `$${(totalCost / 100).toFixed(2)} of $${(BUDGET_CENTS / 100).toFixed(2)} budget`)
  separator()

  runReviewWithTools(selections)
}

function runReviewWithTools(selections: ToolSelection[]) {
  // Step 4: Call each tool (simulated)
  step(4, 'Running analysis tools (simulated)')
  const results: { label: string; findings: string[] }[] = []

  for (const { label, tool } of selections) {
    console.log()
    simulateCall(tool, { code: SAMPLE_CODE, language: 'javascript' })
    const findings = SIMULATED_FINDINGS[label] ?? ['No findings (simulated)']
    results.push({ label, findings })
  }
  separator()

  // Step 5: Aggregate and present results
  step(5, 'Aggregating review results')
  console.log()

  let totalFindings = 0
  let criticalCount = 0

  for (const { label, findings } of results) {
    console.log(`  --- ${label} ---`)
    for (const finding of findings) {
      console.log(`    ${finding}`)
      totalFindings++
      if (finding.startsWith('CRITICAL')) criticalCount++
    }
    console.log()
  }

  separator()

  // Step 6: Summary
  step(6, 'Review summary')
  result('Total findings', String(totalFindings))
  result('Critical issues', String(criticalCount))
  result('Tools used', String(selections.length))
  result('Total cost', `$${(selections.reduce((sum, s) => sum + costCents(s.tool.pricing), 0) / 100).toFixed(2)}`)

  if (criticalCount > 0) {
    console.log()
    console.log('  RECOMMENDATION: This code has critical security issues.')
    console.log('  The eval() usage and password exposure must be fixed before merge.')
  }

  separator()
  heading('Workflow Complete')
  console.log('This demo proved the multi-tool SettleGrid agent workflow:')
  console.log('  1. Agent received a code review task')
  console.log('  2. Agent discovered tools across multiple analysis categories')
  console.log('  3. Agent checked pricing and allocated budget across tools')
  console.log('  4. Agent called each tool (simulated) and collected findings')
  console.log('  5. Agent aggregated results into a unified review')
  console.log()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
