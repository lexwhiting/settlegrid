#!/usr/bin/env npx tsx
/**
 * MCP Code Reviewer — Monetized with SettleGrid
 *
 * A complete MCP server that provides AI-powered code review
 * with security analysis, best practice suggestions, and bug detection.
 *
 * Setup:
 *   1. npm install @settlegrid/mcp
 *   2. Set ANTHROPIC_API_KEY and SETTLEGRID_API_KEY in your env
 *   3. Register your tool at settlegrid.ai/dashboard/tools
 *   4. Run: npx tsx mcp-code-reviewer.ts
 *
 * Pricing: 15 cents per full review, 10 cents for security-only, 8 cents for suggestions
 *   - Claude Sonnet costs ~$0.015/1K input, $0.075/1K output tokens
 *   - Average code file ~500 lines = ~2K tokens input, ~1K output = ~$0.105
 *   - 15 cents gives a thin margin; raise to 20-25 cents for production
 *   - Security-only and suggestions use targeted prompts = fewer output tokens
 *
 * Revenue: You keep 95-100% (100% on Free tier, 95% on paid tiers)
 */

import { settlegrid } from '@settlegrid/mcp'

// ── SettleGrid Setup ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'my-code-reviewer', // Replace with your tool slug
  pricing: {
    defaultCostCents: 15,
    methods: {
      review: { costCents: 15, displayName: 'Full Code Review' },
      security: { costCents: 10, displayName: 'Security Analysis' },
      suggest: { costCents: 8, displayName: 'Improvement Suggestions' },
    },
  },
})

// ── Claude API Helper ───────────────────────────────────────────────────────

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content: userMessage }],
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

// ── Input Validation ────────────────────────────────────────────────────────

const MAX_CODE_LENGTH = 50_000
const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'c', 'cpp',
  'csharp', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'sql', 'shell',
] as const

type Language = (typeof SUPPORTED_LANGUAGES)[number]

interface CodeInput {
  code: string
  language?: string
  filename?: string
}

function validateInput(args: CodeInput): { code: string; language: string; filename: string } {
  if (!args.code || args.code.trim().length === 0) {
    throw new Error('Code must be a non-empty string')
  }
  if (args.code.length > MAX_CODE_LENGTH) {
    throw new Error(`Code exceeds ${MAX_CODE_LENGTH} character limit (${args.code.length} chars)`)
  }

  const language = args.language ?? 'typescript'
  if (!SUPPORTED_LANGUAGES.includes(language as Language)) {
    throw new Error(`Unsupported language "${language}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}`)
  }

  return {
    code: args.code,
    language,
    filename: args.filename ?? 'unnamed',
  }
}

// ── Review Methods ──────────────────────────────────────────────────────────

interface ReviewResult {
  summary: string
  issues: string
  score: string
}

async function handleReview(args: CodeInput): Promise<ReviewResult> {
  const { code, language, filename } = validateInput(args)

  const review = await callClaude(
    `You are an expert code reviewer. Analyze the provided ${language} code and return a structured review with these sections:

SUMMARY: A 2-3 sentence overview of the code quality.
ISSUES: A numbered list of bugs, anti-patterns, performance problems, and code smells. For each issue, include the line range, severity (critical/major/minor), and a fix suggestion.
SCORE: A letter grade (A-F) with a one-line justification.

Be thorough but constructive. Flag real problems, not style preferences.`,
    `File: ${filename}\nLanguage: ${language}\n\n${code}`
  )

  return { summary: review, issues: review, score: review }
}

interface SecurityResult {
  vulnerabilities: string
  riskLevel: string
}

async function handleSecurity(args: CodeInput): Promise<SecurityResult> {
  const { code, language, filename } = validateInput(args)

  const analysis = await callClaude(
    `You are a security-focused code auditor. Analyze the provided ${language} code for security vulnerabilities only. Check for:

- Injection flaws (SQL, XSS, command injection, path traversal)
- Authentication and authorization issues
- Sensitive data exposure (hardcoded secrets, PII leaks)
- Insecure cryptography or randomness
- Race conditions and TOCTOU bugs
- Dependency risks (if imports are visible)

Return:
RISK_LEVEL: Critical / High / Medium / Low / None
VULNERABILITIES: Numbered list with CWE ID (if applicable), description, affected lines, and remediation.

If no vulnerabilities are found, say so explicitly.`,
    `File: ${filename}\nLanguage: ${language}\n\n${code}`
  )

  return { vulnerabilities: analysis, riskLevel: analysis }
}

interface SuggestResult {
  suggestions: string
}

async function handleSuggest(args: CodeInput): Promise<SuggestResult> {
  const { code, language, filename } = validateInput(args)

  const suggestions = await callClaude(
    `You are a senior developer mentor. Review the provided ${language} code and suggest improvements in these areas:

- Readability (naming, structure, comments)
- Performance (algorithmic improvements, unnecessary allocations)
- Maintainability (coupling, abstractions, testability)
- Idiomatic patterns (language-specific best practices)

Return a numbered list of concrete, actionable suggestions. Each suggestion should include the current code pattern and the improved version. Skip trivial formatting suggestions.`,
    `File: ${filename}\nLanguage: ${language}\n\n${code}`
  )

  return { suggestions }
}

// ── Wrap with SettleGrid Billing ─────────────────────────────────────────────

export const billedReview = sg.wrap(handleReview, { method: 'review' })
export const billedSecurity = sg.wrap(handleSecurity, { method: 'security' })
export const billedSuggest = sg.wrap(handleSuggest, { method: 'suggest' })

// ── REST Alternative ────────────────────────────────────────────────────────
// import { settlegridMiddleware } from '@settlegrid/mcp/rest'
//
// const withBilling = settlegridMiddleware({
//   toolSlug: 'my-code-reviewer',
//   pricing: {
//     defaultCostCents: 15,
//     methods: {
//       review: { costCents: 15 },
//       security: { costCents: 10 },
//       suggest: { costCents: 8 },
//     },
//   },
// })
//
// export async function POST(request: Request) {
//   return withBilling(request, async () => {
//     const body = await request.json()
//     const result = await handleReview(body)
//     return Response.json(result)
//   }, 'review')
// }
