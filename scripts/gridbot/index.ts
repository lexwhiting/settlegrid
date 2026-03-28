#!/usr/bin/env npx tsx
/**
 * GridBot — SettleGrid Demand Generator
 *
 * A production bot that discovers tools on the SettleGrid marketplace,
 * pays for them with founder-funded credits, and answers real questions.
 * Unlike the demo agents, GridBot makes REAL paid invocations via the
 * Smart Proxy, generating actual marketplace activity.
 *
 * Usage:
 *   npx tsx scripts/gridbot/index.ts "What's the weather in Tokyo?"
 *   npx tsx scripts/gridbot/index.ts --help
 *   echo "Convert 100 USD to EUR" | npx tsx scripts/gridbot/index.ts
 *
 * Environment:
 *   SETTLEGRID_API_KEY  — Required. Your SettleGrid API key.
 *   SETTLEGRID_URL      — Optional. Default: https://settlegrid.ai
 *   GRIDBOT_BUDGET      — Optional. Daily budget in cents. Default: 100 ($1.00)
 */

import {
  categorizeQuestion,
  discoverTools,
  callToolViaProxy,
  selectBestTool,
  trackSpending,
  getSpendingStats,
  logTransaction,
  getApiKey,
  getBaseUrl,
  heading,
  step,
  result,
  separator,
  log,
  formatCents,
  formatPricing,
  toolSummary,
  type DiscoveredTool,
  type TransactionLog,
} from './lib.js'

// ─── Configuration ───────────────────────────────────────────────────────────

const DAILY_BUDGET_CENTS = parseInt(process.env.GRIDBOT_BUDGET ?? '100', 10)

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
} as const

// ─── Help ────────────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
${C.bold}GridBot${C.reset} — SettleGrid Demand Generator

${C.yellow}Usage:${C.reset}
  npx tsx scripts/gridbot/index.ts <question>
  npx tsx scripts/gridbot/index.ts "What's the weather in Tokyo?"
  echo "Convert 100 USD to EUR" | npx tsx scripts/gridbot/index.ts

${C.yellow}Options:${C.reset}
  --help, -h        Show this help message
  --status          Show daily spending stats
  --dry-run         Discover & select tools without invoking

${C.yellow}Environment:${C.reset}
  SETTLEGRID_API_KEY   Required. Your SettleGrid API key.
  SETTLEGRID_URL       API base URL (default: https://settlegrid.ai)
  GRIDBOT_BUDGET       Daily budget in cents (default: 100 = $1.00)

${C.yellow}Examples:${C.reset}
  # Answer a question using marketplace tools
  SETTLEGRID_API_KEY=sg_xxx npx tsx scripts/gridbot/index.ts "What's the weather in NYC?"

  # Check today's spending
  npx tsx scripts/gridbot/index.ts --status

  # Dry run (no real invocations)
  npx tsx scripts/gridbot/index.ts --dry-run "Analyze this code for bugs"
`)
}

function showStatus(): void {
  const stats = getSpendingStats(DAILY_BUDGET_CENTS)
  heading('GridBot Daily Status')
  result('Date', stats.date)
  result('Spent', formatCents(stats.spentCents))
  result('Remaining', formatCents(stats.remainingCents))
  result('Invocations', String(stats.invocations))
  result('Daily limit', formatCents(DAILY_BUDGET_CENTS))
  separator()
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

async function runGridBot(question: string, dryRun: boolean): Promise<void> {
  const apiKey = dryRun ? '' : getApiKey()
  const baseUrl = getBaseUrl()

  heading('GridBot')
  console.log(`  ${C.bold}Question:${C.reset}  ${question}`)
  console.log(`  ${C.bold}Target:${C.reset}    ${baseUrl}`)
  console.log(`  ${C.bold}Budget:${C.reset}    ${formatCents(DAILY_BUDGET_CENTS)}/day`)
  if (dryRun) {
    console.log(`  ${C.yellow}${C.bold}Mode:${C.reset}      ${C.yellow}DRY RUN (no real invocations)${C.reset}`)
  }

  const stats = getSpendingStats(DAILY_BUDGET_CENTS)
  console.log(`  ${C.bold}Spent today:${C.reset} ${formatCents(stats.spentCents)} (${stats.invocations} calls)`)
  separator()

  // ── Step 1: Categorize the question ──────────────────────────────────────
  step(1, 'Analyzing question')
  const { category, searchQuery } = categorizeQuestion(question)
  result('Category', category ?? '(broad search)')
  result('Search query', searchQuery)
  separator()

  // ── Step 2: Discover tools ───────────────────────────────────────────────
  step(2, 'Discovering tools on SettleGrid marketplace')
  let tools = await discoverTools(searchQuery, category ?? undefined, 10)

  // If no tools found with category, try broader search
  if (tools.length === 0 && category) {
    log('discover', 'No tools found in category, trying broader search...')
    tools = await discoverTools(searchQuery, undefined, 10)
  }

  // If still no tools, try with just the category
  if (tools.length === 0 && category) {
    log('discover', 'Still no results, searching by category only...')
    tools = await discoverTools('', category, 10)
  }

  if (tools.length === 0) {
    console.log()
    log('discover', 'No tools found on the marketplace for this query.', 'warn')
    separator()

    const tx: TransactionLog = {
      timestamp: new Date().toISOString(),
      question,
      category,
      toolSlug: null,
      toolName: null,
      costCents: 0,
      latencyMs: 0,
      status: 'no_tools',
    }
    logTransaction(tx)

    console.log(`${C.dim}GridBot found no matching tools. The marketplace may not have`)
    console.log(`tools in this category yet, or the search terms may need adjustment.${C.reset}`)
    return
  }

  console.log()
  log('discover', `${tools.length} tool(s) found:`)
  for (const tool of tools.slice(0, 5)) {
    toolSummary(tool)
  }
  if (tools.length > 5) {
    console.log(`    ${C.dim}...and ${tools.length - 5} more${C.reset}`)
  }
  separator()

  // ── Step 3: Select best tool ─────────────────────────────────────────────
  step(3, 'Selecting best tool')
  const remainingBudget = stats.remainingCents
  const selected = selectBestTool(tools, remainingBudget)

  if (!selected) {
    log('select', 'No affordable tools within remaining daily budget.', 'warn')
    separator()

    const tx: TransactionLog = {
      timestamp: new Date().toISOString(),
      question,
      category,
      toolSlug: null,
      toolName: null,
      costCents: 0,
      latencyMs: 0,
      status: 'budget_exceeded',
    }
    logTransaction(tx)

    console.log(`${C.dim}Daily budget has been reached. GridBot will resume tomorrow.${C.reset}`)
    return
  }

  const selectedCost = selected.costCents ?? selected.pricing?.defaultCostCents ?? 0
  result('Tool', `${selected.name} (${selected.slug})`)
  result('Price', formatPricing(selected.pricing, selected.costCents))
  result('Developer', selected.developer)
  result('Invocations', selected.invocations.toLocaleString())
  if (selected.verified) {
    result('Verified', `${C.green}Yes${C.reset}`)
  }
  separator()

  // ── Step 4: Budget check ─────────────────────────────────────────────────
  step(4, 'Checking budget')
  const budgetAfter = trackSpending(selectedCost, DAILY_BUDGET_CENTS)

  if (budgetAfter < 0) {
    log('budget', 'This call would exceed the daily budget. Skipping.', 'warn')
    separator()

    const tx: TransactionLog = {
      timestamp: new Date().toISOString(),
      question,
      category,
      toolSlug: selected.slug,
      toolName: selected.name,
      costCents: 0,
      latencyMs: 0,
      status: 'budget_exceeded',
    }
    logTransaction(tx)
    return
  }

  result('Cost', formatCents(selectedCost))
  result('Remaining today', formatCents(budgetAfter))
  separator()

  // ── Step 5: Invoke the tool ──────────────────────────────────────────────
  if (dryRun) {
    step(5, `${C.yellow}DRY RUN — would invoke ${selected.name}${C.reset}`)
    console.log()
    result('Endpoint', `POST /api/proxy/${selected.slug}`)
    result('Payload', JSON.stringify({ question, format: 'json' }))
    result('Cost', formatCents(selectedCost))
    separator()

    const tx: TransactionLog = {
      timestamp: new Date().toISOString(),
      question,
      category,
      toolSlug: selected.slug,
      toolName: selected.name,
      costCents: 0,
      latencyMs: 0,
      status: 'skipped',
    }
    logTransaction(tx)

    heading('Dry Run Complete')
    console.log('  Tool discovered and selected. No real invocation was made.')
    console.log('  Remove --dry-run to make a real paid call.')
    return
  }

  step(5, `Invoking ${selected.name} via Smart Proxy`)
  const proxyResult = await callToolViaProxy(
    selected.slug,
    { question, format: 'json' },
    apiKey,
  )
  separator()

  // ── Step 6: Handle result ────────────────────────────────────────────────
  step(6, 'Result')
  console.log()

  const tx: TransactionLog = {
    timestamp: new Date().toISOString(),
    question,
    category,
    toolSlug: selected.slug,
    toolName: selected.name,
    costCents: proxyResult.costCents,
    latencyMs: proxyResult.latencyMs,
    status: proxyResult.ok ? 'success' : 'error',
    error: proxyResult.error,
    response: proxyResult.ok ? proxyResult.data : undefined,
  }

  if (proxyResult.ok) {
    result('Status', `${C.green}Success${C.reset}`)
    result('Latency', `${proxyResult.latencyMs}ms`)
    result('Cost charged', formatCents(proxyResult.costCents))
    console.log()

    // Pretty-print the response
    if (proxyResult.data !== null && proxyResult.data !== undefined) {
      const formatted = typeof proxyResult.data === 'string'
        ? proxyResult.data
        : JSON.stringify(proxyResult.data, null, 2)
      console.log(`  ${C.bold}Response:${C.reset}`)
      for (const line of formatted.split('\n').slice(0, 30)) {
        console.log(`    ${line}`)
      }
      if (formatted.split('\n').length > 30) {
        console.log(`    ${C.dim}... (truncated)${C.reset}`)
      }
    }
  } else {
    result('Status', `${C.red}Error${C.reset}`)
    result('Latency', `${proxyResult.latencyMs}ms`)
    result('Error', proxyResult.error ?? 'Unknown error')

    if (proxyResult.status === 402) {
      console.log()
      console.log(`  ${C.yellow}Insufficient credits. Fund your account at ${getBaseUrl()}/dashboard${C.reset}`)
    } else if (proxyResult.status === 401) {
      console.log()
      console.log(`  ${C.yellow}Check your SETTLEGRID_API_KEY — it may be invalid or expired.${C.reset}`)
    }
  }

  logTransaction(tx)

  separator()
  heading('GridBot Complete')

  const updatedStats = getSpendingStats(DAILY_BUDGET_CENTS)
  console.log(`  Today: ${updatedStats.invocations} invocations, ${formatCents(updatedStats.spentCents)} spent, ${formatCents(updatedStats.remainingCents)} remaining`)
  console.log()
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle flags
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    return
  }

  if (args.includes('--status')) {
    showStatus()
    return
  }

  const dryRun = args.includes('--dry-run')
  const positionalArgs = args.filter((a) => !a.startsWith('--'))

  // Get question from args or stdin
  let question = positionalArgs.join(' ').trim()

  if (!question) {
    // Try reading from stdin (piped input)
    if (!process.stdin.isTTY) {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer)
      }
      question = Buffer.concat(chunks).toString('utf-8').trim()
    }
  }

  if (!question) {
    console.error(`${C.red}Error: No question provided.${C.reset}`)
    console.error(`Usage: npx tsx scripts/gridbot/index.ts "Your question here"`)
    console.error(`       npx tsx scripts/gridbot/index.ts --help`)
    process.exit(1)
  }

  await runGridBot(question, dryRun)
}

main().catch((err) => {
  console.error(`${C.red}Fatal error:${C.reset}`, err)
  process.exit(1)
})
