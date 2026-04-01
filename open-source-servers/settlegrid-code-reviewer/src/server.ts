/**
 * settlegrid-code-reviewer — Code Review MCP Server
 *
 * AI-powered code review using local heuristics and pattern matching.
 * No external API key needed — all analysis runs locally.
 *
 * Methods:
 *   review(code, language)       — Analyze code for common issues       (3¢)
 *   complexity(code)             — Estimate cyclomatic complexity        (1¢)
 *   suggest_refactor(code)       — Suggest refactoring improvements      (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReviewInput {
  code: string
  language?: string
}

interface ComplexityInput {
  code: string
}

interface SuggestRefactorInput {
  code: string
  language?: string
}

interface Issue {
  type: 'warning' | 'error' | 'info'
  message: string
  line?: number
  rule: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = new Set([
  'javascript', 'typescript', 'python', 'java', 'go', 'rust',
  'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin',
])

function detectLanguage(code: string): string {
  if (/\bfunc\s+\w+\s*\(/.test(code) && /\bpackage\s+\w+/.test(code)) return 'go'
  if (/\bfn\s+\w+\s*\(/.test(code) && /\blet\s+mut\b/.test(code)) return 'rust'
  if (/\bdef\s+\w+\s*\(/.test(code) && /:$/.test(code.split('\n').find(l => /\bdef\b/.test(l)) ?? '')) return 'python'
  if (/\binterface\b/.test(code) && /:\s*(string|number|boolean)\b/.test(code)) return 'typescript'
  if (/\bconst\b|\blet\b|\bvar\b/.test(code) && /=>/.test(code)) return 'javascript'
  if (/\bpublic\s+static\s+void\s+main\b/.test(code)) return 'java'
  if (/\bclass\s+\w+\s*:\s*\w+/.test(code) && /\busing\b/.test(code)) return 'csharp'
  if (/\b(puts|require|def|end)\b/.test(code) && /\bend\b/.test(code)) return 'ruby'
  if (/\b<\?php\b/.test(code)) return 'php'
  return 'unknown'
}

function findIssues(code: string, language: string): Issue[] {
  const lines = code.split('\n')
  const issues: Issue[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Console.log / print statements left in
    if (/\bconsole\.(log|debug|info)\s*\(/.test(line)) {
      issues.push({ type: 'warning', message: 'Debug console statement found — remove before production', line: lineNum, rule: 'no-console' })
    }
    if (language === 'python' && /\bprint\s*\(/.test(line) && !/\blogger\b/.test(line)) {
      issues.push({ type: 'info', message: 'print() found — consider using logging module instead', line: lineNum, rule: 'no-print' })
    }

    // TODO/FIXME/HACK comments
    if (/\/\/\s*(TODO|FIXME|HACK|XXX)\b/i.test(line) || /#\s*(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
      const match = line.match(/(TODO|FIXME|HACK|XXX)/i)
      issues.push({ type: 'info', message: `${match?.[1]?.toUpperCase()} comment found — track in issue tracker`, line: lineNum, rule: 'no-todo' })
    }

    // Empty catch blocks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
      issues.push({ type: 'error', message: 'Empty catch block swallows errors silently', line: lineNum, rule: 'no-empty-catch' })
    }
    if (/except\s*:\s*$/.test(line.trim()) || /except\s+\w+\s*:\s*$/.test(line.trim())) {
      const nextLine = lines[i + 1]?.trim()
      if (nextLine === 'pass' || nextLine === '') {
        issues.push({ type: 'error', message: 'Empty except block swallows errors silently', line: lineNum, rule: 'no-empty-catch' })
      }
    }

    // Magic numbers
    if (/[^a-zA-Z_](\d{3,})[^a-zA-Z_0-9]/.test(line) && !/const|let|var|=\s*\d|\/\/|#|import|require|port|status/.test(line)) {
      issues.push({ type: 'info', message: 'Magic number detected — consider extracting to a named constant', line: lineNum, rule: 'no-magic-numbers' })
    }

    // Very long lines
    if (line.length > 120) {
      issues.push({ type: 'warning', message: `Line is ${line.length} characters — consider breaking it up (max 120)`, line: lineNum, rule: 'max-line-length' })
    }

    // == instead of === (JS/TS)
    if ((language === 'javascript' || language === 'typescript') && /[^=!]==[^=]/.test(line) && !/===/.test(line)) {
      issues.push({ type: 'warning', message: 'Use === instead of == for strict equality comparison', line: lineNum, rule: 'eqeqeq' })
    }

    // var usage in JS/TS
    if ((language === 'javascript' || language === 'typescript') && /\bvar\s+/.test(line)) {
      issues.push({ type: 'warning', message: 'Use const or let instead of var', line: lineNum, rule: 'no-var' })
    }

    // Nested callbacks (callback hell indicator)
    const indentMatch = line.match(/^(\s+)/)
    if (indentMatch && indentMatch[1].length > 24 && /\bfunction\b|=>/.test(line)) {
      issues.push({ type: 'warning', message: 'Deeply nested callback — consider refactoring with async/await or extracting functions', line: lineNum, rule: 'max-depth' })
    }

    // Hardcoded secrets patterns
    if (/(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]+['"]/i.test(line) && !/process\.env|os\.environ|env\.|getenv/i.test(line)) {
      issues.push({ type: 'error', message: 'Possible hardcoded credential — use environment variables', line: lineNum, rule: 'no-hardcoded-secrets' })
    }
  }

  // Long function detection
  let functionStart = -1
  let braceDepth = 0
  let inFunction = false
  for (let i = 0; i < lines.length; i++) {
    if (/\b(function|def|fn|func)\b/.test(lines[i]) || /=>\s*\{/.test(lines[i])) {
      if (!inFunction) {
        functionStart = i
        inFunction = true
        braceDepth = 0
      }
    }
    if (inFunction) {
      braceDepth += (lines[i].match(/\{/g) ?? []).length
      braceDepth -= (lines[i].match(/\}/g) ?? []).length
      if (braceDepth <= 0 && i > functionStart) {
        const length = i - functionStart + 1
        if (length > 50) {
          issues.push({ type: 'warning', message: `Function is ${length} lines long — consider breaking it into smaller functions (max ~50)`, line: functionStart + 1, rule: 'max-function-length' })
        }
        inFunction = false
      }
    }
  }

  return issues
}

function calculateComplexity(code: string): { complexity: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {
    if_statements: 0,
    else_if: 0,
    for_loops: 0,
    while_loops: 0,
    switch_cases: 0,
    logical_and: 0,
    logical_or: 0,
    ternary: 0,
    catch_blocks: 0,
  }

  const lines = code.split('\n')
  for (const line of lines) {
    // Skip comment lines
    if (/^\s*(\/\/|#|\/\*|\*)/.test(line)) continue

    breakdown.if_statements += (line.match(/\bif\s*\(/g) ?? []).length
    breakdown.if_statements += (line.match(/\bif\s+[^{(]/g) ?? []).length // Python-style if
    breakdown.else_if += (line.match(/\belse\s+if\b|\belif\b/g) ?? []).length
    breakdown.for_loops += (line.match(/\bfor\s*[( ]/g) ?? []).length
    breakdown.while_loops += (line.match(/\bwhile\s*[( ]/g) ?? []).length
    breakdown.switch_cases += (line.match(/\bcase\s+/g) ?? []).length
    breakdown.logical_and += (line.match(/&&/g) ?? []).length
    breakdown.logical_or += (line.match(/\|\|/g) ?? []).length
    breakdown.ternary += (line.match(/\?[^?:]*:/g) ?? []).length
    breakdown.catch_blocks += (line.match(/\bcatch\b|\bexcept\b/g) ?? []).length
  }

  // Base complexity of 1 + all branches
  const complexity = 1 + Object.values(breakdown).reduce((a, b) => a + b, 0)

  return { complexity, breakdown }
}

function generateRefactorSuggestions(code: string, language: string): string[] {
  const suggestions: string[] = []
  const lines = code.split('\n')
  const lineCount = lines.length

  // Deeply nested code
  let maxIndent = 0
  for (const line of lines) {
    const indent = (line.match(/^(\s+)/)?.[1] ?? '').length
    if (indent > maxIndent) maxIndent = indent
  }
  if (maxIndent > 16) {
    suggestions.push('Reduce nesting depth by using early returns (guard clauses) or extracting helper functions')
  }

  // Repeated code patterns
  const normalizedLines = lines.map(l => l.trim()).filter(l => l.length > 10)
  const seen = new Map<string, number>()
  for (const line of normalizedLines) {
    seen.set(line, (seen.get(line) ?? 0) + 1)
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count >= 3)
  if (duplicates.length > 0) {
    suggestions.push(`Found ${duplicates.length} repeated code pattern(s) appearing 3+ times — extract into reusable functions`)
  }

  // Long parameter lists
  for (const line of lines) {
    const params = line.match(/\(([^)]{60,})\)/)
    if (params) {
      const commaCount = (params[1].match(/,/g) ?? []).length
      if (commaCount >= 4) {
        suggestions.push('Functions with 5+ parameters are hard to use — consider using an options object or builder pattern')
        break
      }
    }
  }

  // String concatenation vs template literals (JS/TS)
  if ((language === 'javascript' || language === 'typescript') && /['"][^'"]*['"]\s*\+\s*\w+\s*\+\s*['"]/.test(code)) {
    suggestions.push('Replace string concatenation with template literals for better readability')
  }

  // Callback chains
  if ((code.match(/\.then\s*\(/g) ?? []).length >= 3) {
    suggestions.push('Replace .then() chains with async/await for better readability and error handling')
  }

  // Large file
  if (lineCount > 300) {
    suggestions.push(`File is ${lineCount} lines — consider splitting into separate modules with single responsibilities`)
  }

  // No error handling
  if (!/try|catch|except|error|Error/.test(code) && lineCount > 20) {
    suggestions.push('No error handling detected — add try/catch blocks or error boundaries for robustness')
  }

  // Mutable state
  if ((language === 'javascript' || language === 'typescript') && (code.match(/\blet\s+/g) ?? []).length > 5) {
    suggestions.push('Many let declarations found — prefer const with immutable patterns (map, filter, reduce) where possible')
  }

  // Type annotations (TS)
  if (language === 'typescript' && /\bany\b/.test(code)) {
    suggestions.push('Avoid using `any` type — use specific types, generics, or `unknown` for better type safety')
  }

  // No comments/docs in longer code
  if (lineCount > 50 && !/\/\*\*|"""|'''|\/\/\s*\w/.test(code)) {
    suggestions.push('Consider adding JSDoc/docstring comments for functions and complex logic')
  }

  if (suggestions.length === 0) {
    suggestions.push('Code looks clean — no major refactoring suggestions at this time')
  }

  return suggestions
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'code-reviewer-pro',
  pricing: {
    defaultCostCents: 2,
    methods: {
      review: { costCents: 3, displayName: 'Code Review' },
      complexity: { costCents: 1, displayName: 'Complexity Analysis' },
      suggest_refactor: { costCents: 2, displayName: 'Refactor Suggestions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const review = sg.wrap(async (args: ReviewInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required — provide a string of source code to review')
  }
  if (args.code.length > 100_000) {
    throw new Error('Code too large — max 100KB per review. Split into smaller files.')
  }

  const language = args.language?.toLowerCase().trim() ?? detectLanguage(args.code)
  if (args.language && !SUPPORTED_LANGUAGES.has(language) && language !== 'unknown') {
    throw new Error(`Unsupported language "${args.language}". Supported: ${[...SUPPORTED_LANGUAGES].join(', ')}`)
  }

  const issues = findIssues(args.code, language)
  const lines = args.code.split('\n').length

  const errorCount = issues.filter(i => i.type === 'error').length
  const warningCount = issues.filter(i => i.type === 'warning').length
  const infoCount = issues.filter(i => i.type === 'info').length

  let grade: string
  if (errorCount === 0 && warningCount <= 1) grade = 'A'
  else if (errorCount === 0 && warningCount <= 3) grade = 'B'
  else if (errorCount <= 1 && warningCount <= 5) grade = 'C'
  else if (errorCount <= 3) grade = 'D'
  else grade = 'F'

  return {
    language,
    lineCount: lines,
    grade,
    summary: {
      errors: errorCount,
      warnings: warningCount,
      info: infoCount,
      total: issues.length,
    },
    issues,
  }
}, { method: 'review' })

const complexity = sg.wrap(async (args: ComplexityInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required — provide a string of source code to analyze')
  }
  if (args.code.length > 100_000) {
    throw new Error('Code too large — max 100KB per analysis.')
  }

  const result = calculateComplexity(args.code)
  const lines = args.code.split('\n').length

  let rating: string
  if (result.complexity <= 5) rating = 'low — simple, easy to test'
  else if (result.complexity <= 10) rating = 'moderate — manageable complexity'
  else if (result.complexity <= 20) rating = 'high — consider refactoring'
  else if (result.complexity <= 50) rating = 'very high — difficult to maintain'
  else rating = 'extreme — urgent refactoring needed'

  return {
    cyclomaticComplexity: result.complexity,
    rating,
    lineCount: lines,
    complexityPerLine: Number((result.complexity / Math.max(lines, 1)).toFixed(3)),
    breakdown: result.breakdown,
  }
}, { method: 'complexity' })

const suggestRefactor = sg.wrap(async (args: SuggestRefactorInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required — provide a string of source code to analyze')
  }
  if (args.code.length > 100_000) {
    throw new Error('Code too large — max 100KB per analysis.')
  }

  const language = args.language?.toLowerCase().trim() ?? detectLanguage(args.code)
  const suggestions = generateRefactorSuggestions(args.code, language)
  const complexityResult = calculateComplexity(args.code)
  const lines = args.code.split('\n').length

  return {
    language,
    lineCount: lines,
    complexity: complexityResult.complexity,
    suggestionCount: suggestions.length,
    suggestions,
  }
}, { method: 'suggest_refactor' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { review, complexity, suggestRefactor }

console.log('settlegrid-code-reviewer MCP server ready')
console.log('Methods: review, complexity, suggest_refactor')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')
