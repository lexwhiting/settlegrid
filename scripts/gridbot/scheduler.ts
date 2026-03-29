#!/usr/bin/env npx tsx
/**
 * GridBot Scheduler — Automated Demand Generator
 *
 * Runs GridBot on a set of sample questions at regular intervals,
 * generating 10-16 real paid invocations per day across diverse
 * tool categories. Designed to be run via cron or manually.
 *
 * Usage:
 *   npx tsx scripts/gridbot/scheduler.ts           # Run all pending questions
 *   npx tsx scripts/gridbot/scheduler.ts --once     # Run one question and exit
 *   npx tsx scripts/gridbot/scheduler.ts --status   # Show schedule status
 *
 * Cron example (every 30 minutes during business hours, 8am-8pm UTC):
 *   0,30 8-20 * * * cd /path/to/settlegrid && SETTLEGRID_API_KEY=sg_xxx npx tsx scripts/gridbot/scheduler.ts --once
 *
 * Environment:
 *   SETTLEGRID_API_KEY  — Required. Your SettleGrid API key.
 *   SETTLEGRID_URL      — Optional. Default: https://settlegrid.ai
 *   GRIDBOT_BUDGET      — Optional. Daily budget in cents. Default: 100 ($1.00)
 */

import fs from 'fs'
import path from 'path'
import {
  categorizeQuestion,
  discoverTools,
  callToolViaProxy,
  selectBestTool,
  trackSpending,
  getSpendingStats,
  logTransaction,
  getApiKey,
  heading,
  step,
  result,
  separator,
  log,
  formatCents,
  formatPricing,
  type TransactionLog,
} from './lib.js'

// ─── Configuration ───────────────────────────────────────────────────────────

const DAILY_BUDGET_CENTS = parseInt(process.env.GRIDBOT_BUDGET ?? '100', 10)
const INTERVAL_MS = 30 * 60 * 1000 // 30 minutes between questions
const BUSINESS_HOURS_START = 8  // UTC
const BUSINESS_HOURS_END = 20   // UTC

const SCHEDULE_STATE_FILE = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'schedule-state.json',
)

/**
 * Daily question pool. Each question targets a different tool category
 * to generate diverse marketplace activity.
 */
const DAILY_QUESTIONS: { question: string; expectedCategory: string; toolType?: string }[] = [
  // ─── MCP Servers ────────────────────────────────────────────────────────
  { question: "What's the weather in New York City?", expectedCategory: 'data', toolType: 'mcp-server' },
  { question: "Get the current IP geolocation for 8.8.8.8", expectedCategory: 'data', toolType: 'mcp-server' },
  { question: "Analyze this code for security issues: function login(user, pass) { return db.query('SELECT * FROM users WHERE name=' + user) }", expectedCategory: 'code', toolType: 'mcp-server' },
  { question: "Find documentation about MCP protocol specification", expectedCategory: 'search', toolType: 'mcp-server' },

  // ─── AI Models ──────────────────────────────────────────────────────────
  { question: "Run inference: summarize the key points of this article about AI safety", expectedCategory: 'nlp', toolType: 'ai-model' },
  { question: "Generate an embedding for this sentence: 'The quick brown fox jumps over the lazy dog'", expectedCategory: 'nlp', toolType: 'ai-model' },
  { question: "How much does it cost to run GPT-4 inference for this prompt?", expectedCategory: 'ai-inference', toolType: 'ai-model' },

  // ─── REST APIs ──────────────────────────────────────────────────────────
  { question: "Convert 100 USD to EUR at current exchange rates", expectedCategory: 'finance', toolType: 'rest-api' },
  { question: "What is the current price of Bitcoin?", expectedCategory: 'finance', toolType: 'rest-api' },
  { question: "Check if example.com has any SSL certificate issues", expectedCategory: 'security', toolType: 'rest-api' },

  // ─── Agent Tools ────────────────────────────────────────────────────────
  { question: "Find a LangChain tool for web scraping", expectedCategory: 'scraping', toolType: 'agent-tool' },
  { question: "Invoke a CrewAI-compatible tool for text analysis", expectedCategory: 'nlp', toolType: 'agent-tool' },

  // ─── Automations ────────────────────────────────────────────────────────
  { question: "Set up an automation workflow to monitor website uptime", expectedCategory: 'security', toolType: 'automation' },
  { question: "Trigger a scheduled data export pipeline", expectedCategory: 'data', toolType: 'automation' },

  // ─── Datasets ───────────────────────────────────────────────────────────
  { question: "Download a training dataset for sentiment analysis", expectedCategory: 'nlp', toolType: 'dataset' },
  { question: "Query a benchmark dataset for image classification", expectedCategory: 'image', toolType: 'dataset' },

  // ─── SDK Packages ───────────────────────────────────────────────────────
  { question: "Find an npm package for payment integration", expectedCategory: 'finance', toolType: 'sdk-package' },
  { question: "Check features of a Python SDK for data analysis", expectedCategory: 'analytics', toolType: 'sdk-package' },

  // ─── Extensions ─────────────────────────────────────────────────────────
  { question: "Find a VSCode extension for code security scanning", expectedCategory: 'security', toolType: 'extension' },

  // ─── Cross-type queries ─────────────────────────────────────────────────
  { question: "Translate 'Hello, how are you?' to Japanese", expectedCategory: 'nlp' },
  { question: "Validate this JSON: {\"name\": \"test\", \"value\": 42, \"items\": [1, 2, 3]}", expectedCategory: 'utility' },
  { question: "Calculate the average and standard deviation of these values: 12, 15, 18, 22, 25, 28, 31", expectedCategory: 'analytics' },
  { question: "What is the molecular weight of caffeine?", expectedCategory: 'science' },
  { question: "Generate an image of a sunset over mountains", expectedCategory: 'image' },
]

// ─── Schedule State ──────────────────────────────────────────────────────────

interface ScheduleState {
  date: string        // YYYY-MM-DD UTC
  questionsRun: number[]  // Indices of questions already run today
  lastRunAt: string | null
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function currentHourUTC(): number {
  return new Date().getUTCHours()
}

function loadScheduleState(): ScheduleState {
  try {
    if (fs.existsSync(SCHEDULE_STATE_FILE)) {
      const raw = fs.readFileSync(SCHEDULE_STATE_FILE, 'utf-8')
      const state = JSON.parse(raw) as ScheduleState
      if (state.date !== todayUTC()) {
        return { date: todayUTC(), questionsRun: [], lastRunAt: null }
      }
      return state
    }
  } catch {
    // Corrupted file, reset
  }
  return { date: todayUTC(), questionsRun: [], lastRunAt: null }
}

function saveScheduleState(state: ScheduleState): void {
  try {
    fs.writeFileSync(SCHEDULE_STATE_FILE, JSON.stringify(state, null, 2) + '\n')
  } catch (err) {
    log('scheduler', `Failed to save schedule state: ${err instanceof Error ? err.message : String(err)}`, 'warn')
  }
}

// ─── Core Scheduler Logic ────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
} as const

/**
 * Runs a single question through GridBot (discovery -> selection -> invocation).
 */
async function runSingleQuestion(
  question: string,
  expectedCategory: string,
  apiKey: string,
  questionIndex: number,
): Promise<boolean> {
  console.log()
  step(questionIndex + 1, `"${question}"`)

  // Categorize
  const { category, searchQuery } = categorizeQuestion(question)
  result('Detected category', category ?? '(broad)')
  result('Expected category', expectedCategory)

  // Discover
  let tools = await discoverTools(searchQuery, category ?? undefined, 10)

  if (tools.length === 0 && category) {
    log('discover', 'Retrying with broader search...')
    tools = await discoverTools(searchQuery, undefined, 10)
  }

  if (tools.length === 0) {
    result('Result', `${C.yellow}No tools found${C.reset}`)
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
    return false
  }

  result('Tools found', String(tools.length))

  // Select
  const stats = getSpendingStats(DAILY_BUDGET_CENTS)
  const selected = selectBestTool(tools, stats.remainingCents)

  if (!selected) {
    result('Result', `${C.yellow}Budget exhausted${C.reset}`)
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
    return false
  }

  const selectedCost = selected.costCents ?? selected.pricing?.defaultCostCents ?? 0
  result('Selected', `${selected.name} (${formatPricing(selected.pricing, selected.costCents)})`)

  // Budget check
  const budgetAfter = trackSpending(selectedCost, DAILY_BUDGET_CENTS)
  if (budgetAfter < 0) {
    result('Result', `${C.yellow}Would exceed budget, skipping${C.reset}`)
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
    return false
  }

  // Invoke
  const proxyResult = await callToolViaProxy(
    selected.slug,
    { question, format: 'json' },
    apiKey,
  )

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
  }
  logTransaction(tx)

  if (proxyResult.ok) {
    result('Result', `${C.green}Success${C.reset} (${proxyResult.latencyMs}ms, ${formatCents(proxyResult.costCents)})`)
  } else {
    result('Result', `${C.red}Error: ${proxyResult.error}${C.reset} (${proxyResult.latencyMs}ms)`)
  }

  return proxyResult.ok
}

/**
 * Gets the next question to run (round-robin through the pool).
 */
function getNextQuestion(state: ScheduleState): { index: number; question: string; expectedCategory: string } | null {
  for (let i = 0; i < DAILY_QUESTIONS.length; i++) {
    if (!state.questionsRun.includes(i)) {
      return { index: i, ...DAILY_QUESTIONS[i] }
    }
  }
  return null // All questions run for today
}

// ─── Modes ───────────────────────────────────────────────────────────────────

async function runOnce(): Promise<void> {
  const apiKey = getApiKey()
  const state = loadScheduleState()

  // Check business hours
  const hour = currentHourUTC()
  if (hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END) {
    log('scheduler', `Outside business hours (${BUSINESS_HOURS_START}-${BUSINESS_HOURS_END} UTC, current: ${hour} UTC). Skipping.`)
    return
  }

  // Check cooldown (don't run more than once per interval)
  if (state.lastRunAt) {
    const lastRun = new Date(state.lastRunAt).getTime()
    const elapsed = Date.now() - lastRun
    if (elapsed < INTERVAL_MS - 60_000) { // 1 minute grace
      const remainingMin = Math.ceil((INTERVAL_MS - elapsed) / 60_000)
      log('scheduler', `Cooldown active. Next run in ~${remainingMin} minutes.`)
      return
    }
  }

  // Get next question
  const next = getNextQuestion(state)
  if (!next) {
    log('scheduler', 'All daily questions have been run. Resumes tomorrow.')
    return
  }

  // Check budget
  const stats = getSpendingStats(DAILY_BUDGET_CENTS)
  if (stats.remainingCents <= 0) {
    log('scheduler', `Daily budget exhausted (${formatCents(stats.spentCents)} spent). Resumes tomorrow.`)
    return
  }

  log('scheduler', `Running question ${next.index + 1}/${DAILY_QUESTIONS.length}`)

  const success = await runSingleQuestion(next.question, next.expectedCategory, apiKey, 0)

  // Update state
  state.questionsRun.push(next.index)
  state.lastRunAt = new Date().toISOString()
  saveScheduleState(state)

  separator()
  const updatedStats = getSpendingStats(DAILY_BUDGET_CENTS)
  log('scheduler', `Done. ${state.questionsRun.length}/${DAILY_QUESTIONS.length} questions run today. Budget: ${formatCents(updatedStats.remainingCents)} remaining.`)
}

async function runAll(): Promise<void> {
  const apiKey = getApiKey()

  heading('GridBot Scheduler — Full Run')

  const stats = getSpendingStats(DAILY_BUDGET_CENTS)
  result('Date', todayUTC())
  result('Budget', `${formatCents(stats.spentCents)} spent / ${formatCents(DAILY_BUDGET_CENTS)} limit`)
  result('Questions', `${DAILY_QUESTIONS.length} in pool`)
  separator()

  const state = loadScheduleState()
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (let i = 0; i < DAILY_QUESTIONS.length; i++) {
    // Skip already-run questions
    if (state.questionsRun.includes(i)) {
      log('scheduler', `Question ${i + 1} already run today, skipping.`)
      skippedCount++
      continue
    }

    // Check remaining budget
    const currentStats = getSpendingStats(DAILY_BUDGET_CENTS)
    if (currentStats.remainingCents <= 0) {
      log('scheduler', `Budget exhausted. Stopping. (${DAILY_QUESTIONS.length - i} questions remaining)`, 'warn')
      break
    }

    const { question, expectedCategory } = DAILY_QUESTIONS[i]
    const success = await runSingleQuestion(question, expectedCategory, apiKey, i)

    if (success) {
      successCount++
    } else {
      errorCount++
    }

    // Update state after each question
    state.questionsRun.push(i)
    state.lastRunAt = new Date().toISOString()
    saveScheduleState(state)

    // Small delay between questions to avoid rate limiting
    if (i < DAILY_QUESTIONS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  separator()
  heading('Scheduler Summary')
  result('Total questions', String(DAILY_QUESTIONS.length))
  result('Successful', `${C.green}${successCount}${C.reset}`)
  result('Errors', errorCount > 0 ? `${C.red}${errorCount}${C.reset}` : '0')
  result('Skipped (already run)', String(skippedCount))
  result('Skipped (budget)', String(DAILY_QUESTIONS.length - successCount - errorCount - skippedCount))

  const finalStats = getSpendingStats(DAILY_BUDGET_CENTS)
  result('Total spent', formatCents(finalStats.spentCents))
  result('Budget remaining', formatCents(finalStats.remainingCents))
  separator()
}

function showScheduleStatus(): void {
  heading('GridBot Scheduler Status')

  const state = loadScheduleState()
  const stats = getSpendingStats(DAILY_BUDGET_CENTS)

  result('Date', state.date)
  result('Questions run', `${state.questionsRun.length}/${DAILY_QUESTIONS.length}`)
  result('Last run', state.lastRunAt ?? 'never')
  result('Budget', `${formatCents(stats.spentCents)} / ${formatCents(DAILY_BUDGET_CENTS)}`)
  result('Remaining', formatCents(stats.remainingCents))

  console.log()
  console.log(`  ${C.bold}Question Pool:${C.reset}`)
  for (let i = 0; i < DAILY_QUESTIONS.length; i++) {
    const { question, expectedCategory } = DAILY_QUESTIONS[i]
    const done = state.questionsRun.includes(i)
    const status = done ? `${C.green}done${C.reset}` : `${C.dim}pending${C.reset}`
    const q = question.length > 50 ? question.slice(0, 47) + '...' : question
    console.log(`    ${C.dim}${String(i + 1).padStart(2)}.${C.reset} [${status}] ${q} ${C.dim}(${expectedCategory})${C.reset}`)
  }

  separator()

  const hour = currentHourUTC()
  const inBusinessHours = hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END
  console.log(`  Business hours: ${BUSINESS_HOURS_START}:00-${BUSINESS_HOURS_END}:00 UTC`)
  console.log(`  Current hour: ${hour}:00 UTC — ${inBusinessHours ? `${C.green}active${C.reset}` : `${C.yellow}inactive${C.reset}`}`)
  console.log()
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${C.bold}GridBot Scheduler${C.reset} — Automated demand generator

${C.yellow}Usage:${C.reset}
  npx tsx scripts/gridbot/scheduler.ts              Run all pending questions
  npx tsx scripts/gridbot/scheduler.ts --once       Run one question and exit
  npx tsx scripts/gridbot/scheduler.ts --status     Show schedule status
  npx tsx scripts/gridbot/scheduler.ts --help       Show this help

${C.yellow}Cron (every 30 min, business hours):${C.reset}
  */30 8-20 * * * cd /path/to/settlegrid && SETTLEGRID_API_KEY=sg_xxx npx tsx scripts/gridbot/scheduler.ts --once
`)
    return
  }

  if (args.includes('--status')) {
    showScheduleStatus()
    return
  }

  if (args.includes('--once')) {
    await runOnce()
    return
  }

  // Default: run all pending questions
  await runAll()
}

main().catch((err) => {
  console.error(`${C.red}Fatal error:${C.reset}`, err)
  process.exit(1)
})
