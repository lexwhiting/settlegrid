#!/usr/bin/env npx tsx
/**
 * MCP Document Analyzer — Monetized with SettleGrid
 *
 * A complete MCP server that uses Claude to analyze documents.
 * Fork this template, add your Anthropic API key, and deploy.
 *
 * Setup:
 *   1. npm install @settlegrid/mcp
 *   2. Set ANTHROPIC_API_KEY and SETTLEGRID_API_KEY in your env
 *   3. Register your tool at settlegrid.ai/dashboard/tools
 *   4. Run: npx tsx mcp-document-analyzer.ts
 *
 * Pricing: 10 cents per analysis, 4 cents per summary, 6 cents per extraction
 *   - Claude Haiku input ~$0.001/1K tokens, output ~$0.005/1K tokens
 *   - Average doc uses ~2K input + 1K output = ~$0.007
 *   - 10 cents gives you ~14x margin on full analysis
 *   - Summaries use fewer output tokens, so 4 cents is still ~5x margin
 *
 * Revenue: You keep 95-100% (100% on Free tier, 95% on paid tiers)
 */

import { settlegrid } from '@settlegrid/mcp'

// ── SettleGrid Setup ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'my-doc-analyzer', // Replace with your tool slug
  pricing: {
    defaultCostCents: 10,
    methods: {
      analyze: { costCents: 10, displayName: 'Full Analysis' },
      summarize: { costCents: 4, displayName: 'Quick Summary' },
      extract: { costCents: 6, displayName: 'Field Extraction' },
    },
  },
})

// ── Claude API Helper ───────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

async function callClaude(messages: ClaudeMessage[], systemPrompt: string): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  const block = data.content?.[0]
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected Claude response format')
  }
  return block.text
}

// ── Document Analysis Methods ───────────────────────────────────────────────

interface AnalyzeArgs {
  document: string
  documentType?: string
}

async function analyzeDocument(args: AnalyzeArgs): Promise<{ analysis: string; documentType: string }> {
  if (!args.document || args.document.trim().length === 0) {
    throw new Error('Document text must be non-empty')
  }
  if (args.document.length > 100_000) {
    throw new Error('Document exceeds 100,000 character limit')
  }

  const docType = args.documentType ?? 'unknown'
  const text = await callClaude(
    [{ role: 'user', content: `Analyze the following ${docType} document:\n\n${args.document}` }],
    'You are a document analysis expert. Provide a structured analysis covering: key findings, document type, entities mentioned, dates, monetary amounts, obligations, and risks. Return your analysis in clearly labeled sections.'
  )

  return { analysis: text, documentType: docType }
}

interface SummarizeArgs {
  document: string
  maxSentences?: number
}

async function summarizeDocument(args: SummarizeArgs): Promise<{ summary: string }> {
  if (!args.document || args.document.trim().length === 0) {
    throw new Error('Document text must be non-empty')
  }

  const limit = Math.min(args.maxSentences ?? 5, 20)
  const text = await callClaude(
    [{ role: 'user', content: `Summarize this document in ${limit} sentences or fewer:\n\n${args.document}` }],
    'You are a concise summarizer. Extract the key points and present them clearly.'
  )

  return { summary: text }
}

interface ExtractArgs {
  document: string
  fields: string[]
}

async function extractFields(args: ExtractArgs): Promise<{ fields: Record<string, string> }> {
  if (!args.document || args.document.trim().length === 0) {
    throw new Error('Document text must be non-empty')
  }
  if (!args.fields || args.fields.length === 0) {
    throw new Error('At least one field name is required')
  }

  const fieldList = args.fields.slice(0, 50).join(', ')
  const text = await callClaude(
    [{ role: 'user', content: `Extract these fields from the document: ${fieldList}\n\nDocument:\n${args.document}` }],
    'You are a field extraction engine. Return a JSON object with the requested field names as keys and extracted values as strings. If a field is not found, set its value to "NOT_FOUND". Return ONLY valid JSON, no markdown.'
  )

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, string>
    return { fields: parsed }
  } catch {
    return { fields: { _raw: text } }
  }
}

// ── Wrap with SettleGrid Billing ─────────────────────────────────────────────

export const billedAnalyze = sg.wrap(analyzeDocument, { method: 'analyze' })
export const billedSummarize = sg.wrap(summarizeDocument, { method: 'summarize' })
export const billedExtract = sg.wrap(extractFields, { method: 'extract' })

// ── REST Alternative ────────────────────────────────────────────────────────
// import { settlegridMiddleware } from '@settlegrid/mcp/rest'
//
// const withBilling = settlegridMiddleware({
//   toolSlug: 'my-doc-analyzer',
//   pricing: {
//     defaultCostCents: 10,
//     methods: {
//       analyze: { costCents: 10 },
//       summarize: { costCents: 4 },
//       extract: { costCents: 6 },
//     },
//   },
// })
//
// export async function POST(request: Request) {
//   return withBilling(request, async () => {
//     const body = await request.json()
//     const result = await analyzeDocument(body)
//     return Response.json(result)
//   }, 'analyze')
// }
