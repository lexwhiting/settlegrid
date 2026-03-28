#!/usr/bin/env npx tsx
/**
 * SettleGrid Demo Agent 3: Content Agent
 *
 * Demonstrates an agent that takes a content brief, discovers NLP
 * and image generation tools on SettleGrid, checks pricing, calls
 * tools sequentially (research -> write -> image -> publish), and
 * compiles the final output.
 *
 * Run:
 *   npx tsx scripts/demo-agents/content-agent.ts
 *   npx tsx scripts/demo-agents/content-agent.ts "Write a blog post about autonomous AI agents"
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

const DEFAULT_BRIEF = 'Write a blog post about how MCP monetization will create a new economy for AI tool developers'
const BUDGET_CENTS = 100 // $1.00 total budget for the content pipeline

// Pipeline stages: each stage discovers and uses a different tool category
const PIPELINE_STAGES = [
  {
    name: 'Research',
    query: 'summarization research',
    category: 'nlp',
    description: 'Find background research and summarize source material',
  },
  {
    name: 'Sentiment',
    query: 'sentiment analysis',
    category: 'nlp',
    description: 'Analyze sentiment of existing content on this topic',
  },
  {
    name: 'Writing',
    query: 'text generation writing',
    category: 'nlp',
    description: 'Generate the blog post draft',
  },
  {
    name: 'Image',
    query: 'image generation',
    category: 'image',
    description: 'Generate a header image for the blog post',
  },
]

// Simulated outputs for each stage
const SIMULATED_OUTPUTS: Record<string, string> = {
  Research: [
    'Key findings from 12 sources:',
    '- MCP (Model Context Protocol) enables standardized tool-agent communication',
    '- x402 payment protocol allows per-call micropayments without subscriptions',
    '- SettleGrid marketplace has 85+ registered tools across 15 categories',
    '- Average tool price: $0.01-$0.25 per call',
    '- Developer revenue share: 95-100% depending on tier',
  ].join('\n'),
  Sentiment: [
    'Sentiment analysis of 50 articles on MCP monetization:',
    '- Overall sentiment: Positive (0.72)',
    '- Key positive themes: developer empowerment, low friction, pay-per-use',
    '- Key concerns: market fragmentation, pricing race to bottom',
    '- Recommended tone: Optimistic but grounded',
  ].join('\n'),
  Writing: [
    '# The MCP Economy: How Tool Monetization Will Transform AI Development',
    '',
    'The emergence of the Model Context Protocol has created something unprecedented:',
    'a standardized way for AI agents to discover, evaluate, and pay for tools in',
    'real-time. This is not another API marketplace. This is the infrastructure for',
    'an entirely new economy.',
    '',
    '## From Free APIs to Paid Intelligence',
    '',
    'For years, developers have given away their tools for free, monetizing through',
    'ads or hoping for enterprise contracts. MCP + x402 changes this calculus.',
    'A developer can publish a tool, set a price ($0.01 per call), and start',
    'earning from the first invocation. No sales team. No contracts. No invoicing.',
    '',
    '## The Agent as Customer',
    '',
    'The buyer is not a human browsing a catalog. The buyer is an AI agent with',
    'a budget, a task, and the ability to evaluate tools programmatically. This',
    'means tools compete on merit: accuracy, speed, and price.',
    '',
    '[Draft continues for 1,200 words...]',
  ].join('\n'),
  Image: [
    'Generated image: "Abstract network of interconnected nodes representing',
    'AI agents and tools, deep blue background with cyan connection lines,',
    'minimalist style" — 1200x630px, PNG format',
    'Image URL: https://settlegrid.ai/generated/mcp-economy-header.png [simulated]',
  ].join('\n'),
}

// ─── Agent Logic ────────────────────────────────────────────────────────────────

interface PipelineResult {
  stage: string
  tool: DiscoveredTool | null
  output: string
  costCents: number
}

async function runPipeline(brief: string): Promise<PipelineResult[]> {
  const results: PipelineResult[] = []
  let remainingBudget = BUDGET_CENTS

  for (const stage of PIPELINE_STAGES) {
    console.log()
    step(results.length + 2, `${stage.name}: ${stage.description}`)

    // Discover tools for this stage
    const tools = await discoverTools(stage.query, stage.category, 5)
    if (tools.length > 0) {
      result('Discovered', `${tools.length} tool(s)`)
      toolTable(tools)
    } else {
      result('Discovered', '0 tools (marketplace may be empty or API unreachable)')
    }

    // Select best tool within remaining budget
    const affordable = budgetCheck(tools, remainingBudget)
    let selectedTool: DiscoveredTool | null = null
    let cost = 0

    if (affordable.length > 0) {
      selectedTool = affordable.sort((a, b) => b.invocations - a.invocations)[0]
      cost = costCents(selectedTool.pricing)
      result('Selected', `${selectedTool.name} — ${formatPricing(selectedTool.pricing)}`)
    } else if (tools.length > 0) {
      log(stage.name.toLowerCase(), 'No tools within remaining budget')
      result('Selected', '(none — budget exhausted)')
    } else {
      // Use a hypothetical tool to show the flow
      selectedTool = {
        name: `${stage.name} Tool`,
        slug: `${stage.name.toLowerCase()}-tool`,
        description: `Hypothetical ${stage.name.toLowerCase()} tool`,
        category: stage.category ?? 'nlp',
        tags: [],
        version: '1.0.0',
        pricing: { defaultCostCents: 15 },
        invocations: 500,
        developer: 'SettleGrid',
        developerSlug: 'settlegrid',
        url: `https://settlegrid.ai/tools/${stage.name.toLowerCase()}-tool`,
        developerUrl: null,
      }
      cost = costCents(selectedTool.pricing)
      result('Selected', `${selectedTool.name} [hypothetical] — ${formatPricing(selectedTool.pricing)}`)
    }

    // Simulate the call
    if (selectedTool) {
      simulateCall(selectedTool, { brief, stage: stage.name })
      remainingBudget -= cost
    }

    const output = SIMULATED_OUTPUTS[stage.name] ?? `[${stage.name} output simulated]`
    results.push({ stage: stage.name, tool: selectedTool, output, costCents: cost })

    result('Budget remaining', `$${(remainingBudget / 100).toFixed(2)}`)
    separator()
  }

  return results
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const brief = process.argv[2] ?? DEFAULT_BRIEF

  heading('SettleGrid Content Agent')
  console.log(`Brief:  "${brief}"`)
  console.log(`Budget: $${(BUDGET_CENTS / 100).toFixed(2)}`)
  separator()

  // Step 1: Plan the content pipeline
  step(1, 'Planning content pipeline')
  for (const stage of PIPELINE_STAGES) {
    result(stage.name, stage.description)
  }
  separator()

  // Steps 2-5: Run each pipeline stage
  const pipelineResults = await runPipeline(brief)

  // Step 6: Compile final output
  step(pipelineResults.length + 2, 'Compiling final content')
  console.log()

  for (const { stage, output } of pipelineResults) {
    console.log(`  --- ${stage} Output ---`)
    for (const line of output.split('\n')) {
      console.log(`    ${line}`)
    }
    console.log()
  }

  separator()

  // Summary
  const totalCost = pipelineResults.reduce((sum, r) => sum + r.costCents, 0)
  const toolsUsed = pipelineResults.filter((r) => r.tool !== null).length

  step(pipelineResults.length + 3, 'Pipeline summary')
  result('Stages completed', `${pipelineResults.length}/${PIPELINE_STAGES.length}`)
  result('Tools used', String(toolsUsed))
  result('Total cost', `$${(totalCost / 100).toFixed(2)} of $${(BUDGET_CENTS / 100).toFixed(2)} budget`)
  result('Budget remaining', `$${((BUDGET_CENTS - totalCost) / 100).toFixed(2)}`)

  for (const { stage, tool, costCents: cost } of pipelineResults) {
    const toolName = tool ? tool.name : '(skipped)'
    result(`  ${stage}`, `${toolName} — $${(cost / 100).toFixed(2)}`)
  }

  separator()
  heading('Workflow Complete')
  console.log('This demo proved the sequential pipeline SettleGrid agent workflow:')
  console.log('  1. Agent received a content brief')
  console.log('  2. Agent planned a multi-stage pipeline (research -> sentiment -> write -> image)')
  console.log('  3. At each stage, agent discovered tools via SettleGrid Discovery API')
  console.log('  4. Agent evaluated pricing and selected tools within a rolling budget')
  console.log('  5. Agent called tools sequentially, passing context between stages')
  console.log('  6. Agent compiled all outputs into a final content package')
  console.log()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
